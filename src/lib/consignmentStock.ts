/**
 * A-34 (tracker BF-05): consignment stock — stock held **from** a third party (the supplier still
 * owns it) and stock of ours held **at** a third party (a customer, a showroom, a repair shop).
 *
 * What this is: a mark on the item (`InventoryItem.consignment`) and a report of those items with
 * their quantity and value at the item's own cost, so a person can see what is not ours / not here.
 * What it is not: a posting. Consignment stock on the books is a judgement (the value here is the
 * item's cost, not a claim about ownership), so nothing is written to the ledger by this module.
 * Pure.
 */

export type ConsignmentKind = 'from-supplier' | 'at-customer';

export interface ConsignmentItem {
  id: string;
  name: string;
  sku?: string;
  quantityAtHand: number;
  unitCostCents: number;
  unitPriceCents?: number;
  measurementUnit?: string;
  consignment?: string;
}

export interface ConsignmentRow {
  id: string;
  name: string;
  sku: string;
  direction: ConsignmentKind;
  /** 'in': the supplier's stock sits here; 'out': ours sits somewhere else */
  directionLabel: string;
  quantity: number;
  unitCostCents: number;
  valueCents: number;
  measurementUnit?: string;
}

export const CONSIGNMENT_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: '', label: 'Not consignment', description: 'Ordinary stock of this business.' },
  { value: 'from-supplier', label: 'Held from a supplier', description: 'The supplier still owns it; it sits here until it sells.' },
  { value: 'at-customer', label: 'Ours, held elsewhere', description: 'Our stock is at a customer, showroom or repair shop.' },
];

/** The direction of an item's mark, or undefined when it is ordinary stock. */
export function consignmentKind(item: { consignment?: string } | null | undefined): ConsignmentKind | undefined {
  return item?.consignment === 'from-supplier' || item?.consignment === 'at-customer' ? item.consignment : undefined;
}

export function isConsignment(item: { consignment?: string } | null | undefined): boolean {
  return consignmentKind(item) !== undefined;
}

/** The label a screen shows for a direction. */
export function consignmentLabel(kind: ConsignmentKind | undefined): string {
  return CONSIGNMENT_OPTIONS.find(o => o.value === kind)?.label || '';
}

/** Value at the item's own cost: quantity × unit cost, whole cents (the parts' rule: no made-up value). */
export function consignmentValueCents(item: ConsignmentItem): number {
  return Math.round(item.quantityAtHand * item.unitCostCents);
}

/** The consignment rows of a list, in the report's order (direction, then name). */
export function consignmentRows(items: ConsignmentItem[]): ConsignmentRow[] {
  return items.flatMap(item => {
    const direction = consignmentKind(item);
    if (!direction) return [];
    return [{
      id: item.id, name: item.name, sku: item.sku || '', direction,
      directionLabel: direction === 'from-supplier' ? 'In (supplier’s)' : 'Out (ours, elsewhere)',
      quantity: item.quantityAtHand, unitCostCents: item.unitCostCents, valueCents: consignmentValueCents(item),
      ...(item.measurementUnit ? { measurementUnit: item.measurementUnit } : {}),
    }];
  }).sort((a, b) => a.direction === b.direction ? a.name.localeCompare(b.name) : (a.direction === 'from-supplier' ? -1 : 1));
}

export interface ConsignmentSummary {
  items: number;
  /** what is here but the supplier's */
  heldFromSupplierCents: number;
  heldCount: number;
  /** what is ours but elsewhere */
  atCustomerCents: number;
  atCount: number;
  /** total value at cost, by direction */
  totalCents: number;
}

export function consignmentSummary(items: ConsignmentItem[]): ConsignmentSummary {
  const rows = consignmentRows(items);
  const sum = (direction: ConsignmentKind) => rows.filter(r => r.direction === direction);
  const held = sum('from-supplier');
  const out = sum('at-customer');
  const total = held.reduce((s, r) => s + r.valueCents, 0) + out.reduce((s, r) => s + r.valueCents, 0);
  return {
    items: rows.length,
    heldFromSupplierCents: held.reduce((s, r) => s + r.valueCents, 0),
    heldCount: held.length,
    atCustomerCents: out.reduce((s, r) => s + r.valueCents, 0),
    atCount: out.length,
    totalCents: total,
  };
}

/** The report as CSV rows: the same columns the screen shows. */
export function consignmentCsvRows(items: ConsignmentItem[]): Array<Array<string | number>> {
  return consignmentRows(items).map(r => [
    r.name, r.sku, r.directionLabel, r.quantity, r.measurementUnit || '', r.unitCostCents / 100, r.valueCents / 100,
  ]);
}

export const CONSIGNMENT_CSV_HEADERS = ['Item', 'SKU', 'Direction', 'Quantity', 'Unit', 'Unit cost', 'Value'];
