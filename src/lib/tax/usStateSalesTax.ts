/**
 * A-22 / PLAN US-1: the US state sales-tax table — 50 states + DC, the state's own base rate as a
 * dated row, whether shipping is taxed and whether the state is origin- or destination-based.
 *
 * What this is: a reviewed **state-level** table with one source link per row (the state's revenue
 * department). It is what `resolveLineTax` plugs into as `US-<state>` (`usStateSalesTaxRateTable`).
 * What it is not: county, city and district rates (that is L-1 and the state rate files), product
 * exemptions (A-31) or nexus (A-27) — a state with nexus but no base rate in a local table still
 * needs the local rows before the amount is right. Every row is `status: 'calculation'`.
 *
 * Honesty about dates: `validFrom` is the date from which the row is asserted to apply. Where the
 * state's last change is well documented it is that date; where it is not, the row starts at
 * `2000-01-01` and says so in `note` — never a made-up date. `checked` is the day a person compared
 * the row with the source. Rates are fractions (6.25% = 0.0625).
 */
import type { RateTable, TaxComponent } from './resolveLineTax';
import type { TaxPlace } from './profile';

export type ShippingTreatment = 'taxable' | 'exempt-separately-stated' | 'mixed' | 'no-state-tax';
export type Sourcing = 'origin' | 'destination';

