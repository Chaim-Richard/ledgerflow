/**
 * E-28: Xero invoice and bill exports → **draft** documents for review.
 *
 * A Xero "Sales invoices" or "Bills" CSV has one row per line item, with the invoice number and the
 * contact repeated on each row. This reader groups the rows back into documents, checks every number
 * twice (per line, then against the document total when the export carries one), and returns drafts
 * with `status: 'draft'` and `posted: false`. Nothing here posts, files, allocates or converts money:
 * a draft invoice and a draft bill post no ledger entries (see src/services/ledgerPost/invoicePosting.ts,
 * which returns before building any line when the status is `draft`).
 *
 * It never guesses:
 * - **columns by name**, not position (Xero's export column order differs by product and version);
 * - **the date order is the user's choice** (`dmy` / `mdy`); an ISO date is accepted as written; a date
 *   impossible in the chosen order is refused, never reinterpreted;
 * - a document with **no invoice number** is refused (nothing to trace or de-duplicate on);
 * - a **contact that is not in the workspace** is refused (import your customer/vendor list first);
 * - a line **without a known account code** is refused (a draft whose line has no account could never
 *   be sent, and picking one for you would be a classification decision);
 * - a **non-zero discount** is refused, because a Xero export's Discount column may be a percentage or
 *   an amount and the two read differently;
 * - a **foreign currency** document is refused when the workspace uses another currency (no conversion);
 * - a **voided** document is not imported;
 * - an **invoice number that already exists** is reported and skipped, never duplicated.
 *
 * Scope note (honest): Xero has more than one export layout. This reads the documented line-item
 * layout by header name; a file whose headers do not match must be exported again with the columns
 * listed in docs/XERO_DOCUMENTS_IMPORT.md, or entered by hand. It is not a claim that every Xero CSV
 * variant is supported.
 */
import { parseCsv } from './csv';
import { bankStatementDate } from './bankStatementDate';

export type XeroDocumentKind = 'invoices' | 'bills';
export type XeroDateOrder = 'dmy' | 'mdy';

/** One line of a draft document, in integer cents. */
export interface XeroDraftLine {
  description: string;
  /** Units, up to four decimal places (Xero allows fractional quantities). */
  quantity: number;
  unitAmountCents: number;
  /** quantity × unitAmount, rounded to the cent. */
  netCents: number;
  taxAmountCents: number;
  /** The Xero account code, already matched to a chart account by the screen. */
  accountCode: string;
  taxType?: string;
}

/** A document ready to be saved as a draft. It carries no id: saving assigns one. */
export interface XeroDraftDocument {
  kind: XeroDocumentKind;
  number: string;
  contactName: string;
  reference?: string;
  date: string;
  dueDate: string;
  currency?: string;
  sourceStatus?: string;
  lines: XeroDraftLine[];
  netCents: number;
  taxCents: number;
  totalCents: number;
  status: 'draft';
  posted: false;
  /** 1-based CSV line of the document's first row, so a message can point at it. */
  firstRow: number;
}

export interface XeroDocumentImportResult {
  documents: XeroDraftDocument[];
  /** Documents that were read but deliberately not imported, and why. */
  skipped: Array<{ number: string; row: number; reason: string }>;
  /** Header names actually used, so the screen can show what was read. */
  columns: Record<string, string>;
}

export interface XeroDocumentImportOptions {
  kind: XeroDocumentKind;
  dateOrder: XeroDateOrder;
  /** Workspace currency; a document in another currency is refused. */
  currency?: string;
  /** Invoice/bill numbers already in the workspace, to avoid creating a second copy. */
  existingNumbers?: readonly string[];
  /** Account codes in the workspace chart of accounts; a line outside it is refused. */
  accountCodes?: readonly string[];
}

const HEADERS = {
  number: ['invoicenumber', 'invoice number', 'billnumber', 'bill number', 'number', 'invoice no', 'invoiceid'],
  contact: ['contactname', 'contact name', 'contact', 'customername', 'suppliername', 'customer', 'supplier'],
  reference: ['reference', 'ref', 'invoice reference'],
  date: ['invoicedate', 'invoice date', 'date', 'issuedate', 'issue date', 'billdate', 'bill date'],
  dueDate: ['duedate', 'due date', 'due'],
  description: ['description', 'lineitemdescription', 'item description', 'details', 'narrative'],
  quantity: ['quantity', 'qty'],
  unitAmount: ['unitamount', 'unit amount', 'unitprice', 'unit price', 'rate', 'price'],
  accountCode: ['accountcode', 'account code', 'code'],
  taxAmount: ['taxamount', 'tax amount', 'vatamount'],
  taxType: ['taxtype', 'tax type', 'taxrate', 'tax rate'],
  currency: ['currency', 'currencycode', 'currency code'],
  status: ['status', 'invoicestatus', 'billstatus'],
  total: ['total', 'invoicetotal', 'billtotal', 'documenttotal'],
  discount: ['discount', 'discountamount', 'discount amount', 'discountpercent', 'discount percent'],
} as const;

