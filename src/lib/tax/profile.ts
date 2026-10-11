/**
 * Tax profiles (docs/PLAN.md §6): tax follows the entity, not only the workspace. A profile belongs to
 * the books, or to a label value (an entity, a location, a branch: any label). It says where that
 * organisation sits and what it is registered for. A label value without its own profile, or without
 * some field, inherits from its parent value (`homes/maui` → `homes`), then from the books.
 *
 * An invoice line's seller profile comes from the line's labels; with the buyer's place, the item's
 * tax code and any exemption certificate it decides the tax (the rate tables plug in later). Each
 * tax return is built per registration, from the lines whose seller profile carries it.
 * Pure: no store or I/O. Stored on the workspace as `taxProfiles` (server-written; not yet).
 */

/** A place, from the widest to the narrowest. Country is ISO 3166-1 alpha-2; state is the subdivision code (TX, CA). */
export interface TaxPlace {
  country: string;
  state?: string;
  county?: string;
  city?: string;
  /** a special taxing district (transit, stadium) or a special area (Eilat) */
  district?: string;
  postalCode?: string;
}

export type RegistrationKind =
  | 'vat'             // VAT / GST number (Israel: dealer number, עוסק מורשה)
  | 'sales_tax'       // a US state sales tax permit (or a local one)
  | 'employer'        // an employer number: US EIN or state employer account; Israel withholding file (תיק ניכויים)
  | 'income_tax'      // the company's income tax file
  | 'withholding';    // a certificate for tax withheld at source (Israel ניכוי במקור)

export type FilingFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';

export interface TaxRegistration {
  kind: RegistrationKind;
  number: string;
  /** where it is registered: the country, and the state or city for a state or local permit */
  place: TaxPlace;
  filing?: FilingFrequency;
  /** YYYY-MM-DD; none means from the start / no end */
  validFrom?: string;
  validTo?: string;
}

export interface TaxProfile {
  /** shown in lists, e.g. "Acme Texas LLC" */
  name?: string;
  place?: TaxPlace;
  registrations?: TaxRegistration[];
  basis?: 'accrual' | 'cash';
}

/** Where profiles are kept: the books' own and one per label value, keyed `dimensionId:nodeId`. */
export interface TaxProfiles {
  books?: TaxProfile;
  labels?: Record<string, TaxProfile>;
}

export const labelKey = (dimensionId: string, nodeId: string) => `${dimensionId}:${nodeId}`;

/** `homes/maui` → [`homes/maui`, `homes`]: the value and its parents, nearest first. */
export function nodeAncestry(nodeId: string): string[] {
  const parts = nodeId.split('/').filter(Boolean);
  return parts.map((_, i) => parts.slice(0, parts.length - i).join('/'));
}

export interface ResolvedProfile extends TaxProfile {
  /** where each field came from, nearest first: label keys, then 'books' */
  from: string[];
}

/**
 * The seller's profile for a line with these labels. Labels are tried in `order` (put the World /
 * Entity label first); the first label value (or a parent of it) that has a profile wins, and its
 * missing fields come from its parents and then the books. Registrations are not merged across
 * levels: the nearest level that lists any is the one that counts (a Texas LLC files its own
 * returns, not the parent's).
 */
export function resolveSellerProfile(profiles: TaxProfiles | null | undefined, dimensions: Record<string, string> | null | undefined, order: string[]): ResolvedProfile {
  const chain: Array<[string, TaxProfile]> = [];
  const labels = profiles?.labels || {};
  for (const dimensionId of order) {
    const nodeId = dimensions?.[dimensionId];
    if (!nodeId) continue;
    const found = nodeAncestry(nodeId).map(id => labelKey(dimensionId, id)).filter(key => labels[key]);
    if (found.length) { found.forEach(key => chain.push([key, labels[key]])); break; }
  }
  if (profiles?.books) chain.push(['books', profiles.books]);
  const out: ResolvedProfile = { from: chain.map(([key]) => key) };
  for (const [, profile] of chain) {
    if (out.name === undefined && profile.name) out.name = profile.name;
    if (out.basis === undefined && profile.basis) out.basis = profile.basis;
    if (out.registrations === undefined && profile.registrations?.length) out.registrations = profile.registrations;
    if (profile.place) out.place = { ...profile.place, ...stripEmpty(out.place) };
  }
  return out;
}

function stripEmpty(place: TaxPlace | undefined): Partial<TaxPlace> {
  if (!place) return {};
  return Object.fromEntries(Object.entries(place).filter(([, v]) => v !== undefined && v !== '')) as Partial<TaxPlace>;
}

/** The registrations of a kind that are in force on `date` (YYYY-MM-DD). */
export function registrationsOn(profile: TaxProfile, kind: RegistrationKind, date: string): TaxRegistration[] {
  return (profile.registrations || []).filter(r => r.kind === kind && (!r.validFrom || r.validFrom <= date) && (!r.validTo || date <= r.validTo));
}

/** A stable key for a registration, to group a return's lines: `vat:IL:514000000`, `sales_tax:US-TX:3200…`. */
export function registrationKey(r: TaxRegistration): string {
  return `${r.kind}:${r.place.country}${r.place.state ? `-${r.place.state}` : ''}${r.place.city ? `-${r.place.city}` : ''}:${r.number}`;
}
