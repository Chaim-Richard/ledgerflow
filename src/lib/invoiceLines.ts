import type { InventoryItem } from '../types';
export { customerPricer } from './priceLists';
export { taxCodeToFillFromItem } from './itemTaxCode';

/** One line of the invoice form (amounts in integer cents). */
export interface InvoiceLineDraft {
  id: string;
  itemId?: string;
  description: string;
  quantity: number;
  rateCents: number;
  amountCents: number;
  accountId: string;
  taxRate?: number;
  unitCostCents?: number;
}

type ItemFields = Pick<InventoryItem, 'id' | 'name' | 'sku' | 'unitPriceCents' | 'unitCostCents' | 'itemType'>;

/** quantity × rate, rounded to whole cents. */
export function lineAmountCents(quantity: number, rateCents: number): number {
  const qty = Number.isFinite(quantity) ? quantity : 0;
  return Math.round(qty * rateCents);
}

/** The price of an item for this document's customer (M-11: their price list), when it differs */
export type ItemPricer = (item: { id: string; unitPriceCents: number }) => number;

/** Picked an inventory item: link it and fill its name, price (the customer's, when they have a price list) and cost; a service only fills the name and price. */
export function applyInventoryItem<L extends InvoiceLineDraft>(line: L, item: ItemFields, priceOf?: ItemPricer): L {
  const rateCents = priceOf ? priceOf(item) : item.unitPriceCents;
  // BF-01: a service fills the name and price only; unlinked, no stock moves and no cost is booked
  if (item.itemType === 'service') {
    return { ...line, itemId: undefined, description: item.name, rateCents, unitCostCents: undefined, amountCents: lineAmountCents(line.quantity, rateCents) };
  }
  return {
    ...line,
    itemId: item.id,
    description: item.name,
    rateCents,
    unitCostCents: item.unitCostCents,
    amountCents: lineAmountCents(line.quantity, rateCents),
  };
}

/** The item whose name or SKU is exactly the typed text, if any. */
export function findInventoryItem<I extends ItemFields>(items: I[], text: string): I | undefined {
  const t = text.trim();
  if (!t) return undefined;
  return items.find(i => i.name === t || (Boolean(i.sku) && i.sku === t));
}

/**
 * The description field changed: link the matching item, or turn the line into a free-text
 * line (unlinked, no cost) so a stale item link can't post the wrong cost of goods sold.
 */
export function setLineDescription<L extends InvoiceLineDraft>(line: L, text: string, items: ItemFields[], priceOf?: ItemPricer): L {
  const match = findInventoryItem(items, text);
  if (match) return applyInventoryItem(line, match, priceOf);
  return { ...line, description: text, itemId: undefined, unitCostCents: undefined };
}
