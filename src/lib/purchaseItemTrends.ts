/**
 * A-20: monthly item purchases, using the existing item-wise bill register (not a new allocation
 * formula). Stored line amounts stay in their document currency; currencies are never added.
 * These are gross purchases, not net stock costs: freight-only lines, vendor credits, document tax
 * and discount reallocation are outside this register. See billStock for posted inventory costs.
 */
import type { Bill, InventoryItem } from '../types';
import { purchaseRegister } from './itemRegister';
import { isOpeningBalanceDocument } from './partyOpeningBalance';
import { addToDateISO } from './utils';
import { validCustomReportPeriod } from './reportCustomPeriod';

export interface PurchaseItemTrend {
  id: string;
  month: string;
  itemId: string;
  name: string;
  currency: string;
  quantity: number;
  cents: number;
  /** Number of item lines, not the number of unique bills. */
  lines: number;
}

export function purchaseTrendStart(endDate: string): string {
  if (!validCustomReportPeriod({ startDate: endDate, endDate })) throw new Error('Choose a valid report end date.');
  return addToDateISO(`${endDate.slice(0, 7)}-01`, { months: -11 });
}

export function purchaseItemTrends(items: InventoryItem[], bills: Bill[], endDate: string, homeCurrency = 'USD'): PurchaseItemTrend[] {
  const from = purchaseTrendStart(endDate);
  const names = new Map(items.map(item => [item.id, item.name]));
  const register = purchaseRegister(bills.filter(bill => !isOpeningBalanceDocument(bill)), id => names.get(id) || '', from, endDate);
  const grouped = new Map<string, PurchaseItemTrend>();
  for (const line of register) {
    const month = line.date.slice(0, 7);
    const currency = String(line.currency || homeCurrency).toUpperCase();
    // Stable IDs and currency form identity, not a normalized display name (including Hebrew).
    const id = JSON.stringify([month, line.itemId, currency]);
    const row = grouped.get(id) || {
      id, month, itemId: line.itemId, name: line.itemName || line.itemId, currency,
      quantity: 0, cents: 0, lines: 0,
    };
    if (!names.get(line.itemId) && row.name === line.itemId && line.itemName) row.name = line.itemName;
    row.quantity += line.quantity;
    row.cents += line.amountCents;
    row.lines += 1;
    grouped.set(id, row);
  }
  return [...grouped.values()]
    .map(row => ({ ...row, quantity: Math.round(row.quantity * 1e6) / 1e6 }))
    .sort((a, b) => a.month.localeCompare(b.month) || a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId) || a.currency.localeCompare(b.currency));
}

export const PURCHASE_ITEM_CSV_HEADERS = ['Window', 'Month', 'Item ID', 'Item', 'Currency', 'Units', 'Line amount (minor units)', 'Item lines'];
export function purchaseItemCsvRows(rows: Array<PurchaseItemTrend & { period: string }>): Array<Array<string | number>> {
  return rows.map(row => [row.period, row.month, row.itemId, row.name, row.currency, row.quantity, row.cents, row.lines]);
}
