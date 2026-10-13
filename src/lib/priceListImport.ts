/**
 * A-80: import price lists from a spreadsheet (CSV). One row per item and list: the item's SKU,
 * the list's name, and its price (or the list's discount). Read first, then applied on a confirmed
 * preview, with the previous lists kept so the import can be undone, like the other imports.
 *
 * Columns (any order, headers matched without case or spacing): Item (the SKU, required), List
 * (required), Price (a decimal amount, up to two places, in the list's currency), Discount % (a
 * percentage for the whole list; given on any row of the list), Currency (a three-letter code;
 * none means the home currency), Customers (not read here: customers are chosen on the list).
 * Rows that cannot be read are reported with their line number and left out; the rest still import.
 */
import { parseCsv } from './csv';
import { priceListsProblem, PRICE_LIST_CURRENCY, type PriceList } from './priceLists';

export interface PriceListImportRow {
  /** the record number in the file: the header is record 1; blank lines are skipped and not counted */
  line: number;
  itemId: string;
  list: string;
  priceCents?: number;
  discountPercent?: number;
  currency?: string;
}

export interface PriceListImportProblem {
  /** the record number in the file (see PriceListImportRow.line) */
  line: number;
  message: string;
}

export interface PriceListImportReadResult {
  rows: PriceListImportRow[];
  problems: PriceListImportProblem[];
  headerProblem?: string;
}

const headerKey = (text: string) => text.normalize('NFC').toLocaleLowerCase().replace(/[\s_]+/g, '');
const COLUMNS = { item: ['item', 'sku'], list: ['list', 'pricelist'], price: ['price'], discount: ['discount%', 'discount'], currency: ['currency'] } as const;

/** A decimal amount with at most two places, in whole cents; null when it is not one. */
export function parseMoneyCents(text: string): number | null {
  const value = text.trim().replace(/\s/g, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ''] = value.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Reads the CSV text. Items are matched to the SKUs the caller passes. */
export function readPriceListCsv(text: string, items: Array<{ id: string; sku: string }>): PriceListImportReadResult {
  const table = parseCsv(String(text || '').replace(/^\uFEFF/, ''));
  const header = (table[0] || []).map(headerKey);
  const find = (names: readonly string[]) => header.findIndex(h => (names as readonly string[]).includes(h));
  const at = { item: find(COLUMNS.item), list: find(COLUMNS.list), price: find(COLUMNS.price), discount: find(COLUMNS.discount), currency: find(COLUMNS.currency) };
  if (at.item < 0 || at.list < 0 || (at.price < 0 && at.discount < 0)) {
    return { rows: [], problems: [], headerProblem: 'The first row needs the columns Item, List and Price (or Discount %).' };
  }
  const bySku = new Map<string, string>();
  const dupes = new Set<string>();
  for (const item of items) {
    const key = item.sku.trim().toLocaleLowerCase();
    if (bySku.has(key)) dupes.add(key);
    bySku.set(key, item.id);
  }
  const rows: PriceListImportRow[] = [];
  const problems: PriceListImportProblem[] = [];
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    if (cells.every(c => !String(c || '').trim())) return;
    const sku = String(cells[at.item] || '').trim();
    const list = String(cells[at.list] || '').trim();
    if (!sku) return problems.push({ line, message: 'The item (SKU) is empty' });
    if (!list) return problems.push({ line, message: 'The list name is empty' });
    const key = sku.toLocaleLowerCase();
    if (dupes.has(key)) return problems.push({ line, message: `The SKU “${sku}” is on more than one item` });
    const itemId = bySku.get(key);
    if (!itemId) return problems.push({ line, message: `No item has the SKU “${sku}”` });
    const row: PriceListImportRow = { line, itemId, list };
    if (at.price >= 0 && String(cells[at.price] || '').trim()) {
      const cents = parseMoneyCents(String(cells[at.price]));
      if (cents === null) return problems.push({ line, message: `The price “${cells[at.price]}” is not an amount (up to two decimals)` });
      row.priceCents = cents;
    }
    if (at.discount >= 0 && String(cells[at.discount] || '').trim()) {
      const d = Number(String(cells[at.discount]).replace('%', '').trim());
      if (!Number.isFinite(d) || d <= 0 || d >= 100) return problems.push({ line, message: 'The discount is a percentage above 0 and below 100' });
      row.discountPercent = d;
    }
    if (row.priceCents === undefined && row.discountPercent === undefined) return problems.push({ line, message: 'Give a price or a discount for this row' });
    if (at.currency >= 0 && String(cells[at.currency] || '').trim()) {
      const code = String(cells[at.currency]).trim().toUpperCase();
      if (!PRICE_LIST_CURRENCY.test(code)) return problems.push({ line, message: `The currency “${cells[at.currency]}” is not a three-letter code` });
      row.currency = code;
    }
    rows.push(row);
  });
  return { rows, problems };
}

export interface PriceListImportPlan {
  /** the lists after the import (the existing lists, changed or added to) */
  lists: PriceList[];
  /** the lists as they were, to restore on undo */
  previous: PriceList[];
  createdLists: number;
  pricesSet: number;
  /** why the result cannot be saved (for example a customer on two lists in one currency), or null */
  problem: string | null;
}

/**
 * Applies read rows to the lists. A list is matched by name (case and spacing ignored) and in the
 * same currency as its rows; an unknown name becomes a new list (with no customers yet). Prices
 * are set per item; a discount sets the list's discount. The result is checked with the same rules
 * the price-list screen uses.
 */
export function planPriceListImport(lists: PriceList[], rows: PriceListImportRow[], newListId: (index: number) => string, homeCurrency = 'USD'): PriceListImportPlan {
  const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const next: PriceList[] = lists.map(l => ({ ...l, prices: { ...(l.prices || {}) } }));
  let created = 0;
  let pricesSet = 0;
  for (const row of rows) {
    const currency = row.currency || homeCurrency;
    let target = next.find(l => norm(l.name) === norm(row.list) && (l.currency || homeCurrency) === currency);
    if (!target) {
      created += 1;
      target = { id: newListId(created), name: row.list, prices: {}, ...(row.currency ? { currency: row.currency } : {}) };
      next.push(target);
    }
    if (row.discountPercent !== undefined) target.discountPercent = row.discountPercent;
    if (row.priceCents !== undefined) {
      target.prices = { ...(target.prices || {}), [row.itemId]: row.priceCents };
      pricesSet += 1;
    }
  }
  return { lists: next, previous: lists, createdLists: created, pricesSet, problem: priceListsProblem(next, homeCurrency) };
}
