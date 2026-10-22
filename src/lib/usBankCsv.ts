/**
 * E-27: opt-in parsers for *specific* US bank CSV export layouts.
 * Date/order/sign cannot be guessed from a headerless file. No posting, lookup
 * or rate conversion happens here; outputs feed the existing review stage.
 */
import { parseCsvChecked } from './csv';
import { bankStatementDate } from './bankStatementDate';
import type { ParsedBankLine } from './mt940Parser';

export type UsBankCsvFormat =
  | 'chase-checking' | 'chase-card'
  | 'boa-checking' | 'boa-card'
  | 'wells-fargo-checking';

const formatHeaders: Record<Exclude<UsBankCsvFormat, 'wells-fargo-checking'>, string[]> = {
  'chase-checking': ['details', 'posting date', 'description', 'amount', 'type', 'balance', 'check or slip #'],
  'chase-card': ['transaction date', 'post date', 'description', 'category', 'type', 'amount'],
  'boa-checking': ['date', 'description', 'amount', 'running bal.'],
  'boa-card': ['posted date', 'reference number', 'payee', 'address', 'amount'],
};

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.]/g, '');
const matches = (row: string[], expected: string[], optionalMemo = false): boolean => {
  const a = row.map(normalizeHeader);
  const b = expected.map(normalizeHeader);
  return (a.length === b.length || (optionalMemo && a.length === b.length + 1 && a[a.length - 1] === 'memo'))
    && b.every((column, i) => a[i] === column);
};
const fail = (name: string, row: number, message: string): never => {
  throw new Error(`${name} CSV row ${row}: ${message}`);
};
function day(value: string, name: string, row: number): string {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return fail(name, row, 'Expected an unambiguous MM/DD/YYYY date.');
  const iso = bankStatementDate(Number(m[3]), Number(m[1]), Number(m[2]));
  if (!iso) return fail(name, row, 'Invalid calendar date.');
  return iso;
}
function amount(value: string, name: string, row: number): number {
  const input = value.trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(input))
    return fail(name, row, 'Amount must be signed decimal with at most two places.');
  const negative = input.startsWith('-');
  const [whole, fraction = ''] = input.replace(/^[+-]/, '').replace(/,/g, '').split('.');
  if (whole.length > 14) return fail(name, row, 'Amount exceeds the safe cent range.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents === 0n || cents > BigInt(Number.MAX_SAFE_INTEGER))
    return fail(name, row, 'Amount is zero or exceeds the safe cent range.');
  return Number(negative ? -cents : cents);
}
function line(
  date: string, amountCents: number, description: string, name: string, row: number, reference?: string,
): ParsedBankLine {
  if (!description.trim()) return fail(name, row, 'Missing transaction description.');
  return {
    date, amountCents, description: description.trim(),
    ...(reference?.trim() ? { reference: reference.trim() } : {}),
    type: amountCents < 0 ? 'debit' : 'credit',
  };
}
function headerRow(rows: string[][], format: UsBankCsvFormat): number {
  const expected = formatHeaders[format as Exclude<UsBankCsvFormat, 'wells-fargo-checking'>];
  const found = rows.findIndex(r => matches(r, expected, format === 'chase-card'));
  if (found === -1) return fail(format, 1, 'Required bank export header not found. Choose the correct bank layout or use manual CSV mapping.');
  if (format !== 'boa-checking' && found !== 0)
    return fail(format, 1, 'Unexpected rows before the CSV header.');
  if (format === 'boa-checking') {
    // BofA checking may prepend an account summary. Never treat those balances
    // or a different unknown preamble as transactions.
    for (let i = 0; i < found; i++) {
      const description = (rows[i][0] || '').trim();
      if (!/^(Description|Beginning balance as of|Ending balance as of|Total credits|Total debits)$/i.test(description) &&
          !/^(Beginning balance as of|Ending balance as of)\s+/i.test(description))
        return fail(format, i + 1, 'Unexpected line before the transaction header.');
    }
  }
  return found;
}

/** Read-only parsed candidates. Caller must display the existing import preview before saving. */
export function parseUsBankCsv(content: string, format: UsBankCsvFormat): ParsedBankLine[] {
  if (content.length > 12_000_000) throw new Error('Bank CSV exceeds the 12 MB import limit.');
  if (!Object.prototype.hasOwnProperty.call({
    'chase-checking': 1, 'chase-card': 1, 'boa-checking': 1, 'boa-card': 1, 'wells-fargo-checking': 1,
  }, format)) throw new Error('Choose a supported US bank CSV layout.');
  const rows = parseCsvChecked(content);
  if (rows.length > 50001) throw new Error('Bank CSV exceeds the 50,000-row preview limit.');
  const result: ParsedBankLine[] = [];
  if (format === 'wells-fargo-checking') {
    // Wells Fargo download has NO header. This format is never auto-selected.
    for (const [index, r] of rows.entries()) {
      const n = index + 1;
      if (r.length !== 5 || r[2] !== '*' || (r[3] !== '' && !/^\d+$/.test(r[3])))
        return fail(format, n, 'Expected five Wells Fargo columns (date, signed amount, *, check number, description).');
      result.push(line(day(r[0], format, n), amount(r[1], format, n), r[4], format, n, r[3]));
    }
  } else {
    const start = headerRow(rows, format);
    for (let i = start + 1; i < rows.length; i++) {
      const r = rows[i];
      const n = i + 1;
      if (!matches(r, formatHeaders[format], format === 'chase-card')) {
        // Header widths are known; unequal widths are not safe to guess.
        if (r.length !== formatHeaders[format].length && !(format === 'chase-card' && r.length === 7))
          return fail(format, n, 'Column count differs from the bank export header.');
      }
      if (format === 'boa-checking' && /^Beginning balance as of\b/i.test(r[1]) && !r[2].trim()) continue;
      if (format === 'chase-checking') {
        const value = amount(r[3], format, n);
        const direction = r[0].trim().toUpperCase();
        if (direction !== 'DEBIT' && direction !== 'CREDIT')
          return fail(format, n, 'Unknown Chase DEBIT/CREDIT marker.');
        if ((direction === 'DEBIT' && value > 0) || (direction === 'CREDIT' && value < 0))
          return fail(format, n, 'DEBIT/CREDIT marker disagrees with signed amount.');
        result.push(line(day(r[1], format, n), value, r[2], format, n, r[6]));
      } else if (format === 'chase-card') {
        result.push(line(day(r[1], format, n), amount(r[5], format, n), r[2], format, n));
      } else if (format === 'boa-checking') {
        result.push(line(day(r[0], format, n), amount(r[2], format, n), r[1], format, n));
      } else {
        result.push(line(day(r[0], format, n), amount(r[4], format, n), r[2], format, n, r[1]));
      }
    }
  }
  if (!result.length) return fail(format, 1, 'No transactions found.');
  return result;
}
