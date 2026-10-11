/**
 * A-9 (W-09) slow-moving stock. For each stock item on hand: the quantity and value on hand
 * (quantity × the item's unit cost, the figure the stock screen shows), the day it last sold, how
 * many days ago that was, and the age bucket that day count falls in. Read-only; posts nothing.
 *
 * Sales are the invoice lines that point at the item (`itemId`) on invoices that were issued:
 * drafts, estimates/quotes, voided, cancelled and rejected documents do not count. A sale dated
 * after the report day does not count either. Credit notes are not netted off (a return does not
 * make the item sold again); the stock-aging report (`stockAging`) is the first-in-first-out view.
 * Pure: the screen passes in the items and invoices it already holds.
 */

export const SLOW_MOVING_BUCKETS = [
  { key: '0-30', label: '0–30 days', maxDays: 30 },
  { key: '31-90', label: '31–90 days', maxDays: 90 },
  { key: '91-180', label: '91–180 days', maxDays: 180 },
  { key: '180+', label: 'More than 180 days', maxDays: Infinity },
  { key: 'never', label: 'Never sold', maxDays: Infinity },
] as const;

export type SlowMovingBucketKey = typeof SLOW_MOVING_BUCKETS[number]['key'];

export interface SlowMovingItemInput {
  id: string;
  name: string;
  sku?: string;
  quantityAtHand: number;
  unitCostCents: number;
  itemType?: 'stock' | 'service';
}

export interface SlowMovingInvoiceInput {
  date?: string;
  status: string;
  type?: string;
  items?: Array<{ itemId?: string; quantity: number }>;
}

export interface SlowMovingRow {
  itemId: string;
  name: string;
  sku: string;
  quantity: number;
  unitCostCents: number;
  valueCents: number;
  /** ISO day of the last issued sale, or null when never sold */
  lastSold: string | null;
  /** whole days from the last sale to the report day, or null when never sold */
  daysSinceSold: number | null;
  bucket: SlowMovingBucketKey;
}

const EXCLUDED_STATUSES = new Set(['draft', 'void', 'cancelled', 'rejected']);
const EXCLUDED_TYPES = new Set(['estimate', 'quote']);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from one ISO day to another (to − from), by calendar date (no time zone or DST effect). */
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** The bucket for a number of days since the last sale (null = never sold). A sale after the report day counts as 0 days. */
export function slowMovingBucket(daysSinceSold: number | null): SlowMovingBucketKey {
  if (daysSinceSold === null) return 'never';
  const days = Math.max(0, daysSinceSold);
  if (days <= 30) return '0-30';
  if (days <= 90) return '31-90';
  if (days <= 180) return '91-180';
  return '180+';
}

/** Last issued sale day per item, counting only sales dated on or before the report day. */
export function lastSaleDates(invoices: readonly SlowMovingInvoiceInput[], asOf: string): Map<string, string> {
  const last = new Map<string, string>();
  for (const inv of invoices) {
    if (EXCLUDED_STATUSES.has(inv.status) || (inv.type && EXCLUDED_TYPES.has(inv.type))) continue;
    if (!inv.date || !ISO_DAY.test(inv.date) || inv.date > asOf) continue;
    for (const line of inv.items || []) {
      if (!line.itemId || !(line.quantity > 0)) continue;
      const prev = last.get(line.itemId);
      if (!prev || inv.date > prev) last.set(line.itemId, inv.date);
    }
  }
  return last;
}

/**
 * The stock items with units on hand, with their value and last sale as of the report day.
 * Oldest first: never sold, then the longest time since a sale. Services and items with no stock are left out.
 */
export function slowMovingRows(items: readonly SlowMovingItemInput[], invoices: readonly SlowMovingInvoiceInput[], asOf: string): SlowMovingRow[] {
  const lastSold = lastSaleDates(invoices, asOf);
  const rows: SlowMovingRow[] = [];
  for (const item of items) {
    if (item.itemType === 'service' || !(item.quantityAtHand > 0)) continue;
    const last = lastSold.get(item.id) ?? null;
    const daysSinceSold = last ? daysBetween(last, asOf) : null;
    rows.push({
      itemId: item.id,
      name: item.name,
      sku: item.sku || '',
      quantity: item.quantityAtHand,
      unitCostCents: item.unitCostCents,
      valueCents: Math.round(item.quantityAtHand * item.unitCostCents),
      lastSold: last,
      daysSinceSold,
      bucket: slowMovingBucket(daysSinceSold),
    });
  }
  // never sold first, then the longest time since a sale
  return rows.sort((a, b) => {
    if (a.daysSinceSold === null && b.daysSinceSold === null) return a.name.localeCompare(b.name);
    if (a.daysSinceSold === null) return -1;
    if (b.daysSinceSold === null) return 1;
    return b.daysSinceSold - a.daysSinceSold || a.name.localeCompare(b.name);
  });
}

/** "No sale in N days": rows never sold, or last sold more than N days before the report day. */
export function noSaleInDays(rows: readonly SlowMovingRow[], days: number): SlowMovingRow[] {
  return rows.filter(r => r.daysSinceSold === null || r.daysSinceSold > days);
}

/** Value per bucket, for the totals line. */
export function slowMovingTotals(rows: readonly SlowMovingRow[]): Record<SlowMovingBucketKey, number> & { totalCents: number } {
  const out = { '0-30': 0, '31-90': 0, '91-180': 0, '180+': 0, never: 0, totalCents: 0 };
  for (const r of rows) {
    out[r.bucket] += r.valueCents;
    out.totalCents += r.valueCents;
  }
  return out;
}
