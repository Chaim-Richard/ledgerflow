/**
 * PREV-6: the "Other CSV" bank statement path (column mapping in StatementImporter), as a pure
 * function. A file is taken whole or refused whole: a row whose date, amount or description
 * cannot be read, or whose cell count differs from the header (a comma inside an unquoted
 * description shifts the amount column), refuses the file with the row numbers, so a statement
 * is never imported with some rows silently left out.
 *
 * Amounts: "1,234.56", "1.234,56", "-12,50" (comma decimal, as in semicolon exports), "(12.50)",
 * "$12.50", "12.50-". More than two decimals, or text, is refused; nothing is rounded.
 * Dates: YYYY-MM-DD (optionally with a time), YYYY/MM/DD, M/D/YYYY, D.M.YYYY and month-name dates
 * such as "Oct 12, 2026"; the date must exist on the calendar.
 */
import { bankStatementDate } from './bankStatementDate';
import { normalizeDateString } from './dateParsing';

export interface BankCsvMapping {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  payee?: number;
  memo?: number;
  skipRows?: number;
}

export interface BankCsvRow {
  date: string;
  description: string;
  amountCents: number;
  _originalDate: string;
}

const MAX_WHOLE_DIGITS = 13;
const LISTED_PROBLEMS = 5;

/**
 * Text read from an upload as UTF-8. A replacement character means the bytes were not UTF-8
 * (a Windows-1252 / Latin-1 "Café" loses its "é"); NUL characters mean UTF-16 ("Unicode text").
 * Either way descriptions would be stored garbled, so the file is refused.
 */
export function assertReadableText(content: string, what = 'The file'): void {
  if (content.includes('\u0000')) {
    throw new Error(`${what} looks like UTF-16 or binary data, not text. Save or export it as UTF-8 CSV and upload it again. Nothing was imported.`);
  }
  if (content.includes('\uFFFD')) {
    throw new Error(`${what} is not UTF-8 text (it may be saved as Windows-1252 or Latin-1). Save or export it as UTF-8 and upload it again. Nothing was imported.`);
  }
}

/** Bank CSV amount text → integer cents, or null when it is not an unambiguous amount. */
export function bankCsvAmountCents(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.trim().replace(/[\s\u00a0\u202f'\u2019]/g, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  // one leading currency sign, after an optional sign (a second sign is left in, so the amount is refused)
  s = s.replace(/^([+-]?)[$€£₪]/, '$1');
  s = s.replace(/^([+-]?\d[\d.,]*)[$€£₪]$/, '$1');
  if (s.endsWith('-') && !s.startsWith('-')) { negative = !negative; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  let whole: string;
  let fraction: string;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/))) [, whole, fraction = ''] = m;
  else if ((m = s.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/))) { whole = m[1].replace(/,/g, ''); fraction = m[2] || ''; }
  else if ((m = s.match(/^(\d+),(\d{1,2})$/))) [, whole, fraction] = m;
  else if ((m = s.match(/^(\d{1,3}(?:\.\d{3})+),(\d{1,2})$/))) { whole = m[1].replace(/\./g, ''); fraction = m[2]; }
  else return null;
  whole = whole.replace(/^0+(?=\d)/, '');
  if (whole.length > MAX_WHOLE_DIGITS) return null;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative && cents !== 0 ? -cents : cents;
}

/** Bank CSV date text → YYYY-MM-DD, or '' when it is not a real calendar date. */
export function bankCsvDate(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (m) return bankStatementDate(Number(m[1]), Number(m[2]), Number(m[3])) ?? '';
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return bankStatementDate(Number(m[3]), Number(m[2]), Number(m[1])) ?? '';
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!m && !(/\p{L}{3}/u.test(s) && /\b\d{4}\b/.test(s))) return '';
  const normalized = normalizeDateString(s);
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? bankStatementDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? '' : '';
}

/**
 * Mapped CSV rows → statement lines, all of them or an Error naming the rows that cannot be
 * read. `rows` is the parsed file including any header rows (mapping.skipRows, default 1).
 */
export function mapBankCsvRows(rows: readonly (readonly string[])[], mapping: BankCsvMapping): BankCsvRow[] {
  const skip = Math.max(0, Math.trunc(mapping.skipRows ?? 1));
  const hasAmount = mapping.amount >= 0;
  const hasDebitCredit = mapping.debit >= 0 && mapping.credit >= 0;
  if (mapping.date < 0 || mapping.description < 0 || (!hasAmount && !hasDebitCredit)) {
    throw new Error('Please map Date, Description, and either Amount OR Debit & Credit.');
  }
  const data = rows.slice(skip);
  if (!data.length) throw new Error('The file has no transaction rows under the header. Nothing was imported.');
  const width = (rows[skip - 1] ?? rows[0]).length;
  const problems: string[] = [];
  const result: BankCsvRow[] = [];
  data.forEach((row, index) => {
    const rowNumber = skip + index + 1;
    const extra = row.slice(width).some(cell => cell.trim() !== '');
    if (extra) {
      problems.push(`row ${rowNumber} has ${row.length} cells but the header has ${width} (a comma inside an unquoted description?)`);
      return;
    }
    const cell = (column: number | undefined) => (column !== undefined && column >= 0 ? row[column] : undefined);
    let amountCents: number | null;
    if (hasAmount) {
      amountCents = bankCsvAmountCents(cell(mapping.amount));
    } else {
      const debitCell = cell(mapping.debit)?.trim() ?? '';
      const creditCell = cell(mapping.credit)?.trim() ?? '';
      const debit = debitCell ? bankCsvAmountCents(debitCell) : 0;
      const credit = creditCell ? bankCsvAmountCents(creditCell) : 0;
      // A debit column holds the money going out, whether the bank writes it as 12.50 or -12.50.
      amountCents = (!debitCell && !creditCell) || debit === null || credit === null ? null : credit - Math.abs(debit);
    }
    const rawDate = cell(mapping.date) ?? '';
    const date = bankCsvDate(rawDate);
    const description = [cell(mapping.description), cell(mapping.payee), cell(mapping.memo)]
      .map(part => part?.trim() ?? '').filter(Boolean).join(' - ');
    const issues = [
      !date && (rawDate.trim() ? `the date "${rawDate.trim().slice(0, 30)}" is not a real date` : 'the date is empty'),
      amountCents === null && 'the amount is empty or not a number with at most two decimals',
      !description && 'the description is empty',
    ].filter(Boolean);
    if (issues.length || amountCents === null) {
      problems.push(`row ${rowNumber}: ${issues.join(', ')}`);
      return;
    }
    result.push({ date, description, amountCents, _originalDate: rawDate });
  });
  if (problems.length) {
    const shown = problems.slice(0, LISTED_PROBLEMS).join('; ');
    const more = problems.length > LISTED_PROBLEMS ? `; and ${problems.length - LISTED_PROBLEMS} more` : '';
    throw new Error(`${problems.length} row(s) cannot be read, so nothing was imported: ${shown}${more}. Fix the file or the column mapping and try again.`);
  }
  return result;
}
