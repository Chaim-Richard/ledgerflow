/**
 * A-71: vendor price history. Read-only: what one item actually cost from one vendor over time,
 * taken from the bill lines the books already hold (the bill's own recorded unit cost, not a
 * catalogue price):
 *
 * - one point per bill line that names an item and has units, in the bill's date order;
 * - the unit cost is the line amount divided by its units, in whole minor units (the same
 *   `unitCostCents` the vendor scorecard uses), so the report and the scorecard cannot disagree;
 * - prices are compared only inside one currency, and never added across currencies;
 * - draft, void, cancelled and rejected bills are left out: they are not purchases;
 * - the change percent is the last unit cost against the first, and is undefined (not zero) when
 *   the first unit cost is zero.
 *
 * Nothing here posts, edits a bill or changes how a bill is calculated.
 */
import type { Bill, InventoryItem, Vendor } from '../types';
import { unitCostCents } from './vendorScorecard';

/** A bill status that shows a purchase actually made; drafts and voided bills are not prices paid. */
const NOT_A_PURCHASE = new Set(['draft', 'void', 'cancelled', 'rejected']);

export interface VendorPricePoint {
  date: string;
  documentId: string;
  documentNumber?: string;
  quantity: number;
  amountCents: number;
  unitCents: number;
}

export interface VendorPriceRow {
  vendorId: string;
  vendorName: string;
  itemId: string;
  itemName: string;
  sku?: string;
  currency: string;
  points: VendorPricePoint[];
  firstUnitCents: number;
  lastUnitCents: number;
  minUnitCents: number;
  maxUnitCents: number;
  /** how many times the unit cost moved between two purchases */
  changes: number;
  /** last against first, in percent to two decimals; undefined when the first unit cost is zero */
  changePercent?: number;
  units: number;
  totalCents: number;
  firstDate: string;
  lastDate: string;
}

export interface VendorPriceHistoryInput {
  bills: Array<Pick<Bill, 'id' | 'vendorId' | 'number' | 'date' | 'currency' | 'status' | 'splits'>>;
  vendors: Array<Pick<Vendor, 'id' | 'name'>>;
  items?: Array<Pick<InventoryItem, 'id' | 'name' | 'sku'>>;
  /** one vendor only; omitted means every vendor */
  vendorId?: string;
  /** one item only; omitted means every item */
  itemId?: string;
  /** inclusive window on the bill dates (YYYY-MM-DD); an omitted side is open */
  from?: string;
  to?: string;
  homeCurrency?: string;
}

/** How the last price compares with the first: never invented when there is only one point. */
export function priceTrend(row: VendorPriceRow): 'up' | 'down' | 'flat' | 'single' {
  if (row.points.length < 2) return 'single';
  if (row.lastUnitCents > row.firstUnitCents) return 'up';
  if (row.lastUnitCents < row.firstUnitCents) return 'down';
  return 'flat';
}

export function vendorPriceHistory(input: VendorPriceHistoryInput): VendorPriceRow[] {
  const home = input.homeCurrency || 'USD';
  const vendorNames = new Map(input.vendors.map(vendor => [vendor.id, vendor.name]));
  const itemNames = new Map((input.items || []).map(item => [item.id, item]));
  const series = new Map<string, VendorPriceRow>();

  const dated = input.bills
    .map(bill => ({ bill, date: (bill.date || '').slice(0, 10) }))
    .filter(({ bill, date }) => !!date && !NOT_A_PURCHASE.has(bill.status))
    .filter(({ bill }) => !input.vendorId || bill.vendorId === input.vendorId)
    .filter(({ date }) => (!input.from || date >= input.from) && (!input.to || date <= input.to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.bill.id.localeCompare(b.bill.id));

  for (const { bill, date } of dated) {
    const currency = bill.currency || home;
    for (const split of bill.splits || []) {
      const itemId = split.itemId;
      if (!itemId || (input.itemId && itemId !== input.itemId)) continue;
      const unit = unitCostCents(split.amountCents, split.quantity ?? 0);
      if (unit === undefined) continue;
      const key = `${bill.vendorId}\u0000${itemId}\u0000${currency}`;
      const item = itemNames.get(itemId);
      let row = series.get(key);
      if (!row) {
        row = {
          vendorId: bill.vendorId,
          vendorName: vendorNames.get(bill.vendorId) || 'Unknown vendor',
          itemId,
          itemName: item?.name || split.description || 'Unknown item',
          sku: item?.sku,
          currency,
          points: [],
          firstUnitCents: unit,
          lastUnitCents: unit,
          minUnitCents: unit,
          maxUnitCents: unit,
          changes: 0,
          units: 0,
          totalCents: 0,
          firstDate: date,
          lastDate: date,
        };
        series.set(key, row);
      }
      if (unit !== row.lastUnitCents) row.changes += 1;
      row.points.push({ date, documentId: bill.id, documentNumber: bill.number, quantity: split.quantity ?? 0, amountCents: split.amountCents, unitCents: unit });
      row.lastUnitCents = unit;
      row.minUnitCents = Math.min(row.minUnitCents, unit);
      row.maxUnitCents = Math.max(row.maxUnitCents, unit);
      row.units += split.quantity ?? 0;
      row.totalCents += split.amountCents;
      row.lastDate = date;
    }
  }

  return [...series.values()]
    .map(row => ({
      ...row,
      ...(row.points.length > 1 && row.firstUnitCents > 0
        ? { changePercent: Math.round(((row.lastUnitCents - row.firstUnitCents) / row.firstUnitCents) * 10000) / 100 }
        : {}),
    }))
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName) || a.itemName.localeCompare(b.itemName) || a.currency.localeCompare(b.currency));
}

export const VENDOR_PRICE_HISTORY_CSV_HEADERS = [
  'Vendor', 'Item', 'SKU', 'Currency', 'Date', 'Document', 'Quantity', 'Line amount (minor units)',
  'Unit cost (minor units)', 'Change (%)', 'First unit cost (minor units)', 'Last unit cost (minor units)',
  'Lowest unit cost (minor units)', 'Highest unit cost (minor units)', 'Price changes', 'Total units', 'Total amount (minor units)',
];

/** One CSV row per price point, with the item's summary repeated; an item with no points is not listed. */
export function vendorPriceHistoryCsvRows(rows: VendorPriceRow[]): Array<Array<string | number>> {
  return rows.flatMap(row => row.points.map(point => [
    row.vendorName, row.itemName, row.sku || '', row.currency, point.date, point.documentNumber || point.documentId,
    point.quantity, point.amountCents, point.unitCents, row.changePercent ?? '',
    row.firstUnitCents, row.lastUnitCents, row.minUnitCents, row.maxUnitCents, row.changes, row.units, row.totalCents,
  ]));
}
