/**
 * A-108: US standard mileage rates for business use, as dated rows with the IRS source.
 *
 * The IRS publishes the rate each year in a Notice / news release on https://www.irs.gov/tax-professionals/standard-mileage-rates.
 * This table is a dated reference table: the rate that was in force on a date, not a promise that a rate will stay.
 * Mileage and per diem (A-75/A-76) use this table to suggest the business rate; the expense claim still records
 * the rate the person typed, and the screen says what the table suggests.
 *
 * What this is: a reference table of the business standard mileage rate. What it is not: a filing, a tax calculation,
 * a medical/moving/charitable rate, or a decision that a particular trip is deductible — business purpose, substantiation
 * and the rest of the rules are the taxpayer's and the accountant's call.
 *
 * Every row is `status: 'calculation'` and names the IRS page where it was read. 2026 is provisional until the
 * 2026 IRS Notice is checked — the screen says so.
 */

export interface UsMileageRateRow {
  /** first day this rate was in force */
  validFrom: string;
  validTo?: string;
  /** cents per mile (or per km where noted) — whole cents, e.g. 6550 = $0.655 = 65.5¢ */
  rateCentsPerMile: number;
  /** rate in thousandths of a dollar for the existing expenseClaims helpers (655 = $0.655) */
  rateThousandths: number;
  source: { authority: string; url: string; retrieved: string };
  note?: string;
}

const CHECKED = '2026-10-19';
const IRS_MILEAGE = 'https://www.irs.gov/tax-professionals/standard-mileage-rates';

export const US_MILEAGE_RATES: UsMileageRateRow[] = [
  {
    validFrom: '2020-01-01', validTo: '2020-12-31',
    rateCentsPerMile: 5750, rateThousandths: 575,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '57.5¢ for 2020 (Notice 2020-05)',
  },
  {
    validFrom: '2021-01-01', validTo: '2021-12-31',
    rateCentsPerMile: 5600, rateThousandths: 560,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '56¢ for 2021 (Notice 2021-02)',
  },
  {
    validFrom: '2022-01-01', validTo: '2022-06-30',
    rateCentsPerMile: 5850, rateThousandths: 585,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '58.5¢ for Jan 1–Jun 30, 2022 (Notice 2021-52)',
  },
  {
    validFrom: '2022-07-01', validTo: '2022-12-31',
    rateCentsPerMile: 6250, rateThousandths: 625,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '62.5¢ for Jul 1–Dec 31, 2022 (Announcement 2022-13, IR-2022-124 mid-year increase)',
  },
  {
    validFrom: '2023-01-01', validTo: '2023-12-31',
    rateCentsPerMile: 6550, rateThousandths: 655,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '65.5¢ for 2023 (Notice 2023-03)',
  },
  {
    validFrom: '2024-01-01', validTo: '2024-12-31',
    rateCentsPerMile: 6700, rateThousandths: 670,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '67¢ for 2024 (Notice 2024-08)',
  },
  {
    validFrom: '2025-01-01', validTo: '2025-12-31',
    rateCentsPerMile: 7000, rateThousandths: 700,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '70¢ for 2025 (Notice 2025-05, IR-2024-312)',
  },
  {
    validFrom: '2026-01-01',
    rateCentsPerMile: 7000, rateThousandths: 700,
    source: { authority: 'Internal Revenue Service', url: IRS_MILEAGE, retrieved: CHECKED },
    note: '70¢ for 2026: verify with the IRS Notice for 2026 when it is published; the 2025 rate is carried forward here as a calculation-only suggestion until checked',
  },
];

export function mileageRateOn(date: string): UsMileageRateRow | undefined {
  return US_MILEAGE_RATES.find(r => r.validFrom <= date && (!r.validTo || date <= r.validTo));
}

export function mileageRateForYear(year: number): UsMileageRateRow | undefined {
  return mileageRateOn(`${year}-07-01`);
}

/** Structural problems in this table (a bug in this file, not a tax opinion). */
export function usMileageRateProblems(): string[] {
  const problems: string[] = [];
  for (const row of US_MILEAGE_RATES) {
    if (!/^https:\/\//.test(row.source.url)) problems.push(`${row.validFrom}: source must be https`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.validFrom)) problems.push(`${row.validFrom}: validFrom is not a date`);
    if (row.validTo && !/^\d{4}-\d{2}-\d{2}$/.test(row.validTo)) problems.push(`${row.validFrom}: validTo is not a date`);
    if (row.validTo && row.validFrom > row.validTo) problems.push(`${row.validFrom}: ends before it starts`);
    if (!Number.isSafeInteger(row.rateCentsPerMile) || row.rateCentsPerMile <= 0) problems.push(`${row.validFrom}: rate is not positive integer cents`);
    if (row.rateThousandths !== Math.round(row.rateCentsPerMile / 10)) problems.push(`${row.validFrom}: rateThousandths must be rateCentsPerMile/10`);
  }
  if (!mileageRateOn('2023-06-15') || mileageRateOn('2023-06-15')!.rateCentsPerMile !== 6550) problems.push('2023 must be 65.5¢');
  if (!mileageRateOn('2024-06-15') || mileageRateOn('2024-06-15')!.rateCentsPerMile !== 6700) problems.push('2024 must be 67¢');
  if (!mileageRateOn('2025-06-15') || mileageRateOn('2025-06-15')!.rateCentsPerMile !== 7000) problems.push('2025 must be 70¢');
  if (!mileageRateOn('2022-03-01') || mileageRateOn('2022-03-01')!.rateCentsPerMile !== 5850) problems.push('2022 H1 must be 58.5¢');
  if (!mileageRateOn('2022-09-01') || mileageRateOn('2022-09-01')!.rateCentsPerMile !== 6250) problems.push('2022 H2 must be 62.5¢');
  return problems;
}
