/**
 * A-30 (PLAN US-1/US-3, L-1): the item tax categories — the small shared vocabulary that lets a
 * state rule (A-31) treat clothing, groceries, digital goods, SaaS and services differently.
 *
 * What this is: labels a person puts on an item (`InventoryItem.productTaxCategory`). What it is
 * not: a rate, a calc, or a claim that an item is exempt — the state table (A-31) and the engine
 * decide that from the seller's place, the buyer's state and the date. Pure data and lookups.
 */

export type TaxCategoryId =
  | 'general'
  | 'clothing'
  | 'groceries'
  | 'prepared-food'
  | 'prescription-medicine'
  | 'books'
  | 'digital-goods'
  | 'saas'
  | 'services';

export interface TaxCategory {
  id: TaxCategoryId;
  /** English label; menus stay English (the owner's rule) */
  label: string;
  description: string;
  /** true when the category is about a service rather than a good */
  service?: boolean;
}

export const TAX_CATEGORIES: TaxCategory[] = [
  { id: 'general', label: 'General goods', description: 'Tangible goods with no special category: the default, taxed like ordinary goods.' },
  { id: 'clothing', label: 'Clothing', description: 'Clothing and footwear; several states exempt them, some below a price cap.' },
  { id: 'groceries', label: 'Groceries (food at home)', description: 'Food bought to take away; most states tax it at a lower rate or not at all.' },
  { id: 'prepared-food', label: 'Prepared food and restaurants', description: 'Food sold ready to eat; usually taxed even where groceries are exempt.' },
  { id: 'prescription-medicine', label: 'Prescription medicine', description: 'Prescription drugs; exempt in most states, taxed in a few.' },
  { id: 'books', label: 'Books and printed matter', description: 'Books, newspapers and printed matter; several states reduce or exempt them.' },
  { id: 'digital-goods', label: 'Digital goods', description: 'Downloads, streaming and software delivered electronically; many states added rules for these.' },
  { id: 'saas', label: 'Software as a service (SaaS)', description: 'Cloud software; some states tax it as a sale of software, others as a service.' },
  { id: 'services', label: 'Services', description: 'Services in general; taxed in some states only.', service: true },
];

const BY_ID = new Map(TAX_CATEGORIES.map(c => [c.id, c]));

/** The category for an id, or undefined when an item carries something this table does not know. */
export function taxCategory(id: string | null | undefined): TaxCategory | undefined {
  return id ? BY_ID.get(id as TaxCategoryId) : undefined;
}

/** The plain label for an id; an unknown id is shown as-is rather than hidden. */
export function taxCategoryLabel(id: string | null | undefined): string {
  if (!id) return '';
  return taxCategory(id)?.label ?? id;
}

/** The id a stored value means, or `general` for an item with none — never a guess for an unknown id. */
export function effectiveTaxCategory(id: string | null | undefined): TaxCategoryId | undefined {
  if (!id) return 'general';
  return taxCategory(id)?.id;
}

/** The ids a filter offers (in the table's order). */
export const TAX_CATEGORY_IDS: TaxCategoryId[] = TAX_CATEGORIES.map(c => c.id);

export interface CategorizedItem {
  productTaxCategory?: string;
}

/**
 * The items in one tax category, for a list filter. `all` returns everything; an unknown id returns
 * nothing and is the caller's to report (this function does not silently treat it as `general`).
 */
export function filterItemsByTaxCategory<T extends CategorizedItem>(items: T[], category: TaxCategoryId | 'all' | ''): T[] {
  if (!category || category === 'all') return items;
  if (!taxCategory(category)) return [];
  return items.filter(i => effectiveTaxCategory(i.productTaxCategory) === category);
}
