/**
 * E-26 / E-43: read an Israeli bank's account-activity CSV into the existing bank-import rows.
 *
 * Israeli exports do not share one file layout, so this reader identifies columns by their
 * header names (Hebrew and English) instead of trusting a column position or a bank name:
 *
 *   date · description · reference · debit · credit · balance      (two amount columns)
 *   date · description · reference · amount · balance              (one signed amount column)
 *
 * It never guesses:
 * - the date order is chosen by the user (day/month/year or month/day/year); a value that cannot
 *   exist in the chosen order is refused, it is not reinterpreted;
 * - a row must have exactly one of debit / credit (or one amount), never both and never neither;
 * - debit and credit cells are positive amounts; a signed value there is refused rather than
 *   silently reversed;
 * - a total, opening-balance or closing-balance line is refused, not imported as a transaction.
 *
 * Read-only: the result feeds the importer's existing review step. Nothing here posts, matches or
 * converts currency. Formats are transcribed from the column vocabulary of the banks' activity
 * exports (Hapoalim, Leumi, Discount, Mizrahi); a file whose headers differ must use the manual
 * column mapping instead. Verify against your own bank's current export before relying on it.
 */
import { parseCsv } from './csv';
import { bankStatementDate } from './bankStatementDate';
import type { ParsedBankLine } from './mt940Parser';

export type IsraeliBankDateOrder = 'dmy' | 'mdy';

export interface IsraeliBankColumnMap {
  /** What the header row called each column, so the review step can show what was used. */
  date: string;
  description: string;
  reference?: string;
  debit?: string;
  credit?: string;
  amount?: string;
  balance?: string;
  /** Two amount columns, or one signed amount column. */
  shape: 'debit-credit' | 'signed-amount';
}

export interface IsraeliBankCsvResult {
  lines: ParsedBankLine[];
  columns: IsraeliBankColumnMap;
}

/** Header names seen in Israeli activity exports. Normalised before matching (see `key`). */
const HEADERS = {
  date: ['תאריך', 'תאריך ערך', 'תאריך תנועה', 'תאריך פעולה', 'תאריך חיוב', 'date', 'value date', 'transaction date', 'posting date'],
  description: ['תיאור', 'תיאור התנועה', 'תיאור הפעולה', 'פירוט', 'פירוט התנועה', 'פירוט הפעולה', 'תוכן', 'description', 'details', 'narrative', 'memo', 'payee'],
  reference: ['אסמכתא', 'מספר אסמכתא', 'מס אסמכתא', 'אסמכתה', 'reference', 'ref', 'reference number', 'check number'],
  debit: ['חובה', 'חיוב', 'debit', 'withdrawal', 'withdrawals'],
  credit: ['זכות', 'זיכוי', 'credit', 'deposit', 'deposits'],
  amount: ['סכום', 'סכום התנועה', 'סכום הפעולה', 'amount', 'transaction amount'],
  balance: ['יתרה', 'יתרת סגירה', 'יתרה לאחר תנועה', 'balance', 'running balance'],
} as const;

/**
 * Summary lines that are not transactions; a dated row with one of these is refused.
 * Matched on the normalised description, by prefix, so Hebrew has no reliance on \b.
 */
const SUMMARY_PREFIXES = [
  'סהכ', 'סך הכל', 'סיכום', 'יתרת פתיחה', 'יתרת סגירה', 'יתרת ביניים', 'יתרה לאחר', 'יתרה',
  'total', 'totals', 'summary', 'opening balance', 'closing balance', 'balance brought forward',
  'balance carried forward',
];

/**
 * A header cell as a comparable key: trimmed, lower-cased, quotes and Hebrew gershayim/niqqud
 * removed, spaces and punctuation collapsed. "מספר אסמכתא" and `מספר  אסמכתא:` match.
 */
