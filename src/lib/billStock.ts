/**
 * Buying stock on a bill (J-08): a bill line can name an inventory item and how many units came in.
 * Such a line posts to the workspace's Inventory account, and the bill's entry carries the item lines
 * (`metadata.stockIn`: the item, the units, and the value the line posted, in the workspace's
 * currency). The server raises the stock and the item's average cost with the entry, in the same
 * transaction, and undoing the entry takes them out again (src/server/services/cogsStockService.ts).
 */
export const BILL_ACCRUAL_TYPE = 'bill-accrual';

export interface BillStockLine {
  itemId: string;
  quantity: number;
  /** what the line posted to Inventory, whole cents in the workspace's currency */
  valueCents: number;
  /** its place among the bill's lines */
  line: number;
}

/** Why a bill line with an item can't be saved, or null. */
export function billItemProblem(line: { itemId?: string; quantity?: number; amountCents?: number }): string | null {
  if (!line.itemId) return null;
  const q = Number(line.quantity);
  if (!Number.isFinite(q) || q <= 0) return 'Enter how many units came in';
  if (Math.round(q * 1e6) / 1e6 !== q) return 'Six decimals at most for the units';
  if (!(Number(line.amountCents) > 0)) return 'Enter what the units cost';
  return null;
}

/** The item lines of a bill, with the share of the posted amount each line got (same order as its lines). */
export function billStockLines(splits: Array<{ itemId?: string; quantity?: number }> | undefined, shares: number[]): BillStockLine[] {
  return (splits || []).flatMap((s, line) => (s.itemId && Number(s.quantity) > 0
    ? [{ itemId: s.itemId, quantity: Number(s.quantity), valueCents: shares[line] || 0, line }]
    : []));
}
