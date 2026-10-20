import type { ChartAccount, InventoryItem } from '../types';
import { resolveAccountRole } from './accountUtils';

/** Why stock changes (the server's /inventory/adjust `type`, plus a stock count). */
export type StockChangeKind = 'purchase' | 'opening' | 'adjustment' | 'count';

export const STOCK_CHANGE_LABELS: Record<Exclude<StockChangeKind, 'count'>, string> = {
  adjustment: 'Correction (damaged, lost, found)',
  purchase: 'Stock received (bought)',
  opening: 'Opening stock',
};

const active = (a: ChartAccount) => !a.isArchived;

/** Inventory asset accounts: where stock is valued. */
export function inventoryAccountsOf(accounts: ChartAccount[]): ChartAccount[] {
  return accounts.filter(a => active(a) && resolveAccountRole(a) === 'inventory');
}

/** Accounts a stock change can be booked against: every active account that is not an inventory account. */
export function offsetAccountChoices(accounts: ChartAccount[]): ChartAccount[] {
  return accounts.filter(a => active(a) && resolveAccountRole(a) !== 'inventory');
}

/**
 * The other side of a stock change, by kind:
 * - opening stock → Opening Balance Equity (else the first equity account)
 * - stock received → the first bank or cash account (paid now; pick Accounts Payable to pay later)
 * - correction or count → an expense named adjustment, shrinkage, variance, write-off or loss,
 *   else Cost of Goods Sold
 */
export function defaultOffsetAccount(accounts: ChartAccount[], kind: StockChangeKind): ChartAccount | undefined {
  const choices = offsetAccountChoices(accounts);
  const byRole = (role: string) => choices.filter(a => resolveAccountRole(a) === role);
  if (kind === 'opening') {
    const equity = byRole('equity');
    return equity.find(a => /opening/i.test(a.name || '')) || equity[0];
  }
  if (kind === 'purchase') return byRole('cash')[0] || byRole('ap')[0];
  const named = choices.find(a => ['expense', 'cogs'].includes(resolveAccountRole(a)) && /adjust|shrink|variance|write.?off|loss/i.test(a.name || ''));
  return named || byRole('cogs')[0];
}

/**
 * ISS-130: what revaluing stock on hand changes in the books, integer cents: the stock's value at the new cost less
 * its value at the old cost, each rounded the way Inventory Valuation rounds it (quantity × cost). Positive raises
 * the Inventory account. Zero quantity has nothing to revalue.
 */
export function revaluationValueCents(quantity: number, oldUnitCostCents: number, newUnitCostCents: number): number {
  return Math.round(quantity * (newUnitCostCents || 0)) - Math.round(quantity * (oldUnitCostCents || 0));
}

/** Value of a stock change at a unit cost, integer cents (positive = stock added). */
export function stockChangeValueCents(quantityChange: number, unitCostCents: number): number {
  return Math.round(quantityChange * (unitCostCents || 0));
}

export interface CountedRow {
  item: InventoryItem;
  counted: number;
  difference: number;
  valueCents: number;
}

/** The items whose counted quantity differs from the books, with the value of each difference. */
export function countDifferences(items: InventoryItem[], counted: Record<string, string>): CountedRow[] {
  return items.flatMap(item => {
    const raw = counted[item.id];
    if (raw === undefined || raw.trim() === '') return [];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return [];
    const difference = value - (item.quantityAtHand || 0);
    if (difference === 0) return [];
    return [{ item, counted: value, difference, valueCents: stockChangeValueCents(difference, item.unitCostCents || 0) }];
  });
}