/** Column names normalised: lower case, spaces and punctuation collapsed. */
function key(value: string): string {
  return String(value ?? '').replace(/["'`]/g, '').replace(/[\s_.\-/]+/g, ' ').trim().toLowerCase().replace(/ /g, '');
}

export function findColumn(header: string[], names: readonly string[]): number {
  const wanted = names.map(key);
  // exact match wins; then a header that starts with a name (e.g. "Currency code")
  const exact = header.findIndex(cell => wanted.includes(key(cell)));
  if (exact >= 0) return exact;
  return header.findIndex(cell => {
    const k = key(cell);
    return wanted.some(name => k === name || (name.length > 6 && k.startsWith(name)));
  });
}

function fail(row: number, message: string): never {
  throw new Error(`Xero CSV row ${row}: ${message}`);
}

/** `1,234.56`, `-12`, `(12.00)`, `₪`/`$` symbols ignored. Returns integer cents. */
export function xeroMoneyCents(value: string, row = 1): number {
  let input = String(value ?? '').trim();
  if (!input) return 0;
  input = input.replace(/[₪$€£¥]/g, '').replace(/\u00A0/g, ' ').trim();
  let negative = false;
  if (/^\(.*\)$/.test(input)) { negative = true; input = input.slice(1, -1).trim(); }
  if (input.startsWith('-')) { negative = !negative; input = input.slice(1).trim(); }
  if (input.startsWith('+')) input = input.slice(1).trim();
  if (!/^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^\d+(?:\.\d{1,2})?$/.test(input)) {
    return fail(row, `"${String(value ?? '').trim()}" is not an amount with at most two decimals.`);
  }
  const [whole, fraction = ''] = input.replace(/,/g, '').split('.');
  if (whole.length > 14) return fail(row, 'Amount exceeds the safe cent range.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return fail(row, 'Amount exceeds the safe cent range.');
  return Number(negative ? -cents : cents);
}

/** A quantity with up to four decimals, positive. Returned scaled by 10,000 as an integer. */
export function xeroQuantity(value: string, row = 1): number {
  const input = String(value ?? '').trim().replace(/,/g, '');
  if (!input) return 0;
  const match = input.match(/^(\d+)(?:\.(\d{1,4}))?$/);
  if (!match) return fail(row, `"${String(value ?? '').trim()}" is not a quantity with at most four decimals.`);
  const scaled = BigInt(match[1]) * 10_000n + BigInt((match[2] || '').padEnd(4, '0'));
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) return fail(row, 'Quantity is too large.');
  return Number(scaled);
}

/** quantity (×10,000) × unit price (cents) → cents, rounded half-up, exactly. */
function lineNetCents(quantityScaled: number, unitCents: number, row: number): number {
  const product = BigInt(quantityScaled) * BigInt(unitCents);
  const rounded = (product + 5_000n) / 10_000n;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER) || rounded < -BigInt(Number.MAX_SAFE_INTEGER)) {
    return fail(row, 'Line amount exceeds the safe cent range.');
  }
  return Number(rounded);
}

/** DD/MM/YYYY or MM/DD/YYYY under the chosen order; an ISO date is accepted as written. */
function parseDate(value: string, order: XeroDateOrder, row: number, what: string): string {
  const input = String(value ?? '').trim();
  if (!input) return fail(row, `Missing ${what}.`);
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const result = bankStatementDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (!result) return fail(row, `${what} "${input}" is not a real date.`);
    return result;
  }
  const match = input.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return fail(row, `${what} must be a full date with a four-digit year (like 31/12/2024).`);
  const first = Number(match[1]);
  const second = Number(match[2]);
  const day = order === 'dmy' ? first : second;
  const month = order === 'dmy' ? second : first;
  const result = bankStatementDate(Number(match[3]), month, day);
  if (!result) {
    return fail(row, `${what} "${input}" is not a real date in the chosen ${order === 'dmy' ? 'day/month/year' : 'month/day/year'} order.`);
  }
  return result;
}

const VOID_STATUSES = new Set(['voided', 'void', 'deleted']);

/**
 * Reads a Xero invoice or bill export into draft documents.
 * Throws on a file that cannot be read safely at all; individual documents that cannot be imported
 * are listed in `skipped` with the reason, so one bad invoice does not hide the rest.
 */
