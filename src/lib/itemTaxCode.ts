/**
 * A-7 (CA-16) item tax template. An item may carry a default tax code. Choosing the item on an
 * invoice line fills that code into the invoice's tax choice, but only when the item is newly
 * chosen (picking the same item again changes nothing) and only when the code is one the
 * workspace still has. A changed code is kept: this is only applied on the pick itself.
 * Pure: no store or I/O.
 */

export interface TaxTemplateItem {
  id: string;
  defaultTaxCodeId?: string;
}

/**
 * The tax code to fill into the document, or undefined when the line should keep the current
 * tax choice. `previousItemId` is the item the line pointed to before this edit.
 */
export function taxCodeToFillFromItem(
  previousItemId: string | undefined,
  item: TaxTemplateItem | undefined,
  availableCodeIds: readonly string[],
): string | undefined {
  if (!item || !item.defaultTaxCodeId) return undefined;
  if (item.id === previousItemId) return undefined;
  return availableCodeIds.includes(item.defaultTaxCodeId) ? item.defaultTaxCodeId : undefined;
}
