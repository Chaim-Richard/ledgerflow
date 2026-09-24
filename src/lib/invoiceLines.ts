import type { InventoryItem } from '../types';

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

type ItemFields = Pick<InventoryItem, 'id' | 'name' | 'sku' | 'unitPriceCents' | 'unitCostCents'>;

/** quantity × rate, rounded to whole cents. */
export function lineAmountCents(quantity: number, rateCents: number): number {
  const qty = Number.isFinite(quantity) ? quantity : 0;
  return Math.round(qty * rateCents);
}

/** Picked an inventory item: link it and fill its name, price and cost. */
export function applyInventoryItem<L extends InvoiceLineDraft>(line: L, item: ItemFields): L {
  return {
    ...line,
    itemId: item.id,
    description: item.name,
    rateCents: item.unitPriceCents,
    unitCostCents: item.unitCostCents,
    amountCents: lineAmountCents(line.quantity, item.unitPriceCents),
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
export function setLineDescription<L extends InvoiceLineDraft>(line: L, text: string, items: ItemFields[]): L {
  const match = findInventoryItem(items, text);
  if (match) return applyInventoryItem(line, match);
  return { ...line, description: text, itemId: undefined, unitCostCents: undefined };
}
