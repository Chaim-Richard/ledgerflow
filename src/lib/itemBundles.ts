/**
 * A-19 (tracker BF-03): an item can be a bundle of other items with quantities. Choosing it on an
 * invoice adds its parts as lines — each part keeps its own price, and the person can still change
 * them — so stock, cost and posting stay the parts' own, and a bundle is never a stock item.
 *
 * Stored on the item document as `bundleParts` (`[{ itemId, quantity }]`). This module is pure: it
 * validates a bundle and expands it into lines; the invoice screen calls `expandBundle` when a
 * bundle item is picked (a five-line hook-up in the invoice form, noted as AI #1's file).
 */

export interface BundlePart {
  itemId: string;
  /** how many of the part one bundle contains; a positive whole number */
  quantity: number;
}

/** The item fields a bundle needs (a subset, so tests need no full records). */
export interface BundleHost {
  id: string;
  name: string;
  bundleParts?: BundlePart[];
}

/** The item fields a part's line needs. */
export interface BundlePartItem {
  id: string;
  name: string;
  unitPriceCents: number;
  itemType?: 'stock' | 'service';
}

export interface BundleLine {
  /** the part's own item, so stock and cost follow the part */
  itemId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export const BUNDLE_MAX_PARTS = 50;
export const BUNDLE_MAX_QUANTITY = 10_000;

export const isBundle = (item: BundleHost | null | undefined): boolean => Boolean(item?.bundleParts?.length);

const whole = (n: number) => Number.isInteger(n) && n > 0;

/**
 * Why this bundle may not be saved, or undefined when it may. Refusals name the rule in plain words:
 * a bundle with no parts is not a bundle, a part must exist, quantities are positive whole numbers,
 * a bundle may not contain itself, and bundles do not nest (one level keeps stock and cost readable).
 */
export function bundleProblem(bundle: BundleHost, parts: BundlePart[], items: BundlePartItem[]): string | undefined {
  if (!parts.length) return 'A bundle needs at least one part.';
  if (parts.length > BUNDLE_MAX_PARTS) return `A bundle can hold at most ${BUNDLE_MAX_PARTS} parts.`;
  const seen = new Set<string>();
  for (const part of parts) {
    if (!whole(part.quantity) || part.quantity > BUNDLE_MAX_QUANTITY) return 'A part’s quantity must be a positive whole number.';
    if (seen.has(part.itemId)) return 'The same part is listed twice; change its quantity instead.';
    seen.add(part.itemId);
    if (part.itemId === bundle.id) return 'A bundle cannot contain itself.';
    const item = items.find(i => i.id === part.itemId);
    if (!item) return 'A part is not in the item list any more.';
    if (isBundle(item)) return 'Bundles do not contain other bundles; add the inner items here instead.';
  }
  return undefined;
}

/**
 * The lines a bundle adds for a chosen quantity: each part, its own price, multiplied by how many of
 * the part one bundle holds and by how many bundles were chosen. Prices come from the part, so the
 * person can then change any line (that is the point — a typed price wins).
 */
export function expandBundle(bundle: BundleHost, quantity: number, items: BundlePartItem[]): BundleLine[] {
  if (!isBundle(bundle) || !whole(quantity)) return [];
  return (bundle.bundleParts || []).flatMap(part => {
    const item = items.find(i => i.id === part.itemId);
    if (!item) return [];
    return [{
      itemId: item.id,
      description: item.name,
      quantity: part.quantity * quantity,
      unitPriceCents: item.unitPriceCents,
    }];
  });
}

/** What one bundle is worth at its parts' list prices, and what its parts cost — display only. */
export function bundleValueCents(bundle: BundleHost, items: Array<BundlePartItem & { unitCostCents?: number }>): { priceCents: number; costCents: number } {
  let priceCents = 0;
  let costCents = 0;
  for (const part of bundle.bundleParts || []) {
    const item = items.find(i => i.id === part.itemId);
    if (!item) continue;
    priceCents += part.quantity * item.unitPriceCents;
    costCents += part.quantity * (item.unitCostCents || 0);
  }
  return { priceCents, costCents };
}

/** The parts of a bundle as the item list shows them ("2 × Widget"). */
export function bundleSummary(bundle: BundleHost, items: BundlePartItem[], max = 3): string {
  const parts = (bundle.bundleParts || []).map(part => {
    const item = items.find(i => i.id === part.itemId);
    return `${part.quantity} × ${item?.name || 'a removed item'}`;
  });
  if (!parts.length) return '';
  return parts.length > max ? `${parts.slice(0, max).join(', ')} +${parts.length - max} more` : parts.join(', ');
}

/** The items a person may add as a part of this bundle: everything but itself and other bundles. */
export function bundlePartChoices<T extends BundlePartItem & BundleHost>(bundleId: string, items: T[]): T[] {
  return items.filter(i => i.id !== bundleId && !isBundle(i));
}

/** A bundle is not stocked: its parts are. The screen uses this to hide quantity and cost fields. */
export const bundleKeepsNoStock = (item: BundleHost | null | undefined): boolean => isBundle(item);
