/**
 * A-50: reorder suggestions. Stock items below their reorder point, grouped by the vendor they were
 * last bought from, with the quantity that brings each back to its reorder point. Items with no
 * purchase history have no vendor and are grouped apart: nothing is invented.
 *
 * - Eligible: a stock item (not a service, not a consignment item) whose units on hand are below its
 *   reorder point. Units on hand come from the item record (quantityAtHand), as the stock screens read them.
 * - Suggested quantity: the reorder point less units on hand, rounded up to whole packages when the
 *   item is bought in packs (unitsPerPackage).
 * - Preferred vendor: the vendor of the most recent bill or purchase-order line for the item. Unit
 *   cost: that vendor's most recent unit cost for the item (bill or order), else the item's own unit cost.
 *
 * `reorderDraftOrders` only builds draft purchase orders in memory. Saving them goes through the
 * purchase-order screen's own write path. Nothing is posted.
 *
 * A-115: the vendor-price lookup, the line builder and the grouping are shared with the by-location
 * suggestions (src/lib/locationLevels.ts), so both modes price, group and order the same way.
 */
import type { Bill, InventoryItem, PurchaseOrder, Vendor } from '../types';
import { nextPoNumber } from './purchaseOrders';
import { unitCostCents } from './vendorScorecard';

export interface ReorderLine {
  itemId: string;
  name: string;
  sku: string;
  unit: string;
  onHand: number;
  reorderPoint: number;
  suggestedQuantity: number;
  unitCostCents: number;
  /** where the unit cost came from: this vendor's last price, or the item's own */
  costSource: 'vendor-history' | 'item';
  /** A-115: set on by-location rows — the location this row suggests for, and its maximum (the minimum rides in reorderPoint) */
  locationId?: string;
  locationName?: string;
  maxLevel?: number;
}

export interface ReorderGroup {
  vendorId?: string;
  vendorName: string;
  lines: ReorderLine[];
  totalCents: number;
}

export interface ReorderInput {
  items: InventoryItem[];
  bills: Array<Pick<Bill, 'vendorId' | 'date' | 'splits'>>;
  orders: Array<Pick<PurchaseOrder, 'vendorId' | 'issueDate' | 'items'>>;
  vendors: Array<Pick<Vendor, 'id' | 'name'>>;
}

/** Round a quantity up to whole packages (a pack of 1 changes nothing). */
export function roundUpToPack(quantity: number, packSize: number): number {
  return packSize > 1 ? Math.ceil(quantity / packSize) * packSize : quantity;
}

export interface VendorPrice {
  vendorId: string;
  date: string;
  unit: number;
}

export interface VendorPriceMaps {
  /** key: vendor + item */
  vendorLast: Map<string, VendorPrice>;
  /** key: item (any vendor) */
  itemLast: Map<string, VendorPrice>;
}

type PriceBill = { vendorId: string; date?: string; splits?: Array<{ itemId?: string; quantity?: number; amountCents: number }> };
type PriceOrder = { vendorId: string; issueDate: string; items?: Array<{ itemId?: string; unitPriceCents: number }> };

/**
 * The most recent purchase per vendor and item, from bills and purchase orders alike.
 * Dates are compared as text (YYYY-MM-DD), so the input order does not matter.
 */
export function vendorPriceMaps(bills: PriceBill[], orders: PriceOrder[]): VendorPriceMaps {
  const vendorLast = new Map<string, VendorPrice>();
  const itemLast = new Map<string, VendorPrice>();
  const remember = (map: Map<string, VendorPrice>, key: string, purchase: VendorPrice) => {
    const current = map.get(key);
    if (!current || purchase.date >= current.date) map.set(key, purchase);
  };
  for (const bill of bills) {
    for (const split of bill.splits || []) {
      if (!split.itemId || !bill.vendorId) continue;
      const unit = unitCostCents(split.amountCents, split.quantity ?? 0);
      if (unit === undefined) continue;
      const purchase = { vendorId: bill.vendorId, date: String(bill.date || '').slice(0, 10), unit };
      remember(vendorLast, `${bill.vendorId}\u0000${split.itemId}`, purchase);
      remember(itemLast, split.itemId, purchase);
    }
  }
  // A purchase order line is a price the vendor quoted for the item: it counts with the bills, by date.
  for (const po of orders) {
    for (const line of po.items || []) {
      if (!line.itemId || !po.vendorId) continue;
      const purchase = { vendorId: po.vendorId, date: String(po.issueDate || '').slice(0, 10), unit: line.unitPriceCents || 0 };
      remember(vendorLast, `${po.vendorId}\u0000${line.itemId}`, purchase);
      remember(itemLast, line.itemId, purchase);
    }
  }
  return { vendorLast, itemLast };
}

