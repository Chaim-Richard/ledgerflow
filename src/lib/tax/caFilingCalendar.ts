/**
 * A-51 (PLAN): when each Canadian consumption-tax return is commonly filed — GST/HST by annual
 * revenue band (CRA), QST by annual revenue band (Revenu Québec), and the three provincial sales
 * taxes (BC, SK, MB). Dated rows, one official source per row.
 *
 * What this is: a **planning** table, like A-28's US one. The authority assigns the filing period
 * from your own revenue (CRA) or you may have to request it (Revenu Québec); a due date that falls
 * on a weekend or holiday moves, and the authority's own calendar governs. What it is not: your
 * schedule, and never a conclusion that an entity files monthly, quarterly or annually — the rows
 * say what the authority *commonly* assigns for a revenue band. Nothing here files, posts or pays.
 */

export type CaFilingTax = 'GST/HST' | 'QST' | 'BC PST' | 'SK PST' | 'MB RST';
export type CaFilingFrequency = 'monthly' | 'quarterly' | 'annual';

export interface CaFilingBandRow {
  /** the tax the band belongs to */
  tax: CaFilingTax;
  /** the province the band is for; '' for the federal GST/HST rows (all provinces and territories) */
  province: string;
  provinceName: string;
  frequency: CaFilingFrequency;
  /** the annual-revenue band the authority commonly assigns this frequency to, in cents; null is open-ended */
  minAnnualRevenueCents: number | null;
  maxAnnualRevenueCents: number | null;
  /** when the return is due, in words from the source */
  due: string;
  validFrom: string;
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-13';
const CRA = 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/file-remit-gst-hst.html';
const RQ = 'https://www.revenuquebec.ca/en/businesses/consumption-taxes/qst-and-gsth/';
const BC = 'https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst';
const SK = 'https://www.saskatchewan.ca/business/industry/taxation-and-tax-credits/saskatchewan-provincial-sales-tax-pst-information';
const MB = 'https://taxation-finances.gov.mb.ca/taxation/sales_tax/';

/** The CRA's GST/HST bands on annual revenue (excluding GST/HST). */
export const CA_GST_HST_BANDS = {
  annualUpToCents: 150_000_000,   // $1.5M
  quarterlyUpToCents: 600_000_000, // $6M
  largeSupplierCents: 3_000_000_000, // $30M: quarterly filing is not available above this
} as const;

export const CA_FILING_CALENDAR: CaFilingBandRow[] = [
  {
    tax: 'GST/HST', province: '', provinceName: 'All provinces and territories (federal)', frequency: 'annual',
    minAnnualRevenueCents: null, maxAnnualRevenueCents: CA_GST_HST_BANDS.annualUpToCents,
    due: 'the return is due three months after the fiscal year ends; for most annual filers the balance is due the same day, and individuals with a December 31 year end pay by April 30',
    validFrom: '2026-01-01', source: CRA, checked: CHECKED,
    note: 'revenue band: $1.5M or less of annual revenue (excluding GST/HST); a large supplier (over $30M) may not file annually',
  },
  {
    tax: 'GST/HST', province: '', provinceName: 'All provinces and territories (federal)', frequency: 'quarterly',
    minAnnualRevenueCents: CA_GST_HST_BANDS.annualUpToCents, maxAnnualRevenueCents: CA_GST_HST_BANDS.quarterlyUpToCents,
    due: 'one month after the end of the reporting period',
    validFrom: '2026-01-01', source: CRA, checked: CHECKED,
    note: 'revenue band: over $1.5M up to $6M of annual revenue (excluding GST/HST); quarterly filing is not available to a large supplier (over $30M)',
  },
  {
    tax: 'GST/HST', province: '', provinceName: 'All provinces and territories (federal)', frequency: 'monthly',
    minAnnualRevenueCents: CA_GST_HST_BANDS.quarterlyUpToCents, maxAnnualRevenueCents: null,
    due: 'one month after the end of the reporting period',
    validFrom: '2026-01-01', source: CRA, checked: CHECKED,
    note: 'revenue band: over $6M of annual revenue (excluding GST/HST)',
  },
  {
    tax: 'QST', province: 'QC', provinceName: 'Quebec', frequency: 'annual',
    minAnnualRevenueCents: null, maxAnnualRevenueCents: 120_000_000,
    due: 'four months after the end of the fiscal year',
    validFrom: '2026-01-01', source: RQ, checked: CHECKED,
    note: 'total revenues of $1.2M or less for the preceding fiscal year; Revenu Québec assigns or approves the reporting period',
  },
  {
    tax: 'QST', province: 'QC', provinceName: 'Quebec', frequency: 'quarterly',
    minAnnualRevenueCents: 120_000_000, maxAnnualRevenueCents: 600_000_000,
    due: 'one month after the end of the reporting period',
    validFrom: '2026-01-01', source: RQ, checked: CHECKED,
    note: 'total revenues over $1.2M and not over $6M for the preceding fiscal year',
  },
  {
    tax: 'QST', province: 'QC', provinceName: 'Quebec', frequency: 'monthly',
    minAnnualRevenueCents: 600_000_000, maxAnnualRevenueCents: null,
    due: 'one month after the end of the reporting period',
    validFrom: '2026-01-01', source: RQ, checked: CHECKED,
    note: 'total revenues over $6M for the preceding fiscal year',
  },
  {
    tax: 'BC PST', province: 'BC', provinceName: 'British Columbia', frequency: 'monthly',
    minAnnualRevenueCents: null, maxAnnualRevenueCents: null,
    due: 'the last day of the month after the reporting month',
    validFrom: '2026-01-01', source: BC, checked: CHECKED,
    note: 'PST is due monthly regardless of size; a commission account may have its own dates',
  },
  {
    tax: 'SK PST', province: 'SK', provinceName: 'Saskatchewan', frequency: 'monthly',
    minAnnualRevenueCents: null, maxAnnualRevenueCents: null,
    due: 'the last day of the month after the reporting month',
    validFrom: '2026-01-01', source: SK, checked: CHECKED,
  },
  {
    tax: 'MB RST', province: 'MB', provinceName: 'Manitoba', frequency: 'monthly',
    minAnnualRevenueCents: null, maxAnnualRevenueCents: null,
    due: 'the 20th of the month after the reporting month',
    validFrom: '2026-01-01', source: MB, checked: CHECKED,
  },
];

export const CA_FILING_TAXES: CaFilingTax[] = ['GST/HST', 'QST', 'BC PST', 'SK PST', 'MB RST'];

/** The rows for one tax (and optionally one province). */
export function caFilingRows(tax?: CaFilingTax, province?: string): CaFilingBandRow[] {
  return CA_FILING_CALENDAR.filter(row => (!tax || row.tax === tax) && (province === undefined || row.province === province));
}

/**
 * The band a revenue figure falls into for one tax: the row whose band contains
 * `annualRevenueCents` (the maximum is inclusive, the minimum is not — a business at exactly the
 * boundary files on the lower frequency). Provincial taxes with no band return their single row.
 * Never a conclusion: the authority assigns the period and this says what it commonly assigns.
 */
export function caFilingBandFor(tax: CaFilingTax, annualRevenueCents: number): CaFilingBandRow | undefined {
  if (!Number.isFinite(annualRevenueCents) || annualRevenueCents < 0) return undefined;
  const rows = caFilingRows(tax);
  const banded = rows.filter(row => row.minAnnualRevenueCents !== null || row.maxAnnualRevenueCents !== null);
  if (!banded.length) return rows[0];
  return banded.find(row =>
    (row.minAnnualRevenueCents === null || annualRevenueCents > row.minAnnualRevenueCents) &&
    (row.maxAnnualRevenueCents === null || annualRevenueCents <= row.maxAnnualRevenueCents));
}

/** Structural problems in the table (a pack bug, not a tax opinion): never empty on the real table. */
export function caFilingCalendarProblems(rows: CaFilingBandRow[] = CA_FILING_CALENDAR): string[] {
  const problems: string[] = [];
  for (const row of rows) {
    if (!row.tax || !/^https:\/\//.test(row.source)) problems.push(`${row.tax} ${row.frequency}: the row needs a tax and an https source`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.validFrom)) problems.push(`${row.tax} ${row.frequency}: validFrom is not a date`);
    if (row.minAnnualRevenueCents !== null && row.maxAnnualRevenueCents !== null && row.minAnnualRevenueCents >= row.maxAnnualRevenueCents) {
      problems.push(`${row.tax} ${row.frequency}: the band is empty (min >= max)`);
    }
  }
  for (const tax of CA_FILING_TAXES) {
    if (!rows.some(row => row.tax === tax)) problems.push(`${tax} has no row`);
  }
  // a revenue figure may fall into exactly one band per tax
  for (const tax of CA_FILING_TAXES) {
    for (const cents of [0, 150_000_000, 600_000_000, 3_000_000_000, 10_000_000_000]) {
      const matched = caFilingRows(tax).filter(row =>
        (row.minAnnualRevenueCents === null && row.maxAnnualRevenueCents === null) ||
        ((row.minAnnualRevenueCents === null || cents > row.minAnnualRevenueCents) && (row.maxAnnualRevenueCents === null || cents <= row.maxAnnualRevenueCents)));
      if (matched.length !== 1) problems.push(`${tax}: $${(cents / 100).toLocaleString('en-US')} of revenue matches ${matched.length} bands, expected exactly 1`);
    }
  }
  return problems;
}
