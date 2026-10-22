/**
 * PREV-6: deterministic fuzzing of every statement and migration parser.
 * Each corpus file (src/tests/fixtures/parsers, fixtures/bank-statements) is mutated with a
 * seeded PRNG (truncation, byte flips, dropped/doubled delimiters, inserted/duplicated/swapped
 * lines, invalid UTF-8). For every case a parser must either
 *   - return a complete result: every row has a real calendar date, safe-integer cents and a
 *     description, and no transaction in the file was silently left out; or
 *   - throw a plain Error with a readable message (never a TypeError/RangeError crash),
 * and it must do so quickly (no runaway regular expressions).
 * Fixed seed: a failure prints the seed and case number so it can be replayed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseOFXStatement } from '../lib/ofxParser';
import { parseCamt053Import } from '../lib/camt053Import';
import { parseQIFStatement } from '../lib/qifParser';
import { parseBAI2Statement } from '../lib/bai2Parser';
import { parseUsBankCsv, type UsBankCsvFormat } from '../lib/usBankCsv';
import { parseCsvChecked } from '../lib/csv';
import { assertReadableText, mapBankCsvRows, type BankCsvMapping } from '../lib/bankCsvRows';
import { bankStatementDate } from '../lib/bankStatementDate';
import { normalizeQuickBooksCsv } from '../lib/quickBooksCsvImport';
import { applyMapping, guessMapping, prepareImport, type ImportKind } from '../lib/recordImport';

// Replay or explore: PARSER_FUZZ_SEED=<n> PARSER_FUZZ_CASES=<n> npx tsx --test src/tests/parser-fuzz.test.ts
const SEED = Number(process.env.PARSER_FUZZ_SEED) || 0x5eed_0006;
const CASES = Number(process.env.PARSER_FUZZ_CASES) || 300;
const SLOW_CASE_MS = 500;

const read = (dir: string, name: string) => new TextDecoder('utf-8').decode(readFileSync(new URL(`./fixtures/${dir}/${name}`, import.meta.url)));
const corpus = (name: string) => read('parsers', name);
const bankFixture = (name: string) => read('bank-statements', name);

/** mulberry32: small, fast, deterministic. */
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return { next, int, pick: <T>(items: readonly T[]): T => items[int(items.length)] };
}
type Rng = ReturnType<typeof prng>;

const PALETTE = [',', ';', '\t', '"', "'", '\n', '\r\n', '<', '>', '/', '&', '-', '+', '.', '0', '9', '(', ')', 'A', 'é', ' ', '', '\u0000', '$', '1,000', '</STMTTRN>', '<Ntry>', '^', '﻿'];
const GARBAGE_LINES = ['', 'Total,,1234.56', 'garbage line', '"unterminated', '<STMTTRN><TRNAMT>1.00', '</Ntry>', 'D10/32/2026', 'T-abc', '^', ';;;;', '16,195,9.99,Z/', '2026-13-01,Bad,1.00', '99999999999999999999'];
const DELIMS = [',', ';', '\t', '<', '>', '"', '\n', '.'];

function mutateOnce(text: string, rng: Rng): string {
  const at = text.length ? rng.int(text.length) : 0;
  const lines = text.split('\n');
  switch (rng.int(10)) {
    case 0: return text.slice(0, at); // truncated download
    case 1: return text.slice(0, at) + rng.pick(PALETTE) + text.slice(at + 1); // flipped character
    case 2: return text.slice(0, at) + text.slice(at + 1 + rng.int(8)); // deleted bytes
    case 3: { // drop one delimiter
      const d = rng.pick(DELIMS);
      const positions = [...text.matchAll(new RegExp(d === '.' ? '\\.' : d, 'g'))].map(m => m.index!);
      if (!positions.length) return text;
      const p = rng.pick(positions);
      return text.slice(0, p) + text.slice(p + 1);
    }
    case 4: { // duplicate one delimiter
      const d = rng.pick(DELIMS);
      const p = text.indexOf(d, at);
      return p < 0 ? text : text.slice(0, p) + d + text.slice(p);
    }
    case 5: { // insert a random line
      const i = rng.int(lines.length + 1);
      return [...lines.slice(0, i), rng.pick(GARBAGE_LINES), ...lines.slice(i)].join('\n');
    }
    case 6: { // duplicate a line (duplicate rows, repeated tags)
      const i = rng.int(lines.length);
      return [...lines.slice(0, i + 1), lines[i], ...lines.slice(i + 1)].join('\n');
    }
    case 7: { // swap two lines
      const copy = [...lines];
      const i = rng.int(copy.length);
      const j = rng.int(copy.length);
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy.join('\n');
    }
    case 8: { // flip a byte in the UTF-8 encoding (may become invalid UTF-8 → U+FFFD)
      const bytes = new TextEncoder().encode(text);
      if (!bytes.length) return text;
      bytes[rng.int(bytes.length)] ^= 1 << rng.int(8);
      return new TextDecoder('utf-8').decode(bytes);
    }
    default: { // change a digit (dates, amounts)
      const digits = [...text.matchAll(/\d/g)].map(m => m.index!);
      if (!digits.length) return text;
      const p = rng.pick(digits);
      return text.slice(0, p) + String(rng.int(10)) + text.slice(p + 1);
    }
  }
}

