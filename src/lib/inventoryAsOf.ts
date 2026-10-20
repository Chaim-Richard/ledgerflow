/**
 * ISS-131: the stock on hand and its value as of a past date, from the stock-moves ledger (W-02) — never today's
 * quantities and costs relabelled with an old date.
 *
 * The figures come from two readings of the same history (`itemDetails`, the server's `/reports/inventory-details`):
 * everything up to the date, and everything up to today. The value is the sum of the moves' own values (the cost each
 * move was booked at, moving weighted average), so a later cost edit or purchase does not change a past figure.
 *
 * An item's past figure is given only when its history explains it:
 *  - the history starts from zero (what came in less what went out equals where it ends), and
 *  - it ends at the item's quantity on hand today.
 * Otherwise the item is "unknown" with the reason — stock from before the history was kept, an item with stock and no
 * history, or a history that does not reach today's quantity — and is never shown as an exact zero. Pure.
 */
import type { ItemDetails } from './stockMoves';

export interface InventoryAsOfRow {
  itemId: string;
  name: string;
  /** null when the history does not explain the item */
  quantity: number | null;
  valueCents: number | null;
  unitCostCents: number | null;
  /** why the past figure is not known */
  unknownReason?: string;
}

export interface InventoryAsOf {
  asOf: string;
  rows: InventoryAsOfRow[];
  /** the value of the items whose past figure is known */
  knownValueCents: number;
  unknownItems: number;
  /** every item is known: the total is the stock's value on the date */
  complete: boolean;
  negativeStockItems: number;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function inventoryAsOf(input: {
  asOf: string;
  items: Array<{ id: string; name?: string; quantityAtHand?: number }>;
  /** `itemDetails` from the start of the history to the date */
  toDate: ItemDetails[];
  /** `itemDetails` from the start of the history to today */
  toToday: ItemDetails[];
}): InventoryAsOf {
  const atDate = new Map(input.toDate.map(d => [d.itemId, d]));
  const now = new Map(input.toToday.map(d => [d.itemId, d]));
  const ids = [...new Set([...input.items.map(i => i.id), ...input.toDate.map(d => d.itemId)])];
  const items = new Map(input.items.map(i => [i.id, i]));

  const rows = ids.map((itemId): InventoryAsOfRow => {
    const item = items.get(itemId);
    const name = item?.name || atDate.get(itemId)?.itemName || now.get(itemId)?.itemName || itemId;
    const onHand = round6(Number(item?.quantityAtHand) || 0);
    const today = now.get(itemId);
    const unknown = (unknownReason: string): InventoryAsOfRow => ({ itemId, name, quantity: null, valueCents: null, unitCostCents: null, unknownReason });
    if (!today) {
      // never moved: known only when there is nothing on hand today either
      if (onHand !== 0) return unknown(`${onHand} on hand today with no stock history, so its stock on ${input.asOf} is not known`);
    } else {
      const startsAt = round6(today.closing.quantity - (today.received - today.issued));
      if (startsAt !== 0) return unknown(`its stock history starts at ${startsAt} units (stock from before the history was kept)`);
      if (item && round6(today.closing.quantity) !== onHand) return unknown(`its stock history ends at ${today.closing.quantity}, but ${onHand} are on hand`);
    }
    const past = atDate.get(itemId);
    const quantity = past ? round6(past.closing.quantity) : 0;
    const valueCents = past ? Math.round(past.closing.valueCents) : 0;
    return {
      itemId, name, quantity,
      // negative stock is valued at 0, as the current valuation does
      valueCents: quantity > 0 ? valueCents : 0,
      unitCostCents: quantity > 0 ? Math.round(valueCents / quantity) : 0,
    };
  }).filter(r => r.quantity !== 0 || r.unknownReason || (r.valueCents ?? 0) !== 0);

  const known = rows.filter(r => r.quantity !== null);
  return {
    asOf: input.asOf,
    rows: rows.sort((a, b) => (b.valueCents ?? -1) - (a.valueCents ?? -1) || a.name.localeCompare(b.name)),
    knownValueCents: known.reduce((s, r) => s + (r.valueCents || 0), 0),
    unknownItems: rows.length - known.length,
    complete: known.length === rows.length,
    negativeStockItems: known.filter(r => (r.quantity || 0) < 0).length,
  };
}