export function readXeroDocumentsCsv(content: string, options: XeroDocumentImportOptions): XeroDocumentImportResult {
  const { kind, dateOrder } = options;
  if (kind !== 'invoices' && kind !== 'bills') throw new Error('Choose invoices or bills before reading the file.');
  if (dateOrder !== 'dmy' && dateOrder !== 'mdy') throw new Error('Choose the date order in the file before reading it.');
  if (content.length > 12_000_000) throw new Error('The file exceeds the 12 MB import limit.');

  const rows = parseCsv(content);
  if (rows.length < 2) throw new Error('The file has no document rows below its header.');
  if (rows.length > 50_001) throw new Error('The file exceeds the 50,000-row import limit.');

  const header = rows[0].map(cell => String(cell ?? ''));
  const at = {
    number: findColumn(header, HEADERS.number),
    contact: findColumn(header, HEADERS.contact),
    reference: findColumn(header, HEADERS.reference),
    date: findColumn(header, HEADERS.date),
    dueDate: findColumn(header, HEADERS.dueDate),
    description: findColumn(header, HEADERS.description),
    quantity: findColumn(header, HEADERS.quantity),
    unitAmount: findColumn(header, HEADERS.unitAmount),
    accountCode: findColumn(header, HEADERS.accountCode),
    taxAmount: findColumn(header, HEADERS.taxAmount),
    taxType: findColumn(header, HEADERS.taxType),
    currency: findColumn(header, HEADERS.currency),
    status: findColumn(header, HEADERS.status),
    total: findColumn(header, HEADERS.total),
    discount: findColumn(header, HEADERS.discount),
  };

  for (const [field, label] of [
    ['number', 'invoice/bill number'], ['contact', 'contact name'], ['date', 'document date'],
    ['dueDate', 'due date'], ['description', 'description'], ['quantity', 'quantity'],
    ['unitAmount', 'unit amount'], ['accountCode', 'account code'],
  ] as const) {
    if (at[field] < 0) {
      throw new Error(`No ${label} column found. Re-export with the columns listed in docs/XERO_DOCUMENTS_IMPORT.md.`);
    }
  }

  const columns: Record<string, string> = {};
  for (const [field, index] of Object.entries(at)) {
    if (index >= 0) columns[field] = header[index].trim();
  }

  const existing = new Set((options.existingNumbers || []).map(number => number.trim().toLowerCase()).filter(Boolean));
  const knownAccounts = options.accountCodes && options.accountCodes.length
    ? new Set(options.accountCodes.map(code => code.trim()))
    : undefined;
  const workspaceCurrency = (options.currency || '').trim().toUpperCase();

  const documents: XeroDraftDocument[] = [];
  const skipped: XeroDocumentImportResult['skipped'] = [];
  /** Documents being built, in file order, so the output keeps the export's order. */
  const open = new Map<string, XeroDraftDocument>();
  /** The export's own total column, kept per document for the check after the whole file is read. */
  const rawTotals = new Map<string, Array<{ value: string; row: number }>>();

  const cell = (row: string[], index: number) => (index >= 0 ? String(row[index] ?? '').trim() : '');

  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 1;
    if (!row.some(value => String(value ?? '').trim())) continue;

    const number = cell(row, at.number);
    if (!number) return fail(rowNumber, 'Missing invoice/bill number. Every document must be traceable.');
    const contact = cell(row, at.contact);
    if (!contact) return fail(rowNumber, `Missing contact name on document ${number}.`);

    const existingDoc = open.get(number.toLowerCase());
    if (existingDoc && existingDoc.contactName.toLowerCase() !== contact.toLowerCase()) {
      return fail(rowNumber, `Document ${number} names two different contacts ("${existingDoc.contactName}" and "${contact}").`);
    }

    const currencyCell = cell(row, at.currency).toUpperCase();
    if (currencyCell && workspaceCurrency && currencyCell !== workspaceCurrency) {
      skipped.push({ number, row: rowNumber, reason: `in ${currencyCell} and this workspace keeps its books in ${workspaceCurrency}; no rate is guessed on import.` });
      // Still parse the rest so one foreign-currency invoice does not stop the file being read,
      // but never let it slip into the drafts.
      continue;
    }

    const sourceStatus = cell(row, at.status);
    if (VOID_STATUSES.has(sourceStatus.toLowerCase())) {
      skipped.push({ number, row: rowNumber, reason: `is ${sourceStatus} in Xero; a voided document is not imported.` });
      continue;
    }

    if (!existingDoc) {
      if (existing.has(number.toLowerCase())) {
        skipped.push({ number, row: rowNumber, reason: 'already exists in this workspace with that number; nothing was duplicated.' });
        continue;
      }
      const date = parseDate(cell(row, at.date), dateOrder, rowNumber, 'The document date');
      const dueDate = parseDate(cell(row, at.dueDate), dateOrder, rowNumber, 'The due date');
      if (dueDate < date) return fail(rowNumber, `The due date ${dueDate} is before the document date ${date}.`);
      const reference = cell(row, at.reference);
      const doc: XeroDraftDocument = {
        kind, number, contactName: contact,
        ...(reference ? { reference } : {}),
        date, dueDate,
        ...(currencyCell ? { currency: currencyCell } : {}),
        ...(sourceStatus ? { sourceStatus } : {}),
        lines: [], netCents: 0, taxCents: 0, totalCents: 0,
        status: 'draft', posted: false, firstRow: rowNumber,
      };
      open.set(number.toLowerCase(), doc);
      documents.push(doc);
    }

    const doc = open.get(number.toLowerCase())!;
    const description = cell(row, at.description);
    if (!description) return fail(rowNumber, `Missing line description on document ${number}.`);

    const discount = cell(row, at.discount);
    if (discount && xeroMoneyCents(discount, rowNumber) !== 0) {
      skipped.push({ number, row: rowNumber, reason: 'has a discount, and a Xero export does not say whether that column is a percentage or an amount.' });
      doc.lines = [];
      continue;
    }

    const accountCode = cell(row, at.accountCode);
    if (!accountCode) return fail(rowNumber, `Line "${description}" on ${number} has no account code.`);
    if (knownAccounts && !knownAccounts.has(accountCode)) {
      skipped.push({ number, row: rowNumber, reason: `uses account code ${accountCode}, which is not in this workspace's chart of accounts. Import the chart of accounts first (Settings → Import data → Accounts).` });
      doc.lines = [];
      continue;
    }

    const quantityScaled = xeroQuantity(cell(row, at.quantity), rowNumber);
    if (quantityScaled <= 0) return fail(rowNumber, `Line "${description}" on ${number} must have a positive quantity.`);
    const unitCents = xeroMoneyCents(cell(row, at.unitAmount), rowNumber);
    if (unitCents < 0) return fail(rowNumber, `Line "${description}" on ${number} has a negative unit amount.`);
    const netCents = lineNetCents(quantityScaled, unitCents, rowNumber);
    const taxCents = xeroMoneyCents(cell(row, at.taxAmount), rowNumber);
    if (taxCents < 0) return fail(rowNumber, `Line "${description}" on ${number} has a negative tax amount.`);

    const taxType = cell(row, at.taxType);
    const totalCell = cell(row, at.total);
    const line: XeroDraftLine = {
      description,
      quantity: quantityScaled / 10_000,
      unitAmountCents: unitCents,
      netCents,
      taxAmountCents: taxCents,
      accountCode,
      ...(taxType ? { taxType } : {}),
    };
    doc.lines.push(line);
    doc.netCents += netCents;
    doc.taxCents += taxCents;
    doc.totalCents += netCents + taxCents;
    if (totalCell) rawTotals.set(number.toLowerCase(), [...(rawTotals.get(number.toLowerCase()) || []), { value: totalCell, row: rowNumber }]);
  }

  // A document that lost all its lines (a refusal on any line) is not imported at all.
  for (let index = documents.length - 1; index >= 0; index--) {
    if (!documents[index].lines.length) documents.splice(index, 1);
  }

  /*
   * The export's own total column is checked last, when every line of every document is known.
   * Xero repeats either the document total on every row or a per-line total; both shapes are read
   * from the data itself (one repeated figure, or one figure per row), never assumed. A document
   * whose total disagrees with its lines is skipped, not imported: one of the two numbers is wrong
   * and either choice would be a guess.
   */
  const byNumber = new Map(documents.map(doc => [doc.number.toLowerCase(), doc]));
  const failed = new Set<string>();
  for (const [number, entries] of rawTotals) {
    const doc = byNumber.get(number);
    if (!doc || failed.has(number)) continue;
    const cents = entries.map(entry => xeroMoneyCents(entry.value, entry.row));
    const distinct = new Set(cents);
    let problem: string | undefined;
    if (distinct.size === 1) {
      // Every row repeats one figure: that is the document total, including a one-row document.
      if (cents[0] !== doc.totalCents) {
        problem = `the export's total is ${(cents[0] / 100).toFixed(2)} but its lines add up to ${(doc.totalCents / 100).toFixed(2)}`;
      }
    } else if (distinct.size === cents.length) {
      const expected = doc.lines.map(line => line.netCents + line.taxAmountCents);
      if (expected.length === cents.length && expected.some((value, i) => value !== cents[i])) {
        problem = "the export's line totals do not equal the line amounts plus tax";
      }
    } else if (distinct.size > 1) {
      problem = "the export's total column mixes a document total and line totals, so it cannot be checked";
    }
    if (problem) {
      failed.add(number);
      skipped.push({ number: doc.number, row: doc.firstRow, reason: `${problem}. Nothing from this document was imported.` });
    }
  }
  const imported = documents.filter(doc => !failed.has(doc.number.toLowerCase()));

  return { documents: imported, skipped: skipped.filter((entry, index, all) => all.findIndex(other => other.number === entry.number && other.reason === entry.reason) === index), columns };
}