function mutate(text: string, rng: Rng): string {
  let out = text;
  const times = 1 + rng.int(3);
  for (let i = 0; i < times; i++) out = mutateOnce(out, rng);
  return out;
}

interface BankLine { date: string; amountCents: number; description: string; type?: string }

function assertValidLines(lines: readonly BankLine[], label: string) {
  assert.ok(Array.isArray(lines) && lines.length > 0, `${label}: a returned statement has at least one line`);
  for (const [i, line] of lines.entries()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(line.date);
    assert.ok(m && bankStatementDate(Number(m[1]), Number(m[2]), Number(m[3])) === line.date, `${label}: line ${i + 1} has a real date (${line.date})`);
    assert.ok(Number.isSafeInteger(line.amountCents), `${label}: line ${i + 1} amount is integer cents (${line.amountCents})`);
    assert.equal(typeof line.description, 'string');
    assert.ok(line.description.trim().length > 0, `${label}: line ${i + 1} has a description`);
    if (line.type !== undefined) assert.equal(line.type, line.amountCents < 0 ? 'debit' : 'credit', `${label}: line ${i + 1} direction matches its sign`);
  }
}

interface Target {
  name: string;
  seeds: string[];
  /** Runs the parser the way the app does; returns rows, or throws. */
  run: (text: string) => unknown;
  /** Checks a returned (non-throwing) result for the mutated input. */
  check: (result: unknown, text: string, label: string) => void;
}

const statement = (count: (text: string) => number | null) => (result: unknown, text: string, label: string) => {
  const lines = result as BankLine[];
  assertValidLines(lines, label);
  const expected = count(text);
  if (expected !== null) assert.equal(lines.length, expected, `${label}: every transaction in the file is returned (none silently dropped)`);
};

const GENERIC_CSV: Array<[string, BankCsvMapping]> = [
  ['bank-us-comma.csv', { date: 0, description: 1, amount: 2, debit: -1, credit: -1, skipRows: 1 }],
  ['bank-eu-semicolon.csv', { date: 0, description: 1, amount: 2, debit: -1, credit: -1, skipRows: 1 }],
  ['bank-bom-debit-credit.csv', { date: 0, description: 1, amount: -1, debit: 2, credit: 3, skipRows: 1 }],
];

function recordImport(kind: ImportKind, quickBooks: boolean) {
  return (text: string) => {
    assertReadableText(text);
    const cells = parseCsvChecked(text);
    const table = quickBooks ? normalizeQuickBooksCsv(kind, cells) : cells;
    if (table.length < 2) throw new Error('The file needs a header row and at least one row of data.');
    const dataRows = table.slice(1);
    return { rows: dataRows.length, prepared: prepareImport(kind, applyMapping(kind, dataRows, guessMapping(kind, table[0]))) };
  };
}
const checkRecords = (result: unknown, _text: string, label: string) => {
  const { rows, prepared } = result as { rows: number; prepared: ReturnType<typeof prepareImport> };
  const covered = new Set([...prepared.records.map(r => r.row), ...prepared.errors.map(e => e.row)]);
  for (let row = 2; row < rows + 2; row++) assert.ok(covered.has(row), `${label}: row ${row} is either imported or reported, never dropped`);
  for (const issue of prepared.errors) assert.ok(issue.message.trim().length > 0, `${label}: every problem has a message`);
  for (const record of prepared.records) {
    for (const [key, value] of Object.entries(record.data)) {
      if (/Cents$|quantityAtHand|reorderPoint/.test(key)) assert.ok(Number.isSafeInteger(value), `${label}: ${key} is a safe integer (${String(value)})`);
    }
    assert.ok(String(record.data.name ?? '').trim(), `${label}: every record has a name`);
  }
};

