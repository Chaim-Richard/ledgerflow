/**
 * The tax on one sale line (PLAN §6): who sells (the seller's resolved profile, from the line's
 * entity label or the books), where the buyer is, the date, the item's tax category and any
 * exemption certificate decide it. The answer names the registration the line belongs to, so each
 * return is built from its own lines.
 *
 * Rates come from tables with dated rows (`RateTables`); Israel's is built in, the US state and
 * local tables plug in as AI #3 and AI #5 deliver them. A place without a table answers
 * `no-rate-table`: nothing is guessed. Pure.
 */
import { IL_VAT_STANDARD, rateOn } from './ilVatRates';
import { registrationKey, registrationsOn, type ResolvedProfile, type TaxPlace } from './profile';

export interface TaxComponent {
  /** country, state, county, city or district */
  level: 'country' | 'state' | 'county' | 'city' | 'district';
  name: string;
  rate: number;
}

export type LineTaxReason =
  | 'taxed'
  | 'exempt-certificate'   // the buyer has a good certificate (T-05)
  | 'export'               // sold to another country: zero-rated
  | 'zero-area'            // a zero-rated area (Eilat)
  | 'not-registered'       // no registration for the buyer's place on the date (no nexus in that state)
  | 'no-rate-table';       // the place has no table yet: nothing is guessed

export interface LineTax {
  reason: LineTaxReason;
  components: TaxComponent[];
  /** the sum of the components */
  rate: number;
  /** the registration (registrationKey) whose return the line belongs to, when there is one */
  registration?: string;
}

/** A US state's (or other) rates for a buyer's place, a date and an item category; none = no table. */
export type RateTable = (place: TaxPlace, date: string, category?: string) => TaxComponent[] | undefined;
export type RateTables = Partial<Record<string, RateTable>>;

export const builtInRateTables: RateTables = {
  IL: (place, date) => {
    const row = rateOn(IL_VAT_STANDARD, date);
    return row ? [{ level: 'country', name: 'VAT (מע"מ)', rate: place.district === 'Eilat' ? 0 : row.rate }] : undefined;
  },
};

const total = (components: TaxComponent[]) => Math.round(components.reduce((s, c) => s + c.rate, 0) * 1e6) / 1e6;

export function resolveLineTax(input: {
  seller: ResolvedProfile;
  buyer?: TaxPlace | null;
  date: string;
  category?: string;
  exempt?: boolean;
  tables?: RateTables;
}): LineTax {
  const tables = { ...builtInRateTables, ...input.tables };
  const sellerCountry = input.seller.place?.country;
  const buyer = input.buyer?.country ? input.buyer : input.seller.place;
  const none = (reason: LineTaxReason, registration?: string): LineTax => ({ reason, components: [], rate: 0, ...(registration ? { registration } : {}) });
  if (!sellerCountry || !buyer) return none('no-rate-table');

  if (sellerCountry === 'US') {
    // sales tax: only where the seller holds a permit for the buyer's state on the date (nexus)
    if (buyer.country !== 'US') return none('export');
    const permit = registrationsOn(input.seller, 'sales_tax', input.date).find(r => r.place.state === buyer.state);
    if (!permit) return none('not-registered');
    const key = registrationKey(permit);
    if (input.exempt) return none('exempt-certificate', key);
    const components = tables[`US-${buyer.state}`]?.(buyer, input.date, input.category);
    if (!components) return none('no-rate-table', key);
    return { reason: 'taxed', components, rate: total(components), registration: key };
  }

  // VAT countries: the seller's VAT registration in its own country
  const vat = registrationsOn(input.seller, 'vat', input.date).find(r => r.place.country === sellerCountry);
  if (!vat) return none('not-registered');
  const key = registrationKey(vat);
  if (buyer.country !== sellerCountry) return none('export', key);
  if (input.exempt) return none('exempt-certificate', key);
  const components = tables[sellerCountry]?.(buyer, input.date, input.category);
  if (!components) return none('no-rate-table', key);
  const rate = total(components);
  return { reason: rate === 0 && buyer.district ? 'zero-area' : 'taxed', components, rate, registration: key };
}