function key(value: string): string {
  return String(value ?? '')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/["'`״׳]/g, '')
    .replace(/[:.()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findColumn(header: string[], names: readonly string[]): number {
  const wanted = names.map(key);
  return header.findIndex(cell => wanted.includes(key(cell)));
}

function fail(row: number, message: string): never {
  throw new Error(`Israeli bank CSV row ${row}: ${message}`);
}

/**
 * Parses a `DD/MM/YYYY` (or `MM/DD/YYYY`) cell, also accepting `.` and `-` separators. A two-digit
 * year is refused: 01/02/03 has three readings and this reader never guesses.
 */
function parseDateCell(value: string, order: IsraeliBankDateOrder, row: number): string {
  const input = value.trim();
  if (!input) return fail(row, 'Missing transaction date.');
  const match = input.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return fail(row, 'Date must be a full date like 31/12/2024 with a four-digit year.');
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const day = order === 'dmy' ? first : second;
  const month = order === 'dmy' ? second : first;
  const iso = bankStatementDate(year, month, day);
  if (!iso) return fail(row, `Date ${input} is not a real date in the chosen ${order === 'dmy' ? 'day/month/year' : 'month/day/year'} order.`);
  return iso;
}

/**
 * A money cell in shekels: `1,234.56`, `-1,234.56`, `(1,234.56)`, `1234.56-`, with an optional
 * shekel sign or NIS/ILS prefix. Returns signed agorot.
 */
export function israeliAmountCents(value: string, row = 1): number {
  let input = String(value ?? '').trim();
  if (!input) return 0;
  input = input
    .replace(/(?:₪|ש"?ח|NIS|ILS)/gi, '')
    .replace(/\u00A0/g, ' ')
    .trim();
  let negative = false;
  if (/^\(.*\)$/.test(input)) { negative = true; input = input.slice(1, -1).trim(); }
  if (input.endsWith('-')) { negative = !negative; input = input.slice(0, -1).trim(); }
  if (input.startsWith('-')) { negative = !negative; input = input.slice(1).trim(); }
  if (input.startsWith('+')) input = input.slice(1).trim();
  if (!/^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^\d+(?:\.\d{1,2})?$/.test(input)) {
    return fail(row, 'Amount must be a shekel figure with at most two decimal places.');
  }
  const [whole, fraction = ''] = input.replace(/,/g, '').split('.');
  if (whole.length > 14) return fail(row, 'Amount exceeds the safe cent range.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return fail(row, 'Amount exceeds the safe cent range.');
  return Number(negative ? -cents : cents);
}

/** True when the row is a summary line rather than a transaction. */
export function isIsraeliSummaryRow(description: string): boolean {
  const text = key(description);
  return SUMMARY_PREFIXES.some(prefix => text === prefix || text.startsWith(prefix + ' ') || (prefix === 'יתרה' && text === 'יתרה'));
}

/**
 * Reads the CSV. `dateOrder` is required and is never inferred from the data.
 * Returns candidates only; the caller shows the import preview before anything is saved.
 */
export function readIsraeliBankCsv(content: string, dateOrder: IsraeliBankDateOrder): IsraeliBankCsvResult {
  if (dateOrder !== 'dmy' && dateOrder !== 'mdy') throw new Error('Choose the statement date order before uploading the file.');
  if (content.length > 12_000_000) throw new Error('Bank CSV exceeds the 12 MB import limit.');
  const rows = parseCsv(content);
  if (rows.length > 50_001) throw new Error('Bank CSV exceeds the 50,000-row preview limit.');
  if (rows.length < 2) throw new Error('The file has no transaction rows below its header.');

  const header = rows[0].map(cell => String(cell ?? ''));
  const date = findColumn(header, HEADERS.date);
  const description = findColumn(header, HEADERS.description);
  const reference = findColumn(header, HEADERS.reference);
  const debit = findColumn(header, HEADERS.debit);
  const credit = findColumn(header, HEADERS.credit);
  const amount = findColumn(header, HEADERS.amount);
  const balance = findColumn(header, HEADERS.balance);

  if (date < 0) throw new Error('No date column found. Use the manual column mapping for this file.');
  if (description < 0) throw new Error('No description column found. Use the manual column mapping for this file.');
  const hasTwoColumns = debit >= 0 && credit >= 0;
  const hasSignedAmount = amount >= 0 && !hasTwoColumns;
  if (hasTwoColumns && amount >= 0 && amount !== debit && amount !== credit) {
    throw new Error('The file has both debit/credit columns and a separate amount column; the layout is ambiguous. Use the manual column mapping.');
  }
  if (!hasTwoColumns && !hasSignedAmount) {
    throw new Error('Need either debit and credit columns, or one amount column. Use the manual column mapping for this file.');
  }

  const columns: IsraeliBankColumnMap = {
    date: header[date].trim(),
    description: header[description].trim(),
    ...(reference >= 0 ? { reference: header[reference].trim() } : {}),
    ...(hasTwoColumns ? { debit: header[debit].trim(), credit: header[credit].trim() } : {}),
    ...(!hasTwoColumns ? { amount: header[amount].trim() } : {}),
    ...(balance >= 0 ? { balance: header[balance].trim() } : {}),
    shape: hasTwoColumns ? 'debit-credit' : 'signed-amount',
  };

  const lines: ParsedBankLine[] = [];
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const number = index + 1;
    const cell = (column: number) => (column >= 0 ? String(row[column] ?? '').trim() : '');
    const dateCell = cell(date);
    const descriptionCell = cell(description);
    // A blank line is skipped; anything else with no date must be a recognised summary line.
    if (!dateCell) {
      if (!row.some(value => String(value ?? '').trim()) || isIsraeliSummaryRow(descriptionCell)) continue;
      return fail(number, 'No date on a row that is not a summary line.');
    }
    if (isIsraeliSummaryRow(descriptionCell)) {
      // A dated total cannot be told apart from a transaction safely; refuse instead of importing it.
      return fail(number, 'This looks like a total or balance line, not a transaction.');
    }
    const lineDate = parseDateCell(dateCell, dateOrder, number);
    let signed: number;
    if (hasTwoColumns) {
      const debitRaw = cell(debit);
      const creditRaw = cell(credit);
      const debitCents = israeliAmountCents(debitRaw, number);
      const creditCents = israeliAmountCents(creditRaw, number);
      if (debitRaw && creditRaw) return fail(number, 'Both a debit and a credit are filled in; the direction is ambiguous.');
      if (debitRaw && debitCents <= 0) return fail(number, 'A debit must be a positive amount in the debit column.');
      if (creditRaw && creditCents <= 0) return fail(number, 'A credit must be a positive amount in the credit column.');
      if (!debitRaw && !creditRaw) return fail(number, 'Neither a debit nor a credit amount is filled in.');
      signed = debitRaw ? -debitCents : creditCents;
    } else {
      const amountRaw = cell(amount);
      if (!amountRaw) return fail(number, 'Missing amount.');
      signed = israeliAmountCents(amountRaw, number);
      if (signed === 0) return fail(number, 'Amount is zero.');
    }
    if (!descriptionCell) return fail(number, 'Missing transaction description.');
    const referenceCell = cell(reference);
    lines.push({
      date: lineDate,
      amountCents: signed,
      description: descriptionCell,
      ...(referenceCell ? { reference: referenceCell } : {}),
      type: signed < 0 ? 'debit' : 'credit',
    });
  }
  if (!lines.length) return fail(1, 'No transactions found below the header.');
  return { lines, columns };
}
