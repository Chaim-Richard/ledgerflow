/**
 * The stock-moves ledger (W-02): one record for every change to an item's quantity on hand, kept by
 * the server with the change itself (src/server/services/stockMoveService.ts). It says what moved,
 * when, why (a sale, its reversal, a purchase, opening stock, an adjustment, a count), at what cost,
 * and which entry and document it belongs to. Each record keeps the quantity before and after, so
 * the history explains the item's quantity on hand; `stockHistoryProblem` says when it does not.
 * Pure: the Stock history window and the nightly check read it.
 */

export type StockMoveKind = 'sale' | 'sale-reversal' | 'purchase' | 'opening' | 'adjustment' | 'count' | 'manual-cogs';

export interface StockMove {
  id?: string;
  workspaceId: string;
  itemId: string;
  itemName?: string;
  /** the day of the change (the entry's date) */
  date: string;
  kind: StockMoveKind;
  /** units added (positive) or taken out (negative) */
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCostCents: number;
  /** the value that moved, signed like the quantity (whole cents) */
  valueCents: number;
  transactionId?: string | null;
  documentType?: 'invoice' | 'adjustment' | 'import';
  documentId?: string;
  /** the order the moves happened in: the time written, then the place in that write */
  seq: string;
  uid: string;
  createdAt: string;
}

export const STOCK_MOVE_LABEL: Record<StockMoveKind, string> = {
  sale: 'Sold',
  'sale-reversal': 'Sale undone',
  purchase: 'Bought',
  opening: 'Opening stock',
  adjustment: 'Adjusted',
  count: 'Counted',
  'manual-cogs': 'Cost of goods sold recorded',
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The moves of one item in the order they happened. */
export function orderedMoves(moves: StockMove[]): StockMove[] {
  return [...moves].sort((a, b) => String(a.seq).localeCompare(String(b.seq)));
}

/**
 * Why the history does not explain the item's quantity, or null: a move that does not start where
 * the one before ended, or a last move that does not end at the quantity on hand. Items without a
 * history (made before W-02, or never moved) have nothing to explain.
 */
export function stockHistoryProblem(item: { name?: string; quantityAtHand?: number }, moves: StockMove[]): string | null {
  const ordered = orderedMoves(moves);
  if (ordered.length === 0) return null;
  for (let i = 1; i < ordered.length; i += 1) {
    if (round6(ordered[i].quantityBefore) !== round6(ordered[i - 1].quantityAfter)) {
      return `${item.name || 'This item'}: a change on ${ordered[i].date} starts at ${ordered[i].quantityBefore}, but the one before it ended at ${ordered[i - 1].quantityAfter}`;
    }
  }
  const last = ordered[ordered.length - 1];
  const onHand = Number(item.quantityAtHand) || 0;
  if (round6(last.quantityAfter) !== round6(onHand)) {
    return `${item.name || 'This item'}: ${onHand} on hand, but its history ends at ${last.quantityAfter}`;
  }
  return null;
}