const countTag = (pattern: RegExp) => (text: string) => (text.match(pattern) || []).length;

const TARGETS: Target[] = [
  {
    name: 'OFX / QFX', seeds: [corpus('ofx1-sgml.ofx'), corpus('ofx2-xml.ofx'), corpus('card.qfx')],
    run: text => parseOFXStatement(text, /<CURDEF>\s*EUR/i.test(text) ? 'EUR' : 'USD'),
    check: statement(countTag(/<STMTTRN(?:\s[^<>]*)?>/gi)),
  },
  {
    name: 'CAMT.053', seeds: [corpus('camt053.xml')],
    run: text => parseCamt053Import(text, 'EUR'),
    check: statement(countTag(/<(?:[A-Za-z_][\w.-]*:)?Ntry(?:\s[^<>]*)?>/gi)),
  },
  {
    name: 'QIF', seeds: [bankFixture('checking-mdy.qif')],
    run: text => parseQIFStatement(text, 'mdy'),
    check: statement(text => text.split(/\r\n|\n|\r/).filter(line => line.trim() === '^').length),
  },
  {
    name: 'BAI2', seeds: [bankFixture('checking.bai2')],
    run: text => parseBAI2Statement(text, 'USD'),
    check: statement(() => null),
  },
  {
    name: 'US bank CSV', seeds: ['us-chase-checking.csv', 'us-boa-checking.csv', 'us-wells-fargo.csv'].map(bankFixture),
    run: text => {
      assertReadableText(text);
      const format: UsBankCsvFormat = /^Details,/i.test(text) ? 'chase-checking' : /Running Bal/i.test(text) ? 'boa-checking' : 'wells-fargo-checking';
      return parseUsBankCsv(text, format);
    },
    check: statement(() => null),
  },
  ...GENERIC_CSV.map(([file, mapping]): Target => ({
    name: `bank CSV column mapping (${file})`, seeds: [corpus(file)],
    run: text => {
      assertReadableText(text);
      return mapBankCsvRows(parseCsvChecked(text), mapping);
    },
    check: statement(text => parseCsvChecked(text).length - 1),
  })),
  { name: 'QuickBooks customers CSV', seeds: [corpus('quickbooks-customers.csv')], run: recordImport('customers', true), check: checkRecords },
  { name: 'QuickBooks items CSV', seeds: [corpus('quickbooks-items.csv')], run: recordImport('items', true), check: checkRecords },
  { name: 'Xero chart of accounts CSV', seeds: [corpus('xero-accounts.csv')], run: recordImport('accounts', false), check: checkRecords },
];

for (const [index, target] of TARGETS.entries()) {
  test(`PREV-6 fuzz: ${target.name} returns a complete valid result or refuses with a message`, () => {
    // The unmutated seeds must parse; otherwise the fuzz cases would only exercise refusals.
    for (const seed of target.seeds) target.check(target.run(seed), seed, `${target.name} seed`);
    const rng = prng(SEED + index);
    let accepted = 0;
    let refused = 0;
    for (let i = 0; i < CASES; i++) {
      const text = mutate(rng.pick(target.seeds), rng);
      const label = `${target.name} case ${i} (seed ${SEED + index})`;
      const started = performance.now();
      let result: unknown;
      let error: unknown;
      try {
        result = target.run(text);
      } catch (err) {
        error = err;
      }
      const elapsed = performance.now() - started;
      assert.ok(elapsed < SLOW_CASE_MS, `${label}: took ${elapsed.toFixed(0)} ms`);
      if (error !== undefined) {
        assert.ok(error instanceof Error && error.constructor === Error, `${label}: refused with a plain Error, got ${String(error)}\n${JSON.stringify(text)}`);
        assert.ok(error.message.trim().length >= 10, `${label}: the refusal explains itself: ${error.message}`);
        refused++;
      } else {
        target.check(result, text, `${label}\n${JSON.stringify(text)}\n`);
        accepted++;
      }
    }
    assert.equal(accepted + refused, CASES);
    assert.ok(refused > 0, `${target.name}: some mutations are refused`);
  });
}
