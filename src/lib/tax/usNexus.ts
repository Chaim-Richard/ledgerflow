/**
 * A-27 (PLAN US-2): each US state's economic-nexus threshold, as dated rows with a source per row,
 * and the pure "watch" that AI #2's nexus report (C-41) builds on: sales and order counts for the
 * current and last calendar year against the threshold, with a warning at 80%.
 *
 * What this is: the point at which a state may require a seller to register and collect — never a
 * conclusion that a seller must. Physical presence, marketplace sales and the state's own sourcing
 * rules are outside it, and where published summaries disagree the row says so in `note`.
 * Thresholds are whole cents (money in this product is whole cents). `status: 'calculation'`.
 */
export interface UsNexusRow {
  state: string;
  stateName: string;
  /** gross sales into the state that cross the threshold; null = the state has no economic nexus test */
  salesThresholdCents: number | null;
  /** the transaction count, when the state uses one */
  transactions: number | null;
  /** 'either': sales or transactions cross it; 'both': both must */
  test: 'either' | 'both';
  /**
   * the state's wording is "more than": a figure exactly at the threshold has not crossed it (New York). Without it
   * the threshold is met at "or more".
   */
  strict?: boolean;
  validFrom: string;
  validTo?: string;
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-11';
const usd = (dollars: number) => dollars * 100;
const dor = (host: string) => `https://${host}/`;
/** A row for a state that uses the common $100,000 test with no transaction count. */
const simple = (state: string, stateName: string, source: string, validFrom = '2019-01-01', note?: string): UsNexusRow =>
  ({ state, stateName, salesThresholdCents: usd(100_000), transactions: null, test: 'either', validFrom, source, checked: CHECKED, note });
const either200 = (state: string, stateName: string, source: string, validFrom = '2019-01-01', note?: string, validTo?: string): UsNexusRow =>
  ({ state, stateName, salesThresholdCents: usd(100_000), transactions: 200, test: 'either', validFrom, ...(validTo ? { validTo } : {}), source, checked: CHECKED, note });

export const US_NEXUS_THRESHOLDS: UsNexusRow[] = [
  { state: 'AL', stateName: 'Alabama', salesThresholdCents: usd(250_000), transactions: null, test: 'either', validFrom: '2018-10-01', source: dor('www.revenue.alabama.gov'), checked: CHECKED, note: 'revenue only; $250,000' },
  either200('AK', 'Alaska', dor('tax.alaska.gov'), '2019-01-01', 'no state sales tax; the local jurisdictions set the thresholds, $100,000 is the common one'),
  simple('AZ', 'Arizona', dor('azdor.gov'), '2019-10-01', 'revenue only; the transaction test was removed'),
  either200('AR', 'Arkansas', dor('www.dfa.arkansas.gov')),
  { state: 'CA', stateName: 'California', salesThresholdCents: usd(500_000), transactions: null, test: 'either', validFrom: '2019-04-01', source: dor('www.cdtfa.ca.gov'), checked: CHECKED, note: 'revenue only; $500,000, marketplace sales count toward it' },
  simple('CO', 'Colorado', dor('tax.colorado.gov'), '2019-06-01'),
  { state: 'CT', stateName: 'Connecticut', salesThresholdCents: usd(100_000), transactions: 200, test: 'both', validFrom: '2019-07-01', source: dor('portal.ct.gov/DRS'), checked: CHECKED, note: 'both tests, measured over the 12 months to 30 Sep' },
  either200('DC', 'District of Columbia', dor('otr.cfo.dc.gov'), '2019-01-01'),
  { state: 'DE', stateName: 'Delaware', salesThresholdCents: null, transactions: null, test: 'either', validFrom: '2019-01-01', source: dor('revenue.delaware.gov'), checked: CHECKED, note: 'no state sales tax, so no economic-nexus test for sales tax' },
  simple('FL', 'Florida', dor('floridarevenue.com'), '2019-07-01'),
  either200('GA', 'Georgia', dor('dor.georgia.gov'), '2019-01-01'),
  either200('HI', 'Hawaii', dor('tax.hawaii.gov'), '2019-07-01'),
  simple('ID', 'Idaho', dor('tax.idaho.gov'), '2019-06-01'),
  simple('IL', 'Illinois', dor('tax.illinois.gov'), '2026-01-01', 'the 200-transaction test was removed 1 Jan 2026'),
  either200('IL', 'Illinois', dor('tax.illinois.gov'), '2019-01-01', 'before 1 Jan 2026: sales or 200 transactions', '2025-12-31'),
  simple('IN', 'Indiana', dor('www.in.gov/dor'), '2019-01-01'),
  simple('IA', 'Iowa', dor('revenue.iowa.gov'), '2019-01-01'),
  simple('KS', 'Kansas', dor('www.ksrevenue.gov'), '2019-07-01'),
  simple('KY', 'Kentucky', dor('revenue.ky.gov'), '2026-08-01', 'the 200-transaction test dropped 1 Aug 2026'),
  either200('KY', 'Kentucky', dor('revenue.ky.gov'), '2019-01-01', 'before 1 Aug 2026: sales or 200 transactions', '2026-07-31'),
  either200('LA', 'Louisiana', dor('revenue.louisiana.gov'), '2019-01-01', 'summaries differ on whether the transaction count still applies; the 200 count is kept until confirmed'),
  either200('ME', 'Maine', dor('www.maine.gov/revenue'), '2019-01-01', 'summaries differ on whether the transaction count still applies; the 200 count is kept until confirmed'),
  either200('MD', 'Maryland', dor('www.marylandtaxes.gov'), '2019-10-01'),
  simple('MA', 'Massachusetts', dor('www.mass.gov/orgs/massachusetts-department-of-revenue'), '2019-10-01'),
  either200('MI', 'Michigan', dor('www.michigan.gov/treasury'), '2019-01-01'),
  either200('MN', 'Minnesota', dor('www.revenue.state.mn.us'), '2019-01-01'),
  { state: 'MS', stateName: 'Mississippi', salesThresholdCents: usd(250_000), transactions: null, test: 'either', validFrom: '2019-01-01', source: dor('www.dor.ms.gov'), checked: CHECKED, note: 'revenue only; $250,000' },
  simple('MO', 'Missouri', dor('dor.mo.gov'), '2023-01-01'),
  { state: 'MT', stateName: 'Montana', salesThresholdCents: null, transactions: null, test: 'either', validFrom: '2019-01-01', source: dor('mtrevenue.gov'), checked: CHECKED, note: 'no state sales tax; resort-area local taxes are separate' },
  either200('NE', 'Nebraska', dor('revenue.nebraska.gov'), '2019-01-01'),
  either200('NV', 'Nevada', dor('tax.nv.gov'), '2019-01-01'),
  { state: 'NH', stateName: 'New Hampshire', salesThresholdCents: null, transactions: null, test: 'either', validFrom: '2019-01-01', source: dor('www.revenue.nh.gov'), checked: CHECKED, note: 'no general sales tax' },
  either200('NJ', 'New Jersey', dor('www.nj.gov/treasury/taxation'), '2019-10-01'),
  simple('NM', 'New Mexico', dor('www.tax.newmexico.gov'), '2019-07-01', 'gross receipts tax, revenue only'),
  { state: 'NY', stateName: 'New York', salesThresholdCents: usd(500_000), transactions: 100, test: 'both', strict: true, validFrom: '2019-01-01', source: dor('www.tax.ny.gov'), checked: CHECKED, note: 'both tests: more than $500,000 and more than 100 sales in the last four quarters' },
  simple('NC', 'North Carolina', dor('www.ncdor.gov'), '2024-07-01', 'the 200-transaction test was removed 1 Jul 2024'),
  either200('NC', 'North Carolina', dor('www.ncdor.gov'), '2019-01-01', 'before 1 Jul 2024: sales or 200 transactions', '2024-06-30'),
  simple('ND', 'North Dakota', dor('www.tax.nd.gov'), '2019-01-01'),
  either200('OH', 'Ohio', dor('tax.ohio.gov'), '2019-08-01'),
  simple('OK', 'Oklahoma', dor('oklahoma.gov/tax.html'), '2019-01-01'),
  { state: 'OR', stateName: 'Oregon', salesThresholdCents: null, transactions: null, test: 'either', validFrom: '2019-01-01', source: dor('www.oregon.gov/dor'), checked: CHECKED, note: 'no general sales tax' },
  simple('PA', 'Pennsylvania', dor('www.revenue.pa.gov'), '2019-07-01'),
  either200('RI', 'Rhode Island', dor('tax.ri.gov'), '2019-07-01'),
  simple('SC', 'South Carolina', dor('dor.sc.gov'), '2019-11-01'),
  simple('SD', 'South Dakota', dor('dor.sd.gov'), '2023-07-01', 'the 200-transaction test was removed in 2023'),
  either200('SD', 'South Dakota', dor('dor.sd.gov'), '2019-01-01', 'before 2023: sales or 200 transactions', '2023-06-30'),
  simple('TN', 'Tennessee', dor('www.tn.gov/revenue.html'), '2020-10-01'),
  { state: 'TX', stateName: 'Texas', salesThresholdCents: usd(500_000), transactions: null, test: 'either', validFrom: '2019-10-01', source: dor('comptroller.texas.gov'), checked: CHECKED, note: 'revenue only; $500,000 based on total Texas revenue' },
  simple('UT', 'Utah', dor('tax.utah.gov'), '2025-07-01', 'the 200-transaction test was removed 1 Jul 2025'),
  either200('UT', 'Utah', dor('tax.utah.gov'), '2019-01-01', 'before 1 Jul 2025: sales or 200 transactions', '2025-06-30'),
  either200('VT', 'Vermont', dor('tax.vermont.gov'), '2019-07-01'),
  either200('VA', 'Virginia', dor('www.tax.virginia.gov'), '2019-07-01'),
  simple('WA', 'Washington', dor('dor.wa.gov'), '2019-03-01'),
  either200('WV', 'West Virginia', dor('tax.wv.gov'), '2019-01-01'),
  simple('WI', 'Wisconsin', dor('www.revenue.wi.gov'), '2019-01-01', 'summaries differ on whether the transaction count still applies; revenue only is kept until confirmed'),
  { state: 'WY', stateName: 'Wyoming', salesThresholdCents: usd(100_000), transactions: 200, test: 'either', validFrom: '2019-02-01', source: dor('revenue.wyo.gov'), checked: CHECKED, note: 'summaries differ on whether the transaction count still applies; the 200 count is kept until confirmed' },
];

export const US_NEXUS_STATES: string[] = [...new Set(US_NEXUS_THRESHOLDS.map(r => r.state))];

/** The threshold row in force for a state on a date (the newest row that applies). */
export function nexusThreshold(state: string, date: string): UsNexusRow | undefined {
  const code = state.toUpperCase();
  return US_NEXUS_THRESHOLDS.filter(r => r.state === code && r.validFrom <= date && (!r.validTo || date <= r.validTo)).at(-1);
}

export interface NexusWatchInput {
  state: string;
  /** gross sales into the state in the window, whole cents */
  salesCents: number;
  /** the number of orders/sales in the window */
  orders: number;
}

export interface NexusWatchResult {
  state: string;
  stateName: string;
  salesCents: number;
  orders: number;
  salesThresholdCents: number | null;
  transactions: number | null;
  test: 'either' | 'both';
  /** sales ÷ sales threshold, and orders ÷ transaction threshold — the larger of the two */
  ratio: number | null;
  /** the thresholds are crossed (the test is met) */
  crossed: boolean;
  /** at least 80% of the way there, or crossed: the state to watch */
  warning: boolean;
  source: string;
  note?: string;
}

/** The 80% line: the product warns before a threshold is crossed, not after. */
export const NEXUS_WARNING_RATIO = 0.8;

/**
 * The nexus watch for one state and window. Pure: it compares the numbers it is given; it fetches
 * nothing and it never says "you must register" — `crossed` means the state's test is met, which is
 * the point to ask an accountant.
 */
export function nexusWatch(input: NexusWatchInput, date: string): NexusWatchResult | undefined {
  const row = nexusThreshold(input.state, date);
  if (!row) return undefined;
  const base: NexusWatchResult = {
    state: row.state, stateName: row.stateName, salesCents: input.salesCents, orders: input.orders,
    salesThresholdCents: row.salesThresholdCents, transactions: row.transactions, test: row.test,
    ratio: null, crossed: false, warning: false, source: row.source, ...(row.note ? { note: row.note } : {}),
  };
  if (row.salesThresholdCents === null && row.transactions === null) return base;
  const salesRatio = row.salesThresholdCents === null ? null : input.salesCents / row.salesThresholdCents;
  const orderRatio = row.transactions === null ? null : input.orders / row.transactions;
  // "more than" (strict) vs "or more": exactly at the threshold has crossed only in the second case
  const meets = (value: number, threshold: number) => (row.strict ? value > threshold : value >= threshold);
  const salesMet = salesRatio !== null && meets(input.salesCents, row.salesThresholdCents!);
  const ordersMet = orderRatio !== null && meets(input.orders, row.transactions!);
  const crossed = row.test === 'both' ? salesMet && ordersMet : salesMet || ordersMet;
  const ratios = [salesRatio, orderRatio].filter((r): r is number => r !== null);
  const ratio = ratios.length ? Math.max(...ratios) : null;
  const warning = crossed || (ratio !== null && ratio >= NEXUS_WARNING_RATIO);
  return { ...base, ratio, crossed, warning };
}

/** The watch for many states at once, only for the states with something to watch. */
export function nexusWatchAll(inputs: NexusWatchInput[], date: string): NexusWatchResult[] {
  return inputs.map(i => nexusWatch(i, date)).filter((r): r is NexusWatchResult => Boolean(r));
}
