/**
 * The stock-moves ledger (W-02): one record for every change to an item's quantity on hand, kept by
 * the server with the change itself (src/server/services/stockMoveService.ts). It says what moved,
 * when, why (a sale, its reversal, a purchase, opening stock, an adjustment, a count), at what cost,
 * and which entry and document it belongs to. Each record keeps the quantity before and after, so
 * the history explains the item's quantity on hand; `stockHistoryProblem` says when it does not.
 * Pure: the Stock history window and the nightly check read it.
 */

export type StockMoveKind = 'sale' | 'sale-reversal' | 'return' | 'return-reversal' | 'purchase' | 'purchase-reversal' | 'opening' | 'adjustment' | 'count' | 'manual-cogs' | 'transfer-out' | 'transfer-in';

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
  documentType?: 'invoice' | 'credit-note' | 'adjustment' | 'import' | 'delivery' | 'bill';
  documentId?: string;
  /** the order the moves happened in: the time written, then the place in that write */
  seq: string;
  /** W-01: where the units are (a Location label value); none = no location */
  locationId?: string;
  uid: string;
  createdAt: string;
}

export const STOCK_MOVE_LABEL: Record<StockMoveKind, string> = {
  sale: 'Sold',
  'sale-reversal': 'Sale undone',
  return: 'Returned by the customer',
  'return-reversal': 'Return undone',
  purchase: 'Bought',
  'purchase-reversal': 'Purchase undone',
  opening: 'Opening stock',
  adjustment: 'Adjusted',
  count: 'Counted',
  'manual-cogs': 'Cost of goods sold recorded',
  'transfer-out': 'Moved out',
  'transfer-in': 'Moved in',
};

/** W-01: the stock with no location (made before locations were used, or never placed). */
export const NO_LOCATION = '';

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

/**
 * W-01: how many units are at each location, from the history. Stock the history starts with (from
 * before it was kept) and moves without a location count as "no location". The total is the item's
 * quantity on hand when the history explains it.
 */
export function stockByLocation(moves: StockMove[]): Map<string, number> {
  const ordered = orderedMoves(moves);
  const at = new Map<string, number>();
  if (ordered.length === 0) return at;
  const add = (where: string, n: number) => at.set(where, round6((at.get(where) || 0) + n));
  if (ordered[0].quantityBefore) add(NO_LOCATION, ordered[0].quantityBefore);
  for (const m of ordered) add(m.locationId || NO_LOCATION, m.quantity);
  for (const [where, n] of at) if (n === 0) at.delete(where);
  return at;
}

/** Why units can't be moved between locations, or null. */
export function transferProblem(input: { quantity: number; from: string; to: string }, at: Map<string, number>): string | null {
  if (input.from === input.to) return 'Choose two different locations';
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || round6(input.quantity) !== input.quantity) return 'Enter how many to move (more than zero)';
  const there = at.get(input.from) || 0;
  if (input.quantity > there) return `Only ${there} ${input.from ? `at ${input.from}` : 'without a location'}`;
  return null;
}

/** J-10: one item's movements in a period, between its opening and closing quantity and value. */
export interface ItemDetails {
  itemId: string;
  itemName: string;
  opening: { quantity: number; valueCents: number };
  moves: Array<Pick<StockMove, 'date' | 'kind' | 'quantity' | 'quantityAfter' | 'valueCents' | 'unitCostCents' | 'transactionId' | 'documentType' | 'documentId' | 'locationId'> & { key: string }>;
  received: number;
  issued: number;
  closing: { quantity: number; valueCents: number };
}

/**
 * Inventory item details (J-10) from the stock-moves ledger: for each item with stock or a movement
 * in the period, its opening quantity and value (everything before the start), every movement in
 * the period in the order it happened, what came in and went out, and its closing quantity and value.
 * The closing quantity is the last movement's quantity after, so it agrees with Stock history.
 */
export function itemDetails(moves: StockMove[], startDate: string, endDate: string): ItemDetails[] {
  const byItem = new Map<string, StockMove[]>();
  for (const m of moves) byItem.set(m.itemId, [...(byItem.get(m.itemId) || []), m]);
  const out: ItemDetails[] = [];
  for (const [itemId, list] of byItem) {
    const ordered = orderedMoves(list).filter(m => String(m.date).slice(0, 10) <= endDate);
    const before = ordered.filter(m => String(m.date).slice(0, 10) < startDate);
    const within = ordered.filter(m => String(m.date).slice(0, 10) >= startDate);
    const value = (ms: StockMove[]) => ms.reduce((s, m) => s + (Number(m.valueCents) || 0), 0);
    const opening = { quantity: before.length ? round6(Number(before[before.length - 1].quantityAfter) || 0) : 0, valueCents: value(before) };
    if (within.length === 0 && opening.quantity === 0 && opening.valueCents === 0) continue;
    const last = ordered[ordered.length - 1];
    out.push({
      itemId,
      itemName: String(list.find(m => m.itemName)?.itemName || itemId),
      opening,
      moves: within.map((m, i) => ({
        key: m.id || `${m.seq}-${i}`, date: String(m.date).slice(0, 10), kind: m.kind, quantity: m.quantity, quantityAfter: m.quantityAfter, valueCents: m.valueCents, unitCostCents: m.unitCostCents,
        ...(m.transactionId ? { transactionId: m.transactionId } : {}), ...(m.documentType ? { documentType: m.documentType } : {}), ...(m.documentId ? { documentId: m.documentId } : {}),
        ...(m.locationId ? { locationId: m.locationId } : {}),
      })),
      received: round6(within.filter(m => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)),
      issued: round6(-within.filter(m => m.quantity < 0).reduce((s, m) => s + m.quantity, 0)) || 0,
      closing: { quantity: round6(Number(last?.quantityAfter) || 0), valueCents: value(ordered) },
    });
  }
  return out.sort((a, b) => a.itemName.localeCompare(b.itemName));
}

/** J-08: what was bought of each item in the period (purchases on bills or on Inventory, less those undone). */
export function purchasesByItem(items: ItemDetails[]): Array<{ itemId: string; itemName: string; quantity: number; valueCents: number; averageCents: number }> {
  return items.map(item => {
    const bought = item.moves.filter(m => m.kind === 'purchase' || m.kind === 'purchase-reversal');
    const quantity = round6(bought.reduce((s, m) => s + m.quantity, 0));
    const valueCents = bought.reduce((s, m) => s + m.valueCents, 0);
    return { itemId: item.itemId, itemName: item.itemName, quantity, valueCents, averageCents: quantity > 0 ? Math.round(valueCents / quantity) : 0 };
  }).filter(p => p.quantity !== 0 || p.valueCents !== 0);
}
