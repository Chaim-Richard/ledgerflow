/**
 * A-192: inventory turnover by item. Read-only, from the stock-moves ledger alone (the server's
 * item details, src/lib/stockMoves.ts `itemDetails`): for a chosen period, what each item sold,
 * what it held on average, and how many times that average stock turned over.
 *
 * The figures, exactly:
 * - sold: the net quantity of the sale kinds of move (sale, sale-reversal, return,
 *   return-reversal) — a returned unit nets against the sale that sent it out; stock that left
 *   for another reason (a count adjustment, a purchase return) is in "issued", never in "sold".
 * - cost of what sold: the value those same moves took out of stock, in the base currency — the
 *   stock ledger's own value, the same one Inventory Valuation and Stock Aging read.
 * - average stock: (opening + closing) ÷ 2, in units and in value. That is a two-point average,
 *   said plainly on the screen; it is not a daily average.
 * - turnover: sold ÷ average units (and cost of what sold ÷ average value). When the average is
 *   zero or negative, or nothing sold, the turnover is "not applicable" (null), never zero and
 *   never infinite. Negative opening or closing stock is named on the row instead of hidden in
 *   the average.
 * - days of stock: the period's days ÷ the units turnover — about how long the average stock
 *   would last at this period's selling pace.
 */
import type { ItemDetails } from './stockMoves';

const SALE_KINDS = new Set(['sale', 'sale-reversal', 'return', 'return-reversal']);
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export interface TurnoverRow {
  itemId: string;
  itemName: string;
  openingQty: number;
  closingQty: number;
  averageQty: number;
  receivedQty: number;
  issuedQty: number;
  soldQty: number;
  costOfSoldCents: number;
  openingValueCents: number;
  closingValueCents: number;
  averageValueCents: number;
  turnoverUnits: number | null;
  turnoverValue: number | null;
  daysOfStock: number | null;
  /** 'negative-stock' when opening or closing is below zero */
  note: '' | 'negative-stock';
}

/** Whole days from one YYYY-MM-DD to another (civil dates; end − start). */
function dayDiff(startDate: string, endDate: string): number {
  const days = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return days(endDate) - days(startDate);
}

export function inventoryTurnover(details: readonly ItemDetails[], startDate: string, endDate: string): TurnoverRow[] {
  const periodDays = Math.max(1, dayDiff(startDate, endDate) + 1);
  const rows: TurnoverRow[] = details.map(item => {
    let soldRaw = 0;
    let costRaw = 0;
    for (const move of item.moves) {
      if (!SALE_KINDS.has(move.kind)) continue;
      soldRaw += Number(move.quantity) || 0;
      costRaw += Number(move.valueCents) || 0;
    }
    const soldQty = round4(-soldRaw) || 0;
    const costOfSoldCents = -costRaw || 0;
    const openingQty = round4(item.opening.quantity);
    const closingQty = round4(item.closing.quantity);
    const averageQty = round4((openingQty + closingQty) / 2);
    const averageValueCents = Math.round((item.opening.valueCents + item.closing.valueCents) / 2);
    const turnoverUnits = averageQty > 0 && soldQty > 0 ? round4(soldQty / averageQty) : null;
    const turnoverValue = averageValueCents > 0 && costOfSoldCents > 0 ? round4(costOfSoldCents / averageValueCents) : null;
    return {
      itemId: item.itemId,
      itemName: item.itemName,
      openingQty,
      closingQty,
      averageQty,
      receivedQty: round4(item.received),
      issuedQty: round4(item.issued),
      soldQty,
      costOfSoldCents,
      openingValueCents: item.opening.valueCents,
      closingValueCents: item.closing.valueCents,
      averageValueCents,
      turnoverUnits,
      turnoverValue,
      daysOfStock: turnoverUnits ? Math.round((periodDays / turnoverUnits) * 10) / 10 : null,
      note: openingQty < 0 || closingQty < 0 ? 'negative-stock' as const : '' as const,
    };
  });
  // fastest turning first; items with nothing to divide by keep their facts at the end, by name
  return rows.sort((a, b) =>
    (b.turnoverUnits ?? -1) - (a.turnoverUnits ?? -1) || a.itemName.localeCompare(b.itemName));
}

export const TURNOVER_CSV_HEADERS = [
  'Item', 'Opening units', 'Received units', 'Issued units (all reasons)', 'Sold units (net of returns)',
  'Closing units', 'Average units', 'Cost of what sold (minor units)', 'Opening value (minor units)',
  'Closing value (minor units)', 'Average value (minor units)', 'Turnover (units)', 'Turnover (value)',
  'Days of stock at this pace', 'Note',
] as const;

export function turnoverCsvRows(rows: readonly TurnoverRow[]): Array<Array<string | number>> {
  return rows.map(r => [
    r.itemName, r.openingQty, r.receivedQty, r.issuedQty, r.soldQty, r.closingQty, r.averageQty,
    r.costOfSoldCents, r.openingValueCents, r.closingValueCents, r.averageValueCents,
    r.turnoverUnits ?? '', r.turnoverValue ?? '', r.daysOfStock ?? '',
    r.note === 'negative-stock' ? 'Stock was negative at the start or end of the period' : '',
  ]);
}
