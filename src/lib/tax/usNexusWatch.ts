/**
 * CON-2 (capability 138): the US economic-nexus watch from the books' own posted invoices. For each state the
 * customers are in, it adds up the sales (before sales tax, in the home currency) and the number of sales for the
 * calendar year to date and the whole previous calendar year, and compares each with the state's threshold
 * (`nexusWatch`, the A-27 table) — crossed, or at 80% of the way.
 *
 * Honest limits, said on the screen:
 *  - states measure differently (previous or current calendar year, the last four quarters, gross or retail
 *    sales, marketplace sales); this shows the two calendar years for every state, so it is a watch, never a
 *    conclusion that a seller must register;
 *  - LedgerFlow has checked TX, CA, NY, WA and CO; other states' figures are shown "not verified";
 *  - a customer without a recorded US tax place is not counted in any state, and the count of them is shown.
 * Pure: the same document figures (`taxReturnDocument`) and statuses (`COUNTED_SALES`) as the sales-tax return.
 */
import { COUNTED_SALES } from '../taxCodes';
import { taxReturnDocument, type TaxableDocument } from '../taxReturnDocs';
import { nexusWatch, type NexusWatchResult } from './usNexus';
import { registrationsOn, type TaxPlace, type TaxProfiles } from './profile';

/** The states whose tables LedgerFlow has checked (AI #1, 20 Oct); the same list as the invoice suggestion's. */
export const US_NEXUS_SUPPORTED_STATES = ['TX', 'CA', 'NY', 'WA', 'CO'] as const;

export interface NexusSaleDocument extends TaxableDocument {
  customerId?: string;
}

export interface NexusYear extends NexusWatchResult {
  year: number;
  /** the window measured: 1 Jan to the as-of date this year, the whole calendar year before */
  startDate: string;
  endDate: string;
}

export interface UsNexusStateWatch {
  state: string;
  /** false outside TX, CA, NY, WA and CO */
  verified: boolean;
  /** the seller holds a sales-tax permit for the state on the as-of date */
  permit: boolean;
  thisYear?: NexusYear;
  lastYear?: NexusYear;
  /** a threshold is crossed in either year */
  crossed: boolean;
  /** crossed, or 80% of the way, in either year */
  warning: boolean;
}

export interface UsNexusWatch {
  asOf: string;
  states: UsNexusStateWatch[];
  /** posted sales whose customer has no US tax place recorded: in no state's figures */
  unplacedDocuments: number;
}

const toBase = (cents: number, rate?: number) => Math.round(cents * (rate && rate > 0 ? rate : 1));

export function usNexusWatch(input: {
  asOf: string;
  invoices: NexusSaleDocument[];
  creditNotes?: NexusSaleDocument[];
  customers: Array<{ id: string; metadata?: unknown }>;
  profiles?: TaxProfiles | null;
}): UsNexusWatch {
  const asOf = input.asOf.slice(0, 10);
  const year = Number(asOf.slice(0, 4));
  const windows = [
    { key: 'thisYear' as const, year, startDate: `${year}-01-01`, endDate: asOf },
    { key: 'lastYear' as const, year: year - 1, startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31` },
  ];
  const customers = new Map(input.customers.map(c => [c.id, c]));
  const totals = new Map<string, Record<'thisYear' | 'lastYear', { salesCents: number; orders: number }>>();
  let unplacedDocuments = 0;

  const add = (docs: NexusSaleDocument[] | undefined, sign: 1 | -1) => {
    for (const doc of docs || []) {
      const date = String(doc.date || doc.issueDate || '').slice(0, 10);
      if (!COUNTED_SALES.has(String(doc.status))) continue;
      const window = windows.find(w => date >= w.startDate && date <= w.endDate);
      if (!window) continue;
      const place = ((doc.customerId ? customers.get(doc.customerId) : undefined)?.metadata as { taxPlace?: TaxPlace } | undefined)?.taxPlace;
      if (place && place.country !== 'US') continue; // a sale abroad is in no state
      const state = String(place?.state || '').toUpperCase();
      if (!state) { if (sign === 1) unplacedDocuments++; continue; }
      const row = totals.get(state) || { thisYear: { salesCents: 0, orders: 0 }, lastYear: { salesCents: 0, orders: 0 } };
      // credit notes lower the sales of the year they fall in; they are not sales, so the count is unchanged
      row[window.key].salesCents += sign * toBase(taxReturnDocument(doc).netCents, doc.exchangeRate);
      if (sign === 1) row[window.key].orders += 1;
      totals.set(state, row);
    }
  };
  add(input.invoices, 1);
  add(input.creditNotes, -1);

  // a permit can sit on the books or on any entity label (a Texas LLC under the group)
  const profiles = [...(input.profiles?.books ? [input.profiles.books] : []), ...Object.values(input.profiles?.labels || {})];
  const permitted = (state: string) => profiles.some(p => registrationsOn(p, 'sales_tax', asOf).some(r => r.place.state === state));
  const states = [...totals.entries()].map(([state, row]): UsNexusStateWatch => {
    const years = windows.map(w => {
      const result = nexusWatch({ state, ...row[w.key] }, w.endDate);
      return result ? { ...result, year: w.year, startDate: w.startDate, endDate: w.endDate } : undefined;
    });
    const [thisYear, lastYear] = years;
    return {
      state,
      verified: (US_NEXUS_SUPPORTED_STATES as readonly string[]).includes(state),
      permit: permitted(state),
      ...(thisYear ? { thisYear } : {}),
      ...(lastYear ? { lastYear } : {}),
      crossed: years.some(y => y?.crossed),
      warning: years.some(y => y?.warning),
    };
  });
  const rank = (s: UsNexusStateWatch) => (s.crossed ? 2 : s.warning ? 1 : 0);
  const reach = (s: UsNexusStateWatch) => Math.max(s.thisYear?.ratio ?? 0, s.lastYear?.ratio ?? 0);
  states.sort((a, b) => rank(b) - rank(a) || reach(b) - reach(a) || a.state.localeCompare(b.state));
  return { asOf, states, unplacedDocuments };
}
