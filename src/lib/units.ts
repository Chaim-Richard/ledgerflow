/**
 * A-32 (tracker M-13, CG-02): units of measure on items — each, box, pack, kg, hour — with the
 * conversions a person needs on a line (how many singles are in a pack, what a weight means).
 *
 * Display and language only: the stock, the cost and the posting of an item never change here.
 * `InventoryItem.measurementUnit` holds one of `UNITS`' ids (or a word the workspace typed before
 * this list existed, which is shown as it is), and `unitsPerPackage` is how many singles one unit
 * holds. Pure.
 */

export type UnitKind = 'count' | 'weight' | 'volume' | 'time' | 'length';

export interface Unit {
  id: string;
  label: string;
  kind: UnitKind;
  /** the unit's plural for sentences: "2 boxes" */
  plural: string;
}

export const UNITS: Unit[] = [
  { id: 'each', label: 'each', kind: 'count', plural: 'each' },
  { id: 'unit', label: 'unit', kind: 'count', plural: 'units' },
  { id: 'box', label: 'box', kind: 'count', plural: 'boxes' },
  { id: 'pack', label: 'pack', kind: 'count', plural: 'packs' },
  { id: 'case', label: 'case', kind: 'count', plural: 'cases' },
  { id: 'pallet', label: 'pallet', kind: 'count', plural: 'pallets' },
  { id: 'dozen', label: 'dozen', kind: 'count', plural: 'dozen' },
  { id: 'pair', label: 'pair', kind: 'count', plural: 'pairs' },
  { id: 'set', label: 'set', kind: 'count', plural: 'sets' },
  { id: 'kg', label: 'kg', kind: 'weight', plural: 'kg' },
  { id: 'g', label: 'g', kind: 'weight', plural: 'g' },
  { id: 'lb', label: 'lb', kind: 'weight', plural: 'lb' },
  { id: 'oz', label: 'oz', kind: 'weight', plural: 'oz' },
  { id: 't', label: 'tonne', kind: 'weight', plural: 'tonnes' },
  { id: 'l', label: 'litre', kind: 'volume', plural: 'litres' },
  { id: 'ml', label: 'ml', kind: 'volume', plural: 'ml' },
  { id: 'gal', label: 'gallon', kind: 'volume', plural: 'gallons' },
  { id: 'm', label: 'metre', kind: 'length', plural: 'metres' },
  { id: 'cm', label: 'cm', kind: 'length', plural: 'cm' },
  { id: 'ft', label: 'foot', kind: 'length', plural: 'feet' },
  { id: 'in', label: 'inch', kind: 'length', plural: 'inches' },
  { id: 'hour', label: 'hour', kind: 'time', plural: 'hours' },
  { id: 'day', label: 'day', kind: 'time', plural: 'days' },
  { id: 'month', label: 'month', kind: 'time', plural: 'months' },
];

const BY_ID = new Map(UNITS.map(u => [u.id.toLowerCase(), u]));

/** The unit for an id (case-insensitive), or undefined when the item carries a word this list lacks. */
export function unit(id: string | null | undefined): Unit | undefined {
  return id ? BY_ID.get(id.trim().toLowerCase()) : undefined;
}

/** What a screen shows for a unit: the known label, or the stored word exactly as it is. */
export function unitLabel(id: string | null | undefined): string {
  if (!id) return '';
  return unit(id)?.label ?? id;
}

/** The unit's plural for a sentence ("2 boxes"); an unknown word is left alone. */
export function unitPlural(id: string | null | undefined, quantity: number): string {
  if (!id) return '';
  const known = unit(id);
  if (!known) return id;
  return quantity === 1 ? known.plural === 'each' ? 'each' : known.label : known.plural;
}

/** "2 boxes", "1.5 kg", or just the number when the item has no unit. */
export function formatQuantity(quantity: number, id?: string | null): string {
  const number = Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 1000) / 1000);
  const label = unitPlural(id, quantity);
  return label ? `${number} ${label}` : number;
}

/** True when the two units measure the same kind of thing (a kg and a lb can be converted). */
export function sameKind(from: string | null | undefined, to: string | null | undefined): boolean {
  const a = unit(from);
  const b = unit(to);
  return Boolean(a && b && a.kind === b.kind);
}

/** Exact factors for the units this table can convert between, per kind (base: g, ml, cm, hour). */
const FACTORS: Record<string, number> = {
  kg: 1000, g: 1, lb: 453.59237, oz: 28.349523125, t: 1_000_000,
  l: 1000, ml: 1, gal: 3785.411784,
  m: 100, cm: 1, ft: 30.48, in: 2.54,
  hour: 1, day: 24, month: 730,
};

/**
 * A quantity changed from one unit to another of the same kind, or undefined when the two units do
 * not measure the same thing (a kg is not a box — the caller says so rather than inventing a factor).
 * Rounded to three decimals: a display conversion, never a cost or a stock figure.
 */
export function convertQuantity(quantity: number, from: string, to: string): number | undefined {
  if (!sameKind(from, to)) return undefined;
  const a = FACTORS[from.trim().toLowerCase()];
  const b = FACTORS[to.trim().toLowerCase()];
  if (a === undefined || b === undefined) return undefined;
  return Math.round((quantity * a / b) * 1000) / 1000;
}

/** How many singles a number of packages holds (unitsPerPackage is 1 when the item has none). */
export function singles(quantity: number, unitsPerPackage?: number | null): number {
  const per = unitsPerPackage && unitsPerPackage > 0 ? unitsPerPackage : 1;
  return Math.round(quantity * per * 1000) / 1000;
}

/** The package count a number of singles fills (the other direction). */
export function packages(quantity: number, unitsPerPackage?: number | null): number {
  const per = unitsPerPackage && unitsPerPackage > 0 ? unitsPerPackage : 1;
  return Math.round((quantity / per) * 1000) / 1000;
}

/**
 * The line a document shows for a quantity and its unit, with the package conversion when the item
 * has one: "2 packs (24 each)". Empty when the item has no unit at all.
 */
export function lineQuantityLabel(quantity: number, measurementUnit?: string | null, unitsPerPackage?: number | null): string {
  if (!measurementUnit) return '';
  const shown = formatQuantity(quantity, measurementUnit);
  if (!unitsPerPackage || unitsPerPackage <= 0 || unitsPerPackage === 1) return shown;
  return `${shown} (${singles(quantity, unitsPerPackage)} each)`;
}

/** Display price helpers for a per-unit price ("$12.50 per kg"); the money itself is unchanged. */
export function priceUnitLabel(measurementUnit?: string | null): string {
  const label = unitLabel(measurementUnit);
  return label ? `per ${label}` : '';
}

export const UNIT_IDS = UNITS.map(u => u.id);