export interface UsStateSalesTaxRow {
  /** USPS state code (the key `resolveLineTax` looks up as `US-<state>`) */
  state: string;
  stateName: string;
  /** the state's own base rate, as a fraction of the sale */
  rate: number;
  /** how a separately stated delivery charge is treated */
  shipping: ShippingTreatment;
  sourcing: Sourcing;
  validFrom: string;
  validTo?: string;
  source: string;
  /** the day this row was compared with the source */
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-11';
const dor = (host: string) => `https://${host}/`;

/**
 * The states and DC, A→W. Base rates are the 2026 state rates; the 2026 changes in the sources are
 * the rows here (Louisiana's 5% from 1 Jan 2025, Illinois' and Utah's removed transaction tests are
 * nexus rows in A-27, not rates).
 */
export const US_STATE_SALES_TAX: UsStateSalesTaxRow[] = [
  { state: 'AL', stateName: 'Alabama', rate: 0.04, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2000-01-01', source: dor('www.revenue.alabama.gov'), checked: CHECKED, note: '4% state rate unchanged; exact last change not verified in this table' },
  { state: 'AK', stateName: 'Alaska', rate: 0, shipping: 'no-state-tax', sourcing: 'destination', validFrom: '2000-01-01', source: dor('tax.alaska.gov'), checked: CHECKED, note: 'no state sales tax; local boroughs tax, so the rate is 0 until local rows exist' },
  { state: 'AZ', stateName: 'Arizona', rate: 0.056, shipping: 'exempt-separately-stated', sourcing: 'origin', validFrom: '2013-06-01', source: dor('azdor.gov'), checked: CHECKED, note: '5.6% from 1 Jun 2013 (was 6.6%); city rates add and are not in this table' },
  { state: 'AR', stateName: 'Arkansas', rate: 0.065, shipping: 'taxable', sourcing: 'destination', validFrom: '2013-07-01', source: dor('www.dfa.arkansas.gov'), checked: CHECKED },
  { state: 'CA', stateName: 'California', rate: 0.0725, shipping: 'exempt-separately-stated', sourcing: 'origin', validFrom: '2004-07-01', source: dor('www.cdtfa.ca.gov'), checked: CHECKED, note: '7.25% statewide base; district taxes add (local rows, L-1). Shipping exempt only when separately stated at or below actual carrier cost' },
  { state: 'CO', stateName: 'Colorado', rate: 0.029, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2001-01-01', source: dor('tax.colorado.gov'), checked: CHECKED, note: 'home-rule cities set their own base and rules (L-3)' },
  { state: 'CT', stateName: 'Connecticut', rate: 0.0635, shipping: 'taxable', sourcing: 'destination', validFrom: '2011-07-01', source: dor('portal.ct.gov/DRS'), checked: CHECKED, note: '6.35% from 1 Jul 2011' },
  { state: 'DC', stateName: 'District of Columbia', rate: 0.06, shipping: 'taxable', sourcing: 'destination', validFrom: '2013-10-01', source: dor('otr.cfo.dc.gov'), checked: CHECKED, note: '6% from 1 Oct 2013 (5.75% before)' },
  { state: 'DE', stateName: 'Delaware', rate: 0, shipping: 'no-state-tax', sourcing: 'destination', validFrom: '2000-01-01', source: dor('revenue.delaware.gov'), checked: CHECKED, note: 'no state sales tax; a gross receipts tax applies to sellers' },
  { state: 'FL', stateName: 'Florida', rate: 0.06, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2000-01-01', source: dor('floridarevenue.com'), checked: CHECKED, note: '6% state rate unchanged; discretionary county surtaxes add' },
  { state: 'GA', stateName: 'Georgia', rate: 0.04, shipping: 'taxable', sourcing: 'destination', validFrom: '2000-01-01', source: dor('dor.georgia.gov'), checked: CHECKED, note: '4% state rate; local 2–4% add (L-1)' },
  { state: 'HI', stateName: 'Hawaii', rate: 0.04, shipping: 'taxable', sourcing: 'destination', validFrom: '2000-01-01', source: dor('tax.hawaii.gov'), checked: CHECKED, note: 'general excise tax (GET) at 4% state (4.5% on Oahu), not a true sales tax' },
  { state: 'ID', stateName: 'Idaho', rate: 0.06, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2006-10-01', source: dor('tax.idaho.gov'), checked: CHECKED },
  { state: 'IL', stateName: 'Illinois', rate: 0.0625, shipping: 'mixed', sourcing: 'origin', validFrom: '1990-07-01', source: dor('tax.illinois.gov'), checked: CHECKED, note: 'grocery tax removed 2026; home-rule and transit rates add; shipping an “inseparable link” is taxable' },
  { state: 'IN', stateName: 'Indiana', rate: 0.07, shipping: 'taxable', sourcing: 'destination', validFrom: '2008-04-01', source: dor('www.in.gov/dor'), checked: CHECKED },
  { state: 'IA', stateName: 'Iowa', rate: 0.06, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2008-01-01', source: dor('revenue.iowa.gov'), checked: CHECKED },
  { state: 'KS', stateName: 'Kansas', rate: 0.065, shipping: 'taxable', sourcing: 'destination', validFrom: '2003-07-01', source: dor('www.ksrevenue.gov'), checked: CHECKED, note: 'delivery charges separately stated are exempt from 1 Jul 2023; local rates add' },
  { state: 'KY', stateName: 'Kentucky', rate: 0.06, shipping: 'taxable', sourcing: 'destination', validFrom: '2007-06-01', source: dor('revenue.ky.gov'), checked: CHECKED },
  { state: 'LA', stateName: 'Louisiana', rate: 0.05, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2025-01-01', source: dor('revenue.louisiana.gov'), checked: CHECKED, note: '5% from 1 Jan 2025 (4.45% before); local rates add' },
  { state: 'ME', stateName: 'Maine', rate: 0.055, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2013-01-01', source: dor('www.maine.gov/revenue'), checked: CHECKED, note: '5.5% (5% from 1 Jul 2016 on some months); use this row until a dated history is reviewed' },
  { state: 'MD', stateName: 'Maryland', rate: 0.06, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2008-01-01', source: dor('www.marylandtaxes.gov'), checked: CHECKED },
  { state: 'MA', stateName: 'Massachusetts', rate: 0.0625, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2009-08-01', source: dor('www.mass.gov/orgs/massachusetts-department-of-revenue'), checked: CHECKED },
  { state: 'MI', stateName: 'Michigan', rate: 0.06, shipping: 'mixed', sourcing: 'destination', validFrom: '2007-10-01', source: dor('www.michigan.gov/treasury'), checked: CHECKED, note: 'most separately stated delivery charges are not taxed from 2024; SSUTA default differs' },
  { state: 'MN', stateName: 'Minnesota', rate: 0.06875, shipping: 'taxable', sourcing: 'destination', validFrom: '2009-07-01', source: dor('www.revenue.state.mn.us'), checked: CHECKED },
  { state: 'MS', stateName: 'Mississippi', rate: 0.07, shipping: 'taxable', sourcing: 'origin', validFrom: '2000-01-01', source: dor('www.dor.ms.gov'), checked: CHECKED },
  { state: 'MO', stateName: 'Missouri', rate: 0.04225, shipping: 'exempt-separately-stated', sourcing: 'origin', validFrom: '2000-01-01', source: dor('dor.mo.gov'), checked: CHECKED, note: '4.225% state rate; local rates add' },
  { state: 'MT', stateName: 'Montana', rate: 0, shipping: 'no-state-tax', sourcing: 'destination', validFrom: '2000-01-01', source: dor('mtrevenue.gov'), checked: CHECKED, note: 'no state sales tax; resort and local taxes exist' },
  { state: 'NE', stateName: 'Nebraska', rate: 0.055, shipping: 'taxable', sourcing: 'destination', validFrom: '2016-01-01', source: dor('revenue.nebraska.gov'), checked: CHECKED },
  { state: 'NV', stateName: 'Nevada', rate: 0.0685, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2015-01-01', source: dor('tax.nv.gov'), checked: CHECKED, note: '6.85% state base; county rates add' },
  { state: 'NH', stateName: 'New Hampshire', rate: 0, shipping: 'no-state-tax', sourcing: 'destination', validFrom: '2000-01-01', source: dor('www.revenue.nh.gov'), checked: CHECKED, note: 'no general sales tax; meals, rooms and rentals are taxed separately' },
  { state: 'NJ', stateName: 'New Jersey', rate: 0.06625, shipping: 'taxable', sourcing: 'destination', validFrom: '2018-01-01', source: dor('www.nj.gov/treasury/taxation'), checked: CHECKED, note: '6.625% from 1 Jan 2018 (6.875% before); urban enterprise zones are exceptions' },
  { state: 'NM', stateName: 'New Mexico', rate: 0.04875, shipping: 'taxable', sourcing: 'origin', validFrom: '2020-01-01', source: dor('www.tax.newmexico.gov'), checked: CHECKED, note: 'gross receipts tax, not a sales tax; a state base plus local rates' },
  { state: 'NY', stateName: 'New York', rate: 0.04, shipping: 'taxable', sourcing: 'destination', validFrom: '2000-01-01', source: dor('www.tax.ny.gov'), checked: CHECKED, note: '4% state rate; city and county rates add (NYC 4.5% state+city portion)' },
  { state: 'NC', stateName: 'North Carolina', rate: 0.0475, shipping: 'taxable', sourcing: 'destination', validFrom: '2015-01-01', source: dor('www.ncdor.gov'), checked: CHECKED },
  { state: 'ND', stateName: 'North Dakota', rate: 0.05, shipping: 'taxable', sourcing: 'destination', validFrom: '2000-01-01', source: dor('www.tax.nd.gov'), checked: CHECKED },
  { state: 'OH', stateName: 'Ohio', rate: 0.0575, shipping: 'taxable', sourcing: 'origin', validFrom: '2013-09-01', source: dor('tax.ohio.gov'), checked: CHECKED },
  { state: 'OK', stateName: 'Oklahoma', rate: 0.045, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2000-01-01', source: dor('oklahoma.gov/tax.html'), checked: CHECKED },
  { state: 'OR', stateName: 'Oregon', rate: 0, shipping: 'no-state-tax', sourcing: 'destination', validFrom: '2000-01-01', source: dor('www.oregon.gov/dor'), checked: CHECKED, note: 'no general sales tax; vehicle and transit taxes exist' },
  { state: 'PA', stateName: 'Pennsylvania', rate: 0.06, shipping: 'taxable', sourcing: 'origin', validFrom: '2000-01-01', source: dor('www.revenue.pa.gov'), checked: CHECKED, note: 'Philadelphia and Allegheny County add local sales tax' },
  { state: 'RI', stateName: 'Rhode Island', rate: 0.07, shipping: 'taxable', sourcing: 'destination', validFrom: '2013-01-01', source: dor('tax.ri.gov'), checked: CHECKED },
  { state: 'SC', stateName: 'South Carolina', rate: 0.06, shipping: 'taxable', sourcing: 'destination', validFrom: '2007-06-01', source: dor('dor.sc.gov'), checked: CHECKED, note: '6% state rate; local rates add; 7% on vehicles, 6% cap on some items' },
  { state: 'SD', stateName: 'South Dakota', rate: 0.042, shipping: 'taxable', sourcing: 'destination', validFrom: '2000-01-01', source: dor('dor.sd.gov'), checked: CHECKED, note: '4.2% state rate; municipal rates add' },
  { state: 'TN', stateName: 'Tennessee', rate: 0.07, shipping: 'taxable', sourcing: 'origin', validFrom: '2000-01-01', source: dor('www.tn.gov/revenue.html'), checked: CHECKED, note: '7% state on most goods (the food rate is lower); local rates add' },
  { state: 'TX', stateName: 'Texas', rate: 0.0625, shipping: 'taxable', sourcing: 'origin', validFrom: '2000-01-01', source: dor('comptroller.texas.gov'), checked: CHECKED, note: '6.25% state (2% cap local, so 8.25% max); shipping taxable on a taxable sale' },
  { state: 'UT', stateName: 'Utah', rate: 0.061, shipping: 'exempt-separately-stated', sourcing: 'origin', validFrom: '2000-01-01', source: dor('tax.utah.gov'), checked: CHECKED, note: '6.1% statewide base (state + local option); point-of-sale rules differ for remote sellers' },
  { state: 'VT', stateName: 'Vermont', rate: 0.06, shipping: 'taxable', sourcing: 'destination', validFrom: '2007-07-01', source: dor('tax.vermont.gov'), checked: CHECKED, note: '6% state; 7% meals, 9% rooms, 10% alcohol' },
  { state: 'VA', stateName: 'Virginia', rate: 0.053, shipping: 'exempt-separately-stated', sourcing: 'origin', validFrom: '2013-07-01', source: dor('www.tax.virginia.gov'), checked: CHECKED, note: '4.3% state + 1% regional transportation in some areas = 5.3%' },
  { state: 'WA', stateName: 'Washington', rate: 0.065, shipping: 'taxable', sourcing: 'origin', validFrom: '2000-01-01', source: dor('dor.wa.gov'), checked: CHECKED, note: '6.5% state; local rates add; destination applies to remote sellers' },
  { state: 'WV', stateName: 'West Virginia', rate: 0.06, shipping: 'taxable', sourcing: 'destination', validFrom: '2000-01-01', source: dor('tax.wv.gov'), checked: CHECKED, note: '6% state (6% + 1% municipal in some cities)' },
  { state: 'WI', stateName: 'Wisconsin', rate: 0.05, shipping: 'mixed', sourcing: 'destination', validFrom: '2000-01-01', source: dor('www.revenue.wi.gov'), checked: CHECKED, note: '5% state; county and stadium rates add; delivery charges paid by the buyer to a carrier are exempt' },
  { state: 'WY', stateName: 'Wyoming', rate: 0.04, shipping: 'exempt-separately-stated', sourcing: 'destination', validFrom: '2000-01-01', source: dor('revenue.wyo.gov'), checked: CHECKED, note: '4% state; county rates add' },
];

/** The two-letter codes this table knows, in order. */
export const US_SALES_TAX_STATES: string[] = US_STATE_SALES_TAX.map(r => r.state);

/** The five states with no state-level sales tax. */
export const NO_STATE_SALES_TAX = ['AK', 'DE', 'MT', 'NH', 'OR'];

/** Origin-based for intrastate sales (the rest are destination-based). */
export const ORIGIN_SOURCING_STATES = US_STATE_SALES_TAX.filter(r => r.sourcing === 'origin').map(r => r.state);

const inForce = (r: UsStateSalesTaxRow, date: string) => r.validFrom <= date && (!r.validTo || date <= r.validTo);

/** The rows for a state in force on a date (newest last; more than one only while history is kept). */
export function stateSalesTaxRows(state: string, date: string): UsStateSalesTaxRow[] {
  const code = state.toUpperCase();
  return US_STATE_SALES_TAX.filter(r => r.state === code && inForce(r, date));
}

/** The state's base rate on a date, or undefined when the state is not in the table. */
export function stateSalesTaxRate(state: string, date: string): number | undefined {
  const row = stateSalesTaxRows(state, date).at(-1);
  return row?.rate;
}

/** Whether a separately stated delivery charge is taxed on a date; undefined when the state is unknown. */
export function shippingTreatment(state: string, date: string): ShippingTreatment | undefined {
  return stateSalesTaxRows(state, date).at(-1)?.shipping;
}

/**
 * The `RateTables['US-XX']` entry `resolveLineTax` uses: the state's base rate for the buyer's state
 * on the date. A state with no base rate answers a single 0% state component and says the local rows
 * are still missing — never `undefined` for a known state (that would read as "no table at all").
 */
export function usStateSalesTaxRateTable(rows: UsStateSalesTaxRow[] = US_STATE_SALES_TAX): RateTable {
  return (place: TaxPlace, date: string): TaxComponent[] | undefined => {
    if (place.country !== 'US' || !place.state) return undefined;
    const row = rows.filter(r => r.state === place.state!.toUpperCase() && r.validFrom <= date && (!r.validTo || date <= r.validTo)).at(-1);
    if (!row) return undefined;
    return [{ level: 'state', name: `${row.stateName} state sales tax`, rate: row.rate }];
  };
}

/** The buyer's shipping treatment, for screens and for the taxability table (A-31). */
export function usShippingIsTaxable(state: string, date: string): boolean | undefined {
  const treatment = shippingTreatment(state, date);
  if (treatment === undefined || treatment === 'mixed') return undefined;
  return treatment === 'taxable';
}
