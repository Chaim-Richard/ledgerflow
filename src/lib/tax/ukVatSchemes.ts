/**
 * A-53 (PLAN): the UK's VAT special schemes — the Flat Rate Scheme percentages by business type and
 * the scheme turnover thresholds — as dated rows with GOV.UK sources.
 *
 * What this is: the FRS percentage list a scheme user picks their own business category from (the
 * percentages have stood since 1 April 2017, when the limited-cost-trader rate was introduced), and
 * the entry/exit figures GOV.UK gives for the flat rate, cash accounting and annual accounting
 * schemes. What it is not: the whole GOV.UK table. The rows below are the categories this file
 * states with confidence; a business whose category is not here must read the official page before
 * choosing a percentage — this table never guesses one. FRS is an HMRC approval and the business's
 * own declaration of its category; nothing here registers anyone or files anything.
 */

export interface UkFrsCategoryRow {
  /** the slug a `schemeCategory` fact carries (facts.ts, A-53) */
  category: string;
  /** the GOV.UK table's own words for the category */
  categoryName: string;
  /** percent of VAT-inclusive turnover paid to HMRC (14.5 means 14.5%) */
  percent: number;
  validFrom: string;
  validTo?: string;
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-13';
const FRS_RATES = 'https://www.gov.uk/vat-flat-rate-scheme/rates-for-your-type-of-business';
const FRS = 'https://www.gov.uk/vat-flat-rate-scheme';
const CASH = 'https://www.gov.uk/vat-cash-accounting-scheme';
const ANNUAL = 'https://www.gov.uk/vat-annual-accounting-scheme';
const FROM = '2017-04-01';

const frs = (category: string, categoryName: string, percent: number, note?: string): UkFrsCategoryRow =>
  ({ category, categoryName, percent, validFrom: FROM, source: FRS_RATES, checked: CHECKED, ...(note ? { note } : {}) });

/** The FRS percentages this file states with confidence; GOV.UK's own table governs. */
export const UK_FRS_CATEGORIES: UkFrsCategoryRow[] = [
  frs('accountancy', 'Accountancy or book-keeping', 14.5),
  frs('advertising', 'Advertising', 11),
  frs('agricultural-services', 'Agricultural services', 11),
  frs('air-transport', 'Air transport', 6.5),
  frs('architecture-surveying-engineering', 'Architectural, surveying and engineering services', 11),
  frs('arts-culture', 'Arts and culture', 6.5),
  frs('automotive-repair', 'Automotive repair services', 10.5),
  frs('animal-boarding', 'Boarding or care of animals', 12),
  frs('building-fabric', 'Building, fabric modifications or repairs', 9.5),
  frs('business-services-other', 'Business services not listed elsewhere', 12),
  frs('catering', 'Catering including restaurants and takeaways', 12.5),
  frs('computer-it-consultancy', 'Computer and IT consultancy', 14.5),
  frs('computer-repair', 'Computer repair services', 10.5),
  frs('couriers-freight-transport', 'Couriers, freight and other transport', 10.5),
  frs('electrical-engineering', 'Electrical, electronic or computer engineering', 10.5),
  frs('employment-agency', 'Employment agency or business', 11),
  frs('entertainment-sport-recreation', 'Entertainment, sport or recreation', 6.5),
  frs('estate-agency', 'Estate agency or property management services', 12),
  frs('farming-food-processing', 'Farming or food processing', 6.5),
  frs('film-radio-tv', 'Film, radio, television or video production', 12.5),
  frs('forestry-fishing', 'Forestry and fishing', 6.5),
  frs('health-social-services', 'Health or social services', 10),
  frs('hiring-renting-goods', 'Hiring or renting goods', 10.5),
  frs('investigation-security', 'Investigation or security', 12),
  frs('journalist', 'Journalist', 12.5),
  frs('laundrette-dry-cleaning', 'Laundrette or dry-cleaning', 12),
  frs('lawyers-legal', 'Lawyers or legal services', 14.5),
  frs('library-archive-museum', 'Library, archive or museum', 6.5),
  frs('management-consultancy', 'Management consultancy', 14),
  frs('mining-quarrying', 'Mining or quarrying', 10),
  frs('photographers', 'Photographers', 10.5),
  frs('pubs', 'Pubs', 6.5),
  frs('real-estate', 'Real estate activity', 12),
  frs('repair-maintenance', 'Repair or maintenance', 10.5),
  frs('research-development', 'Research and development', 14),
  frs('retail-food', 'Retail food, confectionery, tobacco, newspapers or children\u2019s clothing', 4),
  frs('retail-pharmacy', 'Retail pharmacy, dispensing optician, optometrist or medical goods', 8),
  frs('retail-other', 'Retail other', 7.5),
  frs('social-work', 'Social work', 10),
  frs('transport-storage', 'Transport or storage', 10.5),
  frs('travel-agency', 'Travel agency or tour operator', 10),
  frs('wholesale', 'Wholesale', 7.5),
  frs('limited-cost-trader', 'Limited cost trader', 16.5,
    'a business whose spending on relevant goods is less than 2% of its VAT-inclusive turnover in a year, or less than £1,000 a year, uses this rate whatever its category'),
];

/** The first year of FRS registration takes 1 percentage point off the category rate (GOV.UK). */
export const UK_FRS_FIRST_YEAR_DISCOUNT_POINTS = 1;

export type UkSchemeThresholdId = 'uk-flat-rate-entry' | 'uk-flat-rate-exit' | 'uk-cash-accounting' | 'uk-annual-accounting';

export interface UkSchemeThresholdRow {
  id: UkSchemeThresholdId;
  name: string;
  thresholdCents: number;
  currency: 'GBP';
  /** what is measured, in GOV.UK's words */
  measure: string;
  validFrom: string;
  source: string;
  checked: string;
  note?: string;
}

/** The scheme turnover thresholds (entry and exit), as dated rows. */
export const UK_VAT_SCHEME_THRESHOLDS: UkSchemeThresholdRow[] = [
  {
    id: 'uk-flat-rate-entry', name: 'Flat Rate Scheme entry', thresholdCents: 15_000_000, currency: 'GBP',
    measure: 'expected VAT taxable turnover in the next 12 months, excluding VAT',
    validFrom: FROM, source: FRS, checked: CHECKED,
    note: '£150,000; the figure GOV.UK states today, unchanged since at least 1 April 2017',
  },
  {
    id: 'uk-flat-rate-exit', name: 'Flat Rate Scheme exit', thresholdCents: 23_000_000, currency: 'GBP',
    measure: 'total income, including VAT and exempt or out-of-scope income, in any 12-month period',
    validFrom: FROM, source: FRS, checked: CHECKED,
    note: '£230,000; leaving the scheme is tested on total income, not on the entry measure',
  },
  {
    id: 'uk-cash-accounting', name: 'Cash accounting scheme', thresholdCents: 135_000_000, currency: 'GBP',
    measure: 'estimated VAT taxable turnover in the next 12 months, excluding VAT',
    validFrom: '2022-04-01', source: CASH, checked: CHECKED,
    note: 'raised from £150,000 to £1,350,000 on 1 April 2022',
  },
  {
    id: 'uk-annual-accounting', name: 'Annual accounting scheme', thresholdCents: 135_000_000, currency: 'GBP',
    measure: 'estimated VAT taxable turnover in the next 12 months, excluding VAT',
    validFrom: '2022-04-01', source: ANNUAL, checked: CHECKED,
    note: 'raised from £150,000 to £1,350,000 on 1 April 2022',
  },
];

/** The category row for a slug, on a date (the percentages have one dated generation today). */
export function ukFrsCategory(slug: string, date: string): UkFrsCategoryRow | undefined {
  return UK_FRS_CATEGORIES.find(row => row.category === slug && row.validFrom <= date && (!row.validTo || date <= row.validTo));
}

/** The percent a scheme user pays on a date, with the first-year discount when asked for. */
export function ukFrsPercent(slug: string, date: string, firstYear = false): number | undefined {
  const row = ukFrsCategory(slug, date);
  if (!row) return undefined;
  return firstYear ? Math.max(0, row.percent - UK_FRS_FIRST_YEAR_DISCOUNT_POINTS) : row.percent;
}

/** Structural problems in the table (a bug in this file, not a tax opinion): never empty on the real table. */
export function ukSchemeProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of UK_FRS_CATEGORIES) {
    if (seen.has(row.category)) problems.push(`${row.category}: duplicate category`);
    seen.add(row.category);
    if (!(row.percent > 0 && row.percent <= 16.5)) problems.push(`${row.category}: ${row.percent}% is outside the FRS range GOV.UK publishes (up to the 16.5% limited-cost-trader rate)`);
    if (!/^https:\/\/www\.gov\.uk\//.test(row.source)) problems.push(`${row.category}: the source must be a GOV.UK page`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.validFrom)) problems.push(`${row.category}: validFrom is not a date`);
  }
  for (const row of UK_VAT_SCHEME_THRESHOLDS) {
    if (!(row.thresholdCents > 0)) problems.push(`${row.id}: the threshold must be positive`);
    if (row.currency !== 'GBP') problems.push(`${row.id}: a UK scheme threshold is in GBP`);
    if (!/^https:\/\/www\.gov\.uk\//.test(row.source)) problems.push(`${row.id}: the source must be a GOV.UK page`);
  }
  if (!seen.has('limited-cost-trader')) problems.push('the limited-cost-trader rate is missing');
  return problems;
}