/**
 * One suggestion row for an item below its threshold, priced from the vendor's most recent unit
 * cost for the item (bill or order) else the item's own unit cost, with the vendor it was last
 * bought from. The caller decides the threshold and the suggested quantity.
 */
export function reorderLineFor(
  item: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'measurementUnit' | 'unitCostCents'>,
  onHand: number,
  reorderPoint: number,
  suggestedQuantity: number,
  maps: VendorPriceMaps,
): { line: ReorderLine; vendorId?: string } {
  const latest = maps.itemLast.get(item.id);
  const vendorId = latest?.vendorId;
  const known = vendorId ? maps.vendorLast.get(`${vendorId}\u0000${item.id}`)?.unit : undefined;
  const unit = known !== undefined && known > 0 ? known : (item.unitCostCents || 0);
  return {
    line: {
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.measurementUnit || '',
      onHand,
      reorderPoint,
      suggestedQuantity,
      unitCostCents: unit,
      costSource: known !== undefined && known > 0 ? 'vendor-history' : 'item',
    },
    vendorId,
  };
}

/** Suggestion rows grouped by vendor (vendors first, by name; no vendor last), lines by item. */
export function groupReorderLines(
  rows: Array<{ line: ReorderLine; vendorId?: string }>,
  vendorName: Map<string, string>,
): ReorderGroup[] {
  const groups = new Map<string, ReorderGroup>();
  for (const { line, vendorId } of rows) {
    const key = vendorId || '';
    const group = groups.get(key) || { vendorId, vendorName: vendorId ? (vendorName.get(vendorId) || vendorId) : 'No preferred vendor yet', lines: [], totalCents: 0 };
    group.lines.push(line);
    group.totalCents += Math.round(line.unitCostCents * line.suggestedQuantity);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(g => ({ ...g, lines: g.lines.sort((a, b) => a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId)) }))
    .sort((a, b) => (!a.vendorId ? 1 : 0) - (!b.vendorId ? 1 : 0) || a.vendorName.localeCompare(b.vendorName));
}

/** The reorder suggestions, grouped by vendor (vendors first, by name; no vendor last). */
export function reorderSuggestions(input: ReorderInput): ReorderGroup[] {
  const vendorName = new Map(input.vendors.map(v => [v.id, v.name] as const));
  const maps = vendorPriceMaps(input.bills, input.orders);
  const rows: Array<{ line: ReorderLine; vendorId?: string }> = [];
  for (const item of input.items) {
    if (item.itemType === 'service' || item.consignment) continue;
    const onHand = Number(item.quantityAtHand) || 0;
    const reorderPoint = Number(item.reorderPoint) || 0;
    if (!(onHand < reorderPoint)) continue;
    const packSize = Number(item.unitsPerPackage) || 1;
    rows.push(reorderLineFor(item, onHand, reorderPoint, roundUpToPack(reorderPoint - onHand, packSize), maps));
  }
  return groupReorderLines(rows, vendorName);
}

/**
 * Draft purchase orders for the groups that have a vendor (the group with no vendor cannot become
 * an order). Numbers follow the purchase-order series; the caller passes the existing orders so
 * numbers continue without a gap or a repeat. Drafts carry no receipts and no bill.
 */
export function reorderDraftOrders(groups: ReorderGroup[], existing: Array<Pick<PurchaseOrder, 'poNumber'>>, issueDate: string, workspaceId = ''): Array<Omit<PurchaseOrder, 'id' | 'uid' | 'createdAt'>> {
  const year = issueDate.slice(0, 4);
  const numbers = [...existing];
  const drafts: Array<Omit<PurchaseOrder, 'id' | 'uid' | 'createdAt'>> = [];
  for (const group of groups) {
    if (!group.vendorId || !group.lines.length) continue;
    const poNumber = nextPoNumber(numbers, year);
    numbers.push({ poNumber });
    const items = group.lines.map((line, index) => ({
      id: `line-${index + 1}`,
      description: line.name,
      quantity: line.suggestedQuantity,
      unitPriceCents: line.unitCostCents,
      totalCents: Math.round(line.unitCostCents * line.suggestedQuantity),
      itemId: line.itemId,
    }));
    drafts.push({
      workspaceId,
      poNumber,
      vendorId: group.vendorId,
      vendorName: group.vendorName,
      issueDate,
      status: 'draft',
      items,
      totalAmountCents: items.reduce((sum, item) => sum + item.totalCents, 0),
      notes: 'Suggested from reorder points. Check quantities before approval.',
    });
  }
  return drafts;
}
