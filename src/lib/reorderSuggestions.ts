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

const roundUpTo = (quantity: number, step: number) => (step > 1 ? Math.ceil(quantity / step) * step : quantity);

/** The reorder suggestions, grouped by vendor (vendors first, by name; no vendor last). */
export function reorderSuggestions(input: ReorderInput): ReorderGroup[] {
  const vendorName = new Map(input.vendors.map(v => [v.id, v.name] as const));
  // The most recent purchase per vendor and item, from bills and purchase orders alike.
  // Dates are compared as text (YYYY-MM-DD), so the input order does not matter.
  type Purchase = { vendorId: string; date: string; unit: number };
  const vendorLast = new Map<string, Purchase>(); // key: vendorId + item
  const itemLast = new Map<string, Purchase>(); // key: item (any vendor)
  const remember = (map: Map<string, Purchase>, key: string, purchase: Purchase) => {
    const current = map.get(key);
    if (!current || purchase.date >= current.date) map.set(key, purchase);
  };
  for (const bill of input.bills) {
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
  for (const po of input.orders) {
    for (const line of po.items || []) {
      if (!line.itemId || !po.vendorId) continue;
      const purchase = { vendorId: po.vendorId, date: String(po.issueDate || '').slice(0, 10), unit: line.unitPriceCents || 0 };
      remember(vendorLast, `${po.vendorId}\u0000${line.itemId}`, purchase);
      remember(itemLast, line.itemId, purchase);
    }
  }

  const groups = new Map<string, ReorderGroup>();
  for (const item of input.items) {
    if (item.itemType === 'service' || item.consignment) continue;
    const onHand = Number(item.quantityAtHand) || 0;
    const reorderPoint = Number(item.reorderPoint) || 0;
    if (!(onHand < reorderPoint)) continue;
    const packSize = Number(item.unitsPerPackage) || 1;
    const suggestedQuantity = roundUpTo(reorderPoint - onHand, packSize);
    const latest = itemLast.get(item.id);
    const vendorId = latest?.vendorId;
    const known = vendorId ? vendorLast.get(`${vendorId}\u0000${item.id}`)?.unit : undefined;
    const unit = known !== undefined && known > 0 ? known : (item.unitCostCents || 0);
    const line: ReorderLine = {
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.measurementUnit || '',
      onHand,
      reorderPoint,
      suggestedQuantity,
      unitCostCents: unit,
      costSource: known !== undefined && known > 0 ? 'vendor-history' : 'item',
    };
    const key = vendorId || '';
    const group = groups.get(key) || { vendorId, vendorName: vendorId ? (vendorName.get(vendorId) || vendorId) : 'No preferred vendor yet', lines: [], totalCents: 0 };
    group.lines.push(line);
    group.totalCents += Math.round(unit * suggestedQuantity);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(g => ({ ...g, lines: g.lines.sort((a, b) => a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId)) }))
    .sort((a, b) => (!a.vendorId ? 1 : 0) - (!b.vendorId ? 1 : 0) || a.vendorName.localeCompare(b.vendorName));
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
