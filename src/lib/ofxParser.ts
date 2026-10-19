/**
 * E-30: downloaded OFX 1.x (SGML) / 2.x (XML) and QFX statements.
 * One bank/card account and one currency per file, staging only.
 * Never post, infer FX, coerce unsupported transactions or trust a bank balance
 * as a ledger balance. Signed TRNAMT is authoritative (not TRNTYPE).
 */
import { bankStatementDate } from './bankStatementDate';
import type { ParsedBankLine } from './mt940Parser';

const MAX_FILE_SIZE = 5_000_000;
const MAX_TRANSACTIONS = 50_000;

function refuse(message: string): never {
  throw new Error('OFX/QFX: ' + message);
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|amp|lt|gt|quot|apos);/gi, (whole, hex: string | undefined, dec: string | undefined) => {
    if (hex || dec) {
      const point = Number.parseInt((hex || dec)!, hex ? 16 : 10);
      if (!Number.isInteger(point) || point < 1 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) refuse('Invalid character reference.');
      return String.fromCodePoint(point);
    }
    const names: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    return names[whole.toLowerCase()] || whole;
  });
}

function leaf(block: string, tag: string): string | null {
  // OFX 1.x SGML does not close leaf tags, while XML does. Both place leaf
  // content before the next opening/closing tag. Do not parse arbitrary XML.
  const match = new RegExp('<' + tag + '(?:\\s[^<>]*)?>\\s*([^<]*)', 'i').exec(block);
  if (!match) return null;
  const text = decodeEntities(match[1].trim());
  if (/&(?:#|[a-z])[a-z0-9#]*;/i.test(text)) refuse('Unsupported XML entity.');
  return text;
}

function signedMinorUnits(raw: string | null, item: number): number {
  if (raw === null || !/^[+-]?\d+(?:\.\d{1,2})?$/.test(raw)) refuse('Transaction ' + item + ' needs a two-decimal numeric TRNAMT.');
  const negative = raw!.startsWith('-');
  const noSign = raw!.replace(/^[+-]/, '');
  const [whole, fraction = ''] = noSign.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  if (cents === 0n) refuse('Transaction ' + item + ' has a zero amount; review the source file.');
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) refuse('Transaction ' + item + ' exceeds safe integer cents.');
  return Number(cents) * (negative ? -1 : 1);
}

/**
 * Unsupported variants fail as a whole instead of silently dropping entries.
 * Dates are posting dates, not device-local converted timestamps.
 * FITID is returned as reference for review; existing import deduplication
 * currently also uses date, amount and description.
 */
export function parseOFXStatement(source: string, expectedCurrency?: string): ParsedBankLine[] {
  if (!source || source.length > MAX_FILE_SIZE) refuse('Empty or oversized file (5 MB maximum).');
  const text = source.replace(/^\uFEFF/, '');
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(text)) refuse('DTD and XML entities are unsupported.');
  if (!/<OFX(?:\s[^<>]*)?>/i.test(text) || !/<\/OFX\s*>/i.test(text)) refuse('Missing OFX document wrapper.');

  const statementOpenings = text.match(/<(?:STMTRS|CCSTMTRS)(?:\s[^<>]*)?>/gi) || [];
  const statements = [...text.matchAll(/<(STMTRS|CCSTMTRS)(?:\s[^<>]*)?>([\s\S]*?)<\/\1\s*>/gi)];
  if (statementOpenings.length !== 1 || statements.length !== 1) refuse('Export exactly one complete bank or credit-card account per file.');
  const statement = statements[0][2];
  if (!/<(?:BANKACCTFROM|CCACCTFROM)(?:\s[^<>]*)?>/i.test(statement) ||
      !leaf(statement, 'ACCTID')) refuse('Account identifier is missing.');
  const currency = leaf(statement, 'CURDEF');
  if (!currency || !/^[A-Z]{3}$/.test(currency)) refuse('Statement currency CURDEF is missing or invalid.');
  if (expectedCurrency && currency !== expectedCurrency.toUpperCase()) {
    refuse('Statement currency ' + currency + ' differs from workspace currency ' + expectedCurrency.toUpperCase() + '. No conversion is guessed.');
  }
  try {
    if (new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits !== 2) {
      refuse('Only two-decimal statement currencies are supported.');
    }
  } catch {
    refuse('Unsupported statement currency.');
  }

  const lists = [...statement.matchAll(/<BANKTRANLIST(?:\s[^<>]*)?>([\s\S]*?)<\/BANKTRANLIST\s*>/gi)];
  const listOpenings = statement.match(/<BANKTRANLIST(?:\s[^<>]*)?>/gi) || [];
  if (listOpenings.length !== 1 || lists.length !== 1) refuse('A complete BANKTRANLIST is required.');
  const bankLines = lists[0][1];
  const txOpenings = bankLines.match(/<STMTTRN(?:\s[^<>]*)?>/gi) || [];
  const txBlocks = [...bankLines.matchAll(/<STMTTRN(?:\s[^<>]*)?>([\s\S]*?)<\/STMTTRN\s*>/gi)];
  if (!txBlocks.length || txOpenings.length !== txBlocks.length || txBlocks.length > MAX_TRANSACTIONS) {
    refuse('Transaction blocks are missing, truncated or exceed the 50,000-entry limit.');
  }
  const ids = new Set<string>();
  const result: ParsedBankLine[] = [];
  for (const [index, tx] of txBlocks.entries()) {
    const i = index + 1;
    const block = tx[1];
    if (/<(?:CURRENCY|ORIGCURRENCY|CORRECTACTION|CORRECTFITID)(?:\s|>)/i.test(block)) {
      refuse('Transaction ' + i + ' requires separate currency or correction review.');
    }
    const fitid = leaf(block, 'FITID');
    if (!fitid) refuse('Transaction ' + i + ' is missing FITID.');
    if (ids.has(fitid)) refuse('Duplicate FITID in file: ' + fitid);
    ids.add(fitid);
    const posted = leaf(block, 'DTPOSTED');
    const match = posted?.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6}(?:\.\d+)?(?:\[[^\]]+\])?)?$/);
    if (!match) refuse('Transaction ' + i + ' has an unsupported posting date.');
    const date = bankStatementDate(Number(match![1]), Number(match![2]), Number(match![3]));
    if (!date) refuse('Transaction ' + i + ' has an invalid calendar date.');
    const amountCents = signedMinorUnits(leaf(block, 'TRNAMT'), i);
    const name = leaf(block, 'NAME') || '';
    const memo = leaf(block, 'MEMO') || '';
    const description = [name, memo && memo !== name ? memo : ''].filter(Boolean).join(' — ') || 'OFX entry ' + fitid;
    result.push({
      date, amountCents, description, reference: fitid,
      type: amountCents < 0 ? 'debit' : 'credit',
    });
  }
  return result;
}
