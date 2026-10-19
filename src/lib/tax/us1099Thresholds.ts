/**
 * A-106: the US 1099-NEC / 1099-MISC reporting thresholds by year, as dated rows with the source
 * each row was read from — including the 2026 change.
 *
 * The rule: a payment is reportable when the year's total paid to one payee reaches the threshold
 * for that form and box. Ordinary nonemployee compensation ($600 until 2025, $2,000 for payments
 * made after 31 December 2025 under the 2025 tax act) is the common case; royalties (MISC box 2,
 * $10) and gross proceeds to an attorney (MISC box 10, $600) have their own floors and did not
 * change with the 2026 increase.
 *
 * What this is: a dated reference table. What it is not: a filing, an IRIS file, or a decision that
 * a particular payee is reportable — exemptions (corporations, payment methods, the payee's own
 * status) are the filer's and the accountant's call. It is deliberately kept beside E-10's
 * `threshold1099Cents` and a test holds the two to the same figures, so the product has one answer.
 */

export type Form1099ThresholdKind = '1099-NEC' | '1099-MISC-ordinary' | '1099-MISC-royalties' | '1099-MISC-attorney';

export interface Form1099ThresholdRow {
  kind: Form1099ThresholdKind;
  /** the form and box the row is about, in words */
  form: string;
  /** the amount at or above which the payment is reportable, in cents */
  thresholdCents: number;
  /** first day of the calendar year whose payments this row governs */
  validFrom: string;
  validTo?: string;
  source: { authority: string; url: string; retrieved: string };
  note?: string;
}

const CHECKED = '2026-10-19';
const IRS_1099 = 'https://www.irs.gov/instructions/i1099mec';
const IRS_ABOUT = 'https://www.irs.gov/businesses/small-businesses-self-employed/am-i-required-to-file-a-form-1099-or-other-information-return';

/** $600 for ordinary boxes, through payments made in 2025. */
const ROW_600_2025 = (kind: Form1099ThresholdKind, form: string, note?: string): Form1099ThresholdRow => ({
  kind, form, thresholdCents: 60_000, validFrom: '2020-01-01', validTo: '2025-12-31',
  source: { authority: 'Internal Revenue Service', url: IRS_1099, retrieved: CHECKED },
  ...(note ? { note } : {}),
});

/** $2,000 from payments made after 31 December 2025 (the 2025 tax act). */
const ROW_2000_2026 = (kind: Form1099ThresholdKind, form: string, note?: string): Form1099ThresholdRow => ({
  kind, form, thresholdCents: 200_000, validFrom: '2026-01-01',
  source: { authority: 'Internal Revenue Service', url: IRS_1099, retrieved: CHECKED },
  note: note || 'the 2025 tax act raised the ordinary 1099 threshold to $2,000 for payments made after 31 Dec 2025; confirm the form instructions in force for the year before filing',
});

export const US_1099_THRESHOLDS: Form1099ThresholdRow[] = [
  // ordinary nonemployee compensation / other payments
  ROW_600_2025('1099-NEC', '1099-NEC box 1 (nonemployee compensation)'),
  ROW_600_2025('1099-MISC-ordinary', '1099-MISC boxes 1 and 3 (rents, other income)'),
  ROW_2000_2026('1099-NEC', '1099-NEC box 1 (nonemployee compensation)'),
  ROW_2000_2026('1099-MISC-ordinary', '1099-MISC boxes 1 and 3 (rents, other income)'),

  // the exceptions: unchanged by the 2026 increase
  {
    kind: '1099-MISC-royalties', form: '1099-MISC box 2 (royalties)',
    thresholdCents: 1_000, validFrom: '2020-01-01',
    source: { authority: 'Internal Revenue Service', url: IRS_1099, retrieved: CHECKED },
    note: '$10 — royalties have their own floor and did not change with the 2026 increase',
  },
  {
    kind: '1099-MISC-attorney', form: '1099-MISC box 10 (gross proceeds paid to an attorney)',
    thresholdCents: 60_000, validFrom: '2020-01-01',
    source: { authority: 'Internal Revenue Service', url: IRS_ABOUT, retrieved: CHECKED },
    note: '$600 — gross proceeds to an attorney are reported regardless of the ordinary threshold; the payment is often reportable even when the payee is a corporation, which the instructions govern',
  },
];

/** The row for a kind in a tax year, or undefined when no row covers that year. */
export function threshold1099Row(kind: Form1099ThresholdKind, year: number): Form1099ThresholdRow | undefined {
  const from = `${year}-01-01`;
  return US_1099_THRESHOLDS.find(r => r.kind === kind && r.validFrom <= from && (!r.validTo || from <= r.validTo));
}

/** The threshold in cents for a kind and year; throws for a year no row covers (never a guessed amount). */
export function threshold1099CentsFor(kind: Form1099ThresholdKind, year: number): number {
  if (!Number.isInteger(year) || year < 2020 || year > 2099) throw new Error('Unsupported 1099 tax year.');
  const row = threshold1099Row(kind, year);
  if (!row) throw new Error(`No 1099 threshold row covers ${year}.`);
  return row.thresholdCents;
}

/** True when the year's total is reportable under that kind's floor (at the threshold, reportable). */
export function is1099Reportable(kind: Form1099ThresholdKind, year: number, paidCents: number): boolean {
  if (!Number.isSafeInteger(paidCents) || paidCents < 0) throw new Error('The 1099 total must be whole cents.');
  return paidCents >= threshold1099CentsFor(kind, year);
}

/** Structural problems in this table (a bug in this file, not a tax opinion). */
export function us1099ThresholdProblems(): string[] {
  const problems: string[] = [];
  for (const row of US_1099_THRESHOLDS) {
    if (!/^https:\/\//.test(row.source.url)) problems.push(`${row.kind} ${row.validFrom}: the source must be an https URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.validFrom)) problems.push(`${row.kind} ${row.validFrom}: validFrom is not a date`);
    if (row.validTo && !/^\d{4}-\d{2}-\d{2}$/.test(row.validTo)) problems.push(`${row.kind} ${row.validFrom}: validTo is not a date`);
    if (row.validTo && row.validFrom > row.validTo) problems.push(`${row.kind} ${row.validFrom}: the row ends before it starts`);
    if (!Number.isSafeInteger(row.thresholdCents) || row.thresholdCents <= 0) problems.push(`${row.kind} ${row.validFrom}: the threshold is not whole positive cents`);
  }
  // every year from 2020 to 2027 needs one ordinary row — no silent gap
  for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
    for (const kind of ['1099-NEC', '1099-MISC-ordinary'] as const) {
      if (!threshold1099Row(kind, year)) problems.push(`${kind}: no row covers ${year}`);
    }
  }
  // the stated change: 2025 $600, 2026 $2,000
  if (threshold1099CentsFor('1099-NEC', 2025) !== 60_000) problems.push('2025 1099-NEC should be $600');
  if (threshold1099CentsFor('1099-NEC', 2026) !== 200_000) problems.push('2026 1099-NEC should be $2,000');
  if (threshold1099CentsFor('1099-MISC-royalties', 2026) !== 1_000) problems.push('royalties should stay at $10');
  if (threshold1099CentsFor('1099-MISC-attorney', 2026) !== 60_000) problems.push('attorney proceeds should stay at $600');
  return problems;
}
