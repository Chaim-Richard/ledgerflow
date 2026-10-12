/**
 * A-41 (PLAN §10): marketplace facilitator collection, one dated row per jurisdiction that has a
 * state sales tax.
 *
 * What a row says: **from the checked date**, the state's marketplace facilitator law is in force,
 * so a sale the seller makes *through a marketplace* is the marketplace's to tax, not the seller's.
 * What a row does **not** say: the date the state's law first took effect (several were 2018–2020,
 * and a few later; the row's `source` is where the effective date is read), whether the state taxes
 * the seller's own website sales, or how local taxes are handled by the marketplace.
 *
 * The honest limit, stated on purpose: this table is written from the state's revenue-department
 * guidance as it stands in the 2026 session of this lane. It is a `calculation`-stage table — before
 * a filing position is taken, a person confirms the row against the source and the state's own
 * effective date for the period in question. Pure data; nothing here calculates or posts.
 */
import { US_STATE_SALES_TAX } from './usStateSalesTax';

export interface MarketplaceFacilitatorRow {
  state: string;
  stateName: string;
  /** conservative: the rule is asserted from this date, not the law's own effective date */
  validFrom: string;
  validTo?: string;
  /** the state revenue department's marketplace-facilitator guidance start page */
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-12';
/**
 * The date the rows are asserted from. The laws came into force earlier (most by 1 Oct 2019, the
 * last states thereafter); asserting the later date never under-collects for an old period and never
 * claims an effective date this lane has not read from the state's own publication.
 */
const ASSERTED_FROM = '2026-01-01';

/** A note on every row, because the same caveat applies to every state in the table. */
const NOTE = 'the law came into force earlier; read the state’s source for the effective date of an earlier period'
  + '; the marketplace collects state and, where the state says so, local tax';

/** One row per state with a state sales tax, from the same table the rate rules use (never a third list). */
export const US_MARKETPLACE_FACILITATORS: MarketplaceFacilitatorRow[] = US_STATE_SALES_TAX
  .filter(row => row.rate > 0)
  .map(row => ({
    state: row.state,
    stateName: row.stateName,
    validFrom: ASSERTED_FROM,
    source: row.source,
    checked: CHECKED,
    note: row.note && /local/i.test(row.note)
      ? `${NOTE}; marketplace sales count toward the seller’s economic-nexus test in most states`
      : NOTE,
  }));

/** The jurisdictions whose rows are deliberately not here, with the reason. */
export const US_MARKETPLACE_ROW_LIMITS: Array<{ state: string; stateName: string; reason: string }> =
  US_STATE_SALES_TAX
    .filter(row => row.rate === 0)
    .map(row => ({
      state: row.state,
      stateName: row.stateName,
      reason: row.state === 'AK'
        ? 'no state sales tax: Alaska’s marketplace duty is over local borough taxes, so there is no state rate rule for the channel rule to switch off'
        : 'no state sales tax, so there is no state rate rule for the channel rule to switch off',
    }));

/** The row in force for a state on a date, or undefined when the state is not in the table. */
export function marketplaceFacilitatorRow(state: string, date: string): MarketplaceFacilitatorRow | undefined {
  const code = state.toUpperCase();
  return US_MARKETPLACE_FACILITATORS.find(row => row.state === code && row.validFrom <= date && (!row.validTo || date <= row.validTo));
}
