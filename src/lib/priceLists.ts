/**
 * Price lists (M-11): a named list of prices for some customers, e.g. "Wholesale": 10% off every
 * item, and 45.00 for the chair. A customer is on at most one list. On an invoice or estimate for
 * that customer, picking an item fills the list's price for it (its own price there, else the item's
 * price less the list's discount, in whole cents); the price can still be changed on the line.
 * Owners and accountants keep the lists (saved by the server on the workspace, `priceLists`).
 */
export interface PriceList {
  id: string;
  name: string;
  /** percent off every item's own price, above 0 and below 100, two decimals at most */
  discountPercent?: number;
  /** item id → its price on this list, in whole cents */
  prices?: Record<string, number>;
  /** the customers on this list */
  customerIds?: string[];
}

export const MAX_PRICE_LISTS = 50;
export const MAX_LIST_PRICES = 2000;
export const MAX_LIST_CUSTOMERS = 5000;
export const PRICE_LIST_ID = /^pl_[a-z0-9]{6,20}$/;

const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

/** Why these lists can't be saved, or null. Ids may be missing (new lists). */
export function priceListsProblem(lists: unknown): string | null {
  if (!Array.isArray(lists)) return 'The price lists must be a list';
  if (lists.length > MAX_PRICE_LISTS) return `${MAX_PRICE_LISTS} price lists at most`;
  const names = new Set<string>();
  const onList = new Map<string, string>();
  for (const raw of lists) {
    const list = (raw || {}) as Partial<PriceList>;
    const name = typeof list.name === 'string' ? list.name.trim() : '';
    if (name.length < 2 || name.length > 80) return 'Each price list needs a name of 2 to 80 characters';
    if (names.has(norm(name))) return `"${name}" is in the list twice`;
    names.add(norm(name));
    if (list.id !== undefined && (typeof list.id !== 'string' || !PRICE_LIST_ID.test(list.id))) return `"${name}": its id is not one of this workspace's price lists`;
    if (list.discountPercent !== undefined) {
      const d = list.discountPercent;
      if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0 || d >= 100 || Math.round(d * 100) / 100 !== d) return `"${name}": the discount is a percentage above 0 and below 100, two decimals at most`;
    }
    if (list.prices !== undefined) {
      if (!list.prices || typeof list.prices !== 'object' || Array.isArray(list.prices)) return `"${name}": its prices are pairs of item and price`;
      const entries = Object.entries(list.prices);
      if (entries.length > MAX_LIST_PRICES) return `"${name}": ${MAX_LIST_PRICES} item prices at most`;
      if (entries.some(([item, cents]) => !item || item.length > 200 || typeof cents !== 'number' || !Number.isSafeInteger(cents) || cents < 0)) return `"${name}": each item's price is an amount of 0 or more`;
    }
    if (!list.discountPercent && Object.keys(list.prices || {}).length === 0) return `"${name}": give a discount or at least one item's price`;
    if (list.customerIds !== undefined) {
      if (!Array.isArray(list.customerIds) || list.customerIds.length > MAX_LIST_CUSTOMERS || list.customerIds.some(c => typeof c !== 'string' || !c || c.length > 200)) return `"${name}": choose its customers`;
      for (const c of list.customerIds) {
        const other = onList.get(c);
        if (other) return `A customer is on both "${other}" and "${name}": a customer is on one price list at most`;
        onList.set(c, name);
      }
    }
  }
  return null;
}

/** The list a customer is on, if any. */
export const listForCustomer = (lists: PriceList[] | undefined, customerId: string | undefined) =>
  customerId ? (lists || []).find(l => (l.customerIds || []).includes(customerId)) : undefined;

/** An item's price on a list: its own price there, else its price less the list's discount. */
export function listPrice(list: Pick<PriceList, 'prices' | 'discountPercent'>, item: { id: string; unitPriceCents: number }): number {
  const own = list.prices?.[item.id];
  if (typeof own === 'number') return own;
  if (list.discountPercent) return Math.round((item.unitPriceCents || 0) * (100 - list.discountPercent) / 100);
  return item.unitPriceCents || 0;
}

/** For a customer: the price of an item for them (undefined: the item's own price applies). */
export function customerPricer(lists: PriceList[] | undefined, customerId: string | undefined): ((item: { id: string; unitPriceCents: number }) => number) | undefined {
  const list = listForCustomer(lists, customerId);
  return list ? item => listPrice(list, item) : undefined;
}
