/**
 * E-29: QuickBooks Desktop **IIF** (Intuit Interchange Format) → the existing validated record-import
 * tables (Settings → Import data). Lists only: accounts, customers, vendors, items.
 *
 * IIF is tab-separated. A line beginning with `!` is a section: `!ACCNT` followed by the column names
 * of that section, then one row per record starting with the same word. QuickBooks also writes
 * transaction sections (`!TRNS` / `!SPL` / `!ENDTRNS`) — journals, invoices, bills, payments.
 *
 * **Those are refused, not imported.** Importing them would post money through a list importer, which
 * is not what this path may do (posting belongs to the document paths, with their own validation). The
 * reader counts them and reports it, so the user is told rather than silently short-changed.
 *
 * Nothing here guesses: an account with an unrecognised QuickBooks type is reported with its line
 * number instead of being given a type, a row without a name is reported, and a section whose header
 * never appeared is reported.
 */
import type { ImportKind } from './recordImport';

export type IifKind = ImportKind;

export interface IifReadResult {
  /** Ready-to-import tables, one per kind: a header row plus records, in the app's own column names. */
  tables: Record<IifKind, string[][]>;
  counts: Record<IifKind, number>;
  /** Transaction records found and deliberately not imported (journals, invoices, bills, payments). */
  transactionsRefused: number;
  /** Rows and sections that could not be read, with the file line number and the reason. */
  skipped: Array<{ line: number; type: string; reason: string }>;
  /** Section words this reader does not import (e.g. `!CLASS`, `!BUD`), reported once each. */
  unknownSections: string[];
}

export const IIF_HEADERS: Record<IifKind, string[]> = {
  accounts: ['Name', 'Code', 'Type', 'Category', 'Subtype', 'Description', 'Currency'],
  customers: ['Name', 'Email', 'Phone', 'Address', 'Currency', 'Notes', 'Payment terms'],
  vendors: ['Name', 'Email', 'Phone', 'Category'],
  items: ['Name', 'SKU', 'Description', 'Sale price', 'Cost', 'Quantity on hand', 'Category'],
};

/**
 * QuickBooks Desktop account type codes → words the shared `parseAccountType` recognises.
 * A code that is not here is refused per row, never guessed.
 */
const ACCOUNT_TYPES: Record<string, string> = {
  BANK: 'Bank',
  AR: 'Accounts Receivable',
  AP: 'Accounts Payable',
  OCASSET: 'Other Current Asset',
  FIXASSET: 'Fixed Asset',
  OASSET: 'Other Asset',
  CCARD: 'Credit Card',
  OCLIAB: 'Other Current Liability',
  LTLIAB: 'Long Term Liability',
  EQUITY: 'Equity',
  INCOME: 'Income',
  COGS: 'Cost of Goods Sold',
  EXPENSE: 'Expense',
  OTHINCOME: 'Other Income',
  OTHEXPENSE: 'Other Expense',
};

const SECTION_KIND: Record<string, IifKind> = { ACCNT: 'accounts', CUST: 'customers', VEND: 'vendors', ITEM: 'items' };
const TRANSACTION_SECTIONS = new Set(['TRNS', 'SPL', 'ENDTRNS']);

const clean = (value: string | undefined): string => String(value ?? '').replace(/^"|"$/g, '').trim();

/** One IIF line → its cells, tab-separated (QuickBooks does not quote; a stray quote is trimmed). */
const cells = (line: string): string[] => line.split('\t');

/**
 * Reads an IIF file into import tables.
 * Throws only when the file is not IIF at all; everything else is reported in `skipped`.
 */
export function readIif(content: string): IifReadResult {
  if (!content.trim()) throw new Error('The file is empty.');
  const lines = content.split(/\r?\n/);
  const tables: Record<IifKind, string[][]> = {
    accounts: [IIF_HEADERS.accounts],
    customers: [IIF_HEADERS.customers],
    vendors: [IIF_HEADERS.vendors],
    items: [IIF_HEADERS.items],
  };
  const headers = new Map<string, string[]>();
  const skipped: IifReadResult['skipped'] = [];
  const unknownSections: string[] = [];
  let transactionsRefused = 0;
  let sawHeader = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    const parts = cells(line);
    const type = clean(parts[0]).toUpperCase();
    const lineNumber = index + 1;

    if (type === '!HDR') { sawHeader = true; continue; }

    // QuickBooks writes one record per transaction line: `TRNS` for the header, `SPL` for each split.
    // The `!TRNS`/`!SPL`/`!ENDTRNS` lines are only markers, so only real records are counted.
    if (type === 'TRNS' || type === 'SPL') { transactionsRefused++; continue; }
    if (TRANSACTION_SECTIONS.has(type.replace(/^!/, ''))) continue;

    if (type.startsWith('!')) {
      const name = type.slice(1);
      if (SECTION_KIND[name]) {
        // The section's own column names follow the section word; keep them for the data rows.
        headers.set(name, parts.slice(1).map(cell => clean(cell).toUpperCase()));
      } else if (!unknownSections.includes(type) && name !== 'HDR') {
        unknownSections.push(type);
      }
      continue;
    }

    const kind = SECTION_KIND[type];
    if (!kind) {
      // A data row of a section we do not import (a class, a budget…): reported, not imported.
      if (type && !unknownSections.includes(type)) unknownSections.push(type);
      continue;
    }
    const header = headers.get(type);
    if (!header) {
      skipped.push({ line: lineNumber, type, reason: `this ${type} row comes before its !${type} column header, so its fields cannot be read.` });
      continue;
    }

    const value = (name: string): string => {
      const position = header.indexOf(name);
      return position < 0 ? '' : clean(parts[position + 1]);
    };
    const name = value('NAME');
    if (!name) {
      skipped.push({ line: lineNumber, type, reason: `a ${type} row with no NAME was skipped; nothing could be identified to import.` });
      continue;
    }

    if (kind === 'accounts') {
      const rawType = value('ACCNTTYPE').toUpperCase();
      const accountType = ACCOUNT_TYPES[rawType];
      if (!accountType) {
        skipped.push({ line: lineNumber, type, reason: `account "${name}" has QuickBooks type "${rawType || '(empty)'}", which is not a recognised account type; it was not imported with a guessed type.` });
        continue;
      }
      tables.accounts.push([name, value('ACCNUM'), accountType, '', '', value('DESC'), '']);
      continue;
    }

    if (kind === 'customers') {
      const address = [value('BADDR1'), value('BADDR2'), value('BADDR3'), value('BADDR4'), value('BADDR5')]
        .filter(Boolean).join(', ');
      tables.customers.push([name, value('EMAIL'), value('PHONE1'), address, '', value('NOTE'), value('TERMS')]);
      continue;
    }

    if (kind === 'vendors') {
      tables.vendors.push([name, value('EMAIL'), value('PHONE1'), value('VTYPE')]);
      continue;
    }

    tables.items.push([
      name,
      value('SKU'),
      value('SALESDESC') || value('DESC'),
      value('PRICE'),
      value('COST'),
      '', // an IIF carries no reliable on-hand quantity, and a list import must not invent stock
      value('INVTYPE') || value('INVITEMTYPE'),
    ]);
  }

  if (!sawHeader && ![...headers.keys()].length) {
    throw new Error('This does not look like a QuickBooks IIF file: no !HDR and no list sections were found.');
  }

  const counts: Record<IifKind, number> = {
    accounts: tables.accounts.length - 1,
    customers: tables.customers.length - 1,
    vendors: tables.vendors.length - 1,
    items: tables.items.length - 1,
  };
  return { tables, counts, transactionsRefused, skipped, unknownSections };
}
