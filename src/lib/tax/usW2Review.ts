/**
 * E-19: W-2 boxes 1-6 from independently reviewed, typed annual figures.
 * This is a private human-review worksheet, NOT an SSA EFW2 or IRS W-2 upload.
 * Payroll run gross is not necessarily federal, SS or Medicare taxable wages.
 * No tax rates, withholding, wage bases or payroll liabilities are calculated.
 * Source: https://www.irs.gov/instructions/iw2w3 (2025 and 2026 instructions).
 */
import { csvMoney } from '../csvExport';

export interface W2ReviewEmployee {
  employeeId: string;
  name: string;
  currency: string;
  sourceReviewed: boolean;
  /** The six amounts must come from separately verified annual wage records. */
  box1Cents?: number; // Wages, tips, other compensation
  box2Cents?: number; // Federal income tax withheld
  box3Cents?: number; // Social Security wages (not Social Security tips in box 7)
  box4Cents?: number; // Employee Social Security tax withheld
  box5Cents?: number; // Medicare wages and tips
  box6Cents?: number; // Employee Medicare tax withheld, including Additional Medicare
  contractor?: boolean;
}

export const US_W2_REVIEW_YEARS = [
  { year: 2025, socialSecurityWageBaseCents: 17610000, source: 'https://www.irs.gov/instructions/iw2w3' },
  { year: 2026, socialSecurityWageBaseCents: 18450000, source: 'https://www.irs.gov/instructions/iw2w3' },
] as const;

export const US_W2_REVIEW_HEADERS = [
  'Tax year', 'Employee reference', 'Employee name',
  'Box 1 wages (USD)', 'Box 2 federal tax withheld (USD)',
  'Box 3 Social Security wages (USD)', 'Box 4 Social Security tax withheld (USD)',
  'Box 5 Medicare wages and tips (USD)', 'Box 6 Medicare tax withheld (USD)',
  'Worksheet status',
] as const;

const AMOUNTS = ['box1Cents','box2Cents','box3Cents','box4Cents','box5Cents','box6Cents'] as const;

export interface W2ReviewResult {
  readyForFiling: false;
  canDownloadForReview: boolean;
  year: number;
  blockers: string[];
  notices: string[];
  headers: readonly string[];
  rows: string[][];
}
const safeCents = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/**
 * Validates review-only boxes already provided by an accountant.
 * There is deliberately NO gross-to-box-1, gross-to-box-3/5 or withholding inference.
 * The CSV has no full government identifier and cannot be uploaded to SSA/IRS.
 */
export function usW2Review(rows: readonly W2ReviewEmployee[], year: number): W2ReviewResult {
  const blockers: string[] = [];
  const notices = [
    'Review worksheet only; NOT an IRS Form W-2 or SSA EFW2 submission file.',
    'Verify the full calendar-year payroll history and reconcile with Forms 941 and W-3.',
    'Boxes 7-20, employer and employee official identifiers, addresses, correction rules and special wage treatments are not included.',
    'No social security numbers are included. Share the downloaded file only with authorised payroll reviewers.',
  ];
  const wageBase = US_W2_REVIEW_YEARS.find(item => item.year === year);
  if (!wageBase) blockers.push('Only independently reviewed 2025 and 2026 tax-year worksheets are supported.');
  if (!rows.length) blockers.push('There are no employee wage figures to review.');
  const seen = new Set<string>();
  for (const row of rows) {
    const id = row.employeeId;
    if (!id || !id.trim() || !row.name.trim()) blockers.push('An employee reference or name is missing.');
    if (seen.has(id)) blockers.push('An employee appears more than once in the selected tax year.');
    seen.add(id);
    if (row.contractor) blockers.push('Contractor payments do not belong on this employee worksheet.');
    if (row.currency.trim().toUpperCase() !== 'USD') blockers.push('Only reviewed USD wage figures are supported.');
    if (!row.sourceReviewed) blockers.push('Each employee needs independent source-figure confirmation.');
    if (!AMOUNTS.every(k => safeCents(row[k]))) {
      blockers.push('All six boxes must have safe, nonnegative, exact-cent values; blanks are not zero.');
      continue;
    }
    // Validation after the narrowing guard, without assuming any tax rates for an employee.
    const one = row.box1Cents!, two = row.box2Cents!, three = row.box3Cents!;
    const four = row.box4Cents!, five = row.box5Cents!, six = row.box6Cents!;
    if (!Number.isSafeInteger(one + two + three + four + five + six)) {
      blockers.push('An employee has amounts outside the safe integer range.');
    }
    if (wageBase && three > wageBase.socialSecurityWageBaseCents) {
      blockers.push('Box 3 exceeds the selected year’s Social Security wage base; review tips and wage treatment.');
    }
    if (five < three) blockers.push('Medicare wages (box 5) cannot be below Social Security wages (box 3).');
    if (four > 0 && three === 0) notices.push('A nonzero box 4 with zero box 3 may require separately documented Social Security tips.');
    if (six > 0 && five === 0) blockers.push('Medicare tax withheld (box 6) needs corresponding Medicare wages in box 5.');
  }
  return {
    readyForFiling: false,
    canDownloadForReview: blockers.length === 0,
    year,
    blockers: [...new Set(blockers)],
    notices: [...new Set(notices)],
    headers: US_W2_REVIEW_HEADERS,
    rows: blockers.length ? [] : [...rows]
      .sort((a, b) => a.name.localeCompare(b.name) || a.employeeId.localeCompare(b.employeeId))
      .map(row => [
        String(year), row.employeeId, row.name,
        ...AMOUNTS.map(k => csvMoney(row[k])),
        'REVIEW ONLY — NOT SSA/IRS',
      ]),
  };
}
