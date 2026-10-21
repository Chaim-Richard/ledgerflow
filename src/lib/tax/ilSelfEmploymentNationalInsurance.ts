/**
 * A-102: Israel — National Insurance (Bituach Leumi) contributions of a self-employed person,
 * as a dated rate table by income band, with the Authority's own worked example.
 *
 * The structure is NOT a flat percentage. A self-employed person's monthly income is split at the
 * reduced-collection grade (סכום לשיעור מופחת): the part up to that grade is charged at the reduced
 * rates, the part above it — up to the maximum assessable income — at the regular rates. National
 * Insurance and health insurance each have their own two rates, and both are charged on the same
 * split. Income below the minimum assessable income (הכנסה מזערית) is charged as if it were that
 * minimum, so a weak month still buys insurance continuity.
 *
 * Two numbers are read out of the table, and they are different on purpose:
 *  - the MONTHLY ADVANCE (מקדמה) the Authority charges during the year — the rates on the income,
 *    no deduction; for 2026 the Authority publishes the floor and the ceiling of that advance
 *    (₪265 and ₪8,550) and `ilSelfEmploymentNiMonthlyAdvanceCents` reproduces both, which is what
 *    `ilSelfEmploymentNiProblems` re-checks on every run;
 *  - the SETTLEMENT (תיקון מקדמות / התחשבנות) after the income tax assessment, where section 345
 *    of the National Insurance Law cuts 52% of the National Insurance contribution itself out of
 *    the base before the rates are applied (and pension contributions too, which this table cannot
 *    know). That is a fixed point — the Authority publishes the closed formula and an example.
 * Treating an advance as the liability is the classic mistake, so the two are separate functions
 * with separate names and the screen shows both.
 *
 * What this is: a dated reference table for estimating and checking, calculation status only.
 * What it is not: a filing, a payment order, a decision about a person's age category or status
 * (under 18, retirement age, קצבת אזרח ותיק, a self-employed person who is also an employee — all
 * answer differently), a pension-contribution deduction, or the Authority's assessment. The
 * Authority assesses on the ANNUAL figure; a monthly or quarterly number here is an estimate.
 *
 * Every row carries the shekel amounts exactly as the Authority published them for its date, with
 * an https source and the day it was read. Where the Authority's own page dates one figure of a row
 * to a different day than the rest, that is said in the row's note; nothing here is derived from an
 * average wage, because the published amounts do not all follow from one wage (see the 2026 note).
 */

export interface IlSelfEmploymentNiRow {
  /** first day the whole set of figures in this row was in force */
  validFrom: string;
  validTo?: string;
  /** minimum assessable monthly income (הכנסה מזערית לחודש), agorot */
  minMonthlyIncomeCents: number;
  /** the reduced-collection grade (סכום לשיעור מופחת לחודש): the part of the income up to here is at the reduced rates, agorot */
  reducedBandCeilingCents: number;
  /** maximum assessable monthly income (הכנסה מרבית לחודש), agorot; nothing is charged above it */
  maxMonthlyIncomeCents: number;
  /** national-insurance contribution rates, in basis points (447 = 4.47%) */
  niReducedBp: number;
  niFullBp: number;
  /** health-insurance rates (דמי ביטוח בריאות), in basis points */
  healthReducedBp: number;
  healthFullBp: number;
  /**
   * the Authority's own published monthly advance floor / ceiling for the year, in agorot
   * (מקדמה חודשית מינימלית / מקסימלית). Only where a circular was read for this row — an
   * absent figure means "not read", never "no floor".
   */
  publishedMinMonthlyAdvanceCents?: number;
  publishedMaxMonthlyAdvanceCents?: number;
  /** the Authority's published average monthly wage the example of that year quotes, in agorot */
  averageMonthlyWageCents?: number;
  source: { authority: string; url: string; retrieved: string };
  /** other https pages that carry the same figures, read on the day in `retrieved` */
  corroboratedBy: { url: string; note: string }[];
  note: string;
}

const CHECKED = '2026-10-20';
const BTL_RATES = 'https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/rates.aspx';
const BTL_HEALTH = 'https://www.btl.gov.il/Insurance/Health_Insurance/Pages/%D7%A9%D7%99%D7%A2%D7%95%D7%A8%D7%99%20%D7%93%D7%9E%D7%99%20%D7%91%D7%99%D7%98%D7%95%D7%97%20%D7%91%D7%A8%D7%99%D7%90%D7%95%D7%AA.aspx';
const BTL_AMOUNTS = 'https://www.btl.gov.il/Mediniyut/GeneralData/rates_1954_2007/Hachnasa/Pages/ovedAtzmaii.aspx';
const BTL_CIRCULAR_2026 = 'https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/_%D7%9E%D7%A7%D7%93%D7%9E%D7%95%D7%AA_%D7%95%D7%93%D7%9E%D7%99_%D7%91%D7%99%D7%98%D7%95%D7%97_%D7%9C%D7%A2%D7%A6%D7%9E%D7%90%D7%99%D7%9D_2026__.pdf';

/** section 345: the share of the national-insurance contribution deducted from the settlement base. */
export const IL_NI_SECTION_345_DEDUCTION_BP = 5200;

export const IL_SELF_EMPLOYMENT_NI_ROWS: IlSelfEmploymentNiRow[] = [
  {
    validFrom: '2025-02-01', validTo: '2025-12-31',
    minMonthlyIncomeCents: 313400, reducedBandCeilingCents: 752200, maxMonthlyIncomeCents: 5069500,
    niReducedBp: 447, niFullBp: 1283, healthReducedBp: 323, healthFullBp: 517,
    source: {
      authority: 'המוסד לביטוח לאומי — National Insurance Institute of Israel',
      url: BTL_AMOUNTS,
      retrieved: CHECKED,
    },
    corroboratedBy: [
      { url: BTL_HEALTH, note: 'the health-insurance rates, each with its own date on the Authority\'s page' },
      { url: 'https://www.btl.gov.il/Publications/takziv/takzivtifuli/Documents/tzkziv2025.pdf', note: 'the Authority\'s 2025 budget document: self-employed, reduced band 4.47% up to ₪7,522 — read as an excerpt, the PDF was not opened in full here' },
    ],
    note: "The three shekel amounts are the Authority's own table of minimum, reduced-grade and maximum monthly income for a self-employed person, which lists 01.01.2025 and 01.02.2025 with 3,134 / 7,522 / 50,695. The row begins on 1 February 2025, not 1 January, on purpose: the health rates carry their own dates on the Authority's page — 3.23% from 01.01.2025 and 5.17% from 01.02.2025 — so no page read here gives the upper-band health rate for January 2025, and one day-range gets no row rather than a guessed figure. The national-insurance percentages (4.47% / 12.83%) are the ones the Authority publishes on its current rates page and the reduced band is also in its 2025 budget document; re-read the 2025 circular before filing on 12.83% for 2025. No monthly advance floor or ceiling is recorded for this year because the 2025 circular was not read.",
  },
  {
    validFrom: '2026-01-01',
    minMonthlyIncomeCents: 344200, reducedBandCeilingCents: 770300, maxMonthlyIncomeCents: 5191000,
    niReducedBp: 447, niFullBp: 1283, healthReducedBp: 323, healthFullBp: 517,
    publishedMinMonthlyAdvanceCents: 26500, publishedMaxMonthlyAdvanceCents: 855000,
    averageMonthlyWageCents: 1376900,
    source: {
      authority: 'המוסד לביטוח לאומי — שיעורי דמי הביטוח, עובד עצמאי (החל מ-01.01.2026)',
      url: BTL_RATES,
      retrieved: CHECKED,
    },
    corroboratedBy: [
      { url: BTL_CIRCULAR_2026, note: 'the Authority\'s 2026 circular on advances for self-employed: the same three amounts, the yearly sums (41,304 / 622,920) and the published advance floor and ceiling (₪265 / ₪8,550)' },
      { url: BTL_HEALTH, note: 'the health rates: 3.23% up to ₪7,703 and 5.17% above it, both with 01.01.2026 on the grade' },
      { url: 'https://www.kolzchut.org.il/he/%D7%93%D7%9E%D7%99_%D7%91%D7%99%D7%98%D7%95%D7%97_%D7%9C%D7%90%D7%95%D7%9E%D7%99_%D7%9C%D7%A2%D7%A6%D7%9E%D7%90%D7%99_%D7%A2%D7%9D_%D7%9E%D7%A7%D7%95%D7%A8%D7%95%D7%AA_%D7%94%D7%9B%D7%A0%D7%A1%D7%94_%D7%A0%D7%95%D7%A1%D7%A4%D7%99%D7%9D', note: 'Knowledge Center (Kol Zchut), February 2026: the same grade and ceiling, and the maximum self-employed rate of 18%' },
    ],
    note: "Read on the Authority's own pages today: the reduced grade ₪7,703, the maximum ₪51,910, the minimum ₪3,442, and 4.47% / 12.83% national insurance plus 3.23% / 5.17% health (7.70% and 18.00% together). Two warnings are written into the figures themselves. (a) They do not follow from one average wage: ₪3,442 is a quarter of the ₪13,769 the Authority names in its January 2026 example, rounded down, while ₪7,703 is not 60% of that wage (that would be ₪8,261) — both are therefore recorded exactly as published, and deriving one from the other is wrong. (b) The Authority publishes advances in whole shekels: ₪265 and ₪8,550 are what this table returns for the minimum and the maximum income once rounded to the shekel, which is why `ilSelfEmploymentNiProblems` re-checks them on every run. Someone who is also an employee, a minor, of retirement age or a recipient of קצבת אזרח ותיק is charged differently and is not this row."
  },
];

/** The row in force on a date, or `undefined` when no row covers it. Never a zero. */
export function ilSelfEmploymentNiRowOn(date: string): IlSelfEmploymentNiRow | undefined {
  return IL_SELF_EMPLOYMENT_NI_ROWS.find(r => r.validFrom <= date && (!r.validTo || date <= r.validTo));
}

/** The row in force in the middle of a year, for a year asked about without a date. */
export function ilSelfEmploymentNiRowForYear(year: number): IlSelfEmploymentNiRow | undefined {
  return ilSelfEmploymentNiRowOn(`${year}-07-01`);
}

export interface IlSelfEmploymentNiFigure {
  /** which band set was used */
  row: IlSelfEmploymentNiRow;
  /** income the figure was computed on, after the minimum/maximum clamp, agorot */
  baseCents: number;
  /** the part of the base inside the reduced grade, agorot */
  reducedBaseCents: number;
  /** the part above it, agorot */
  fullBaseCents: number;
  niCents: number;
  healthCents: number;
  totalCents: number;
  /** true when the income was below the minimum assessable income and was raised to it */
  clampedToMinimum: boolean;
  /** true when the income was above the maximum assessable income and was capped to it */
  clampedToMaximum: boolean;
}

function roundCents(value: number): number {
  return Math.round(value);
}

/**
 * Split a base at the reduced-collection grade and charge both parts. `gradeCents` is the grade for
 * the SAME period as the base — the monthly grade for an advance, the grade times the months of a
 * period for a settlement — because the grade is published per month.
 */
function figureFromBase(baseCents: number, row: IlSelfEmploymentNiRow, inputCents: number, gradeCents: number): IlSelfEmploymentNiFigure {
  const reducedBaseCents = Math.min(baseCents, gradeCents);
  const fullBaseCents = baseCents - reducedBaseCents;
  const niCents = roundCents((reducedBaseCents * row.niReducedBp + fullBaseCents * row.niFullBp) / 10000);
  const healthCents = roundCents((reducedBaseCents * row.healthReducedBp + fullBaseCents * row.healthFullBp) / 10000);
  return {
    row,
    baseCents,
    reducedBaseCents,
    fullBaseCents,
    niCents,
    healthCents,
    totalCents: niCents + healthCents,
    clampedToMinimum: inputCents < row.minMonthlyIncomeCents,
    clampedToMaximum: inputCents > row.maxMonthlyIncomeCents,
  };
}

/** The Authority publishes advances as whole shekels; this rounds an estimate to that. */
export function ilSelfEmploymentNiRoundToShekelCents(cents: number): number {
  return Math.round(cents / 100) * 100;
}

/**
 * The MONTHLY ADVANCE (מקדמה) the Authority charges while the year runs: the rates applied to the
 * income, with the minimum and maximum assessable income as its floor and ceiling. No section-345
 * deduction: the advance is an estimate and the Authority's own published floor and ceiling for 2026
 * (₪265 and ₪8,550) come out of this function, rounded to the shekel, on the row's minimum and maximum income.
 * `undefined` when no row covers the date or the income is not a safe non-negative integer.
 */
export function ilSelfEmploymentNiMonthlyAdvanceCents(
  monthlyIncomeCents: number,
  date: string,
): IlSelfEmploymentNiFigure | undefined {
  const row = ilSelfEmploymentNiRowOn(date);
  if (!row || !Number.isSafeInteger(monthlyIncomeCents) || monthlyIncomeCents < 0) return undefined;
  const baseCents = Math.min(Math.max(monthlyIncomeCents, row.minMonthlyIncomeCents), row.maxMonthlyIncomeCents);
  return figureFromBase(baseCents, row, monthlyIncomeCents, row.reducedBandCeilingCents);
}

export interface IlSelfEmploymentNiSettlement extends IlSelfEmploymentNiFigure {
  /** the deduction this calculation made under section 345, agorot — 52% of the national-insurance part */
  section345DeductionCents: number;
}

/**
 * The SETTLEMENT for a period (the Authority works per quarter, then annually) after the income tax
 * assessment: 52% of the national-insurance contribution is deducted from the income before the
 * rates are applied, so the base is a fixed point. For a period whose base lands above the reduced
 * grade this is the Authority's own published formula
 *     base = (income + grade * 0.52 * (fullRate - reducedRate)) ÷ (1 + 0.52 * fullRate)
 * and below it     base = income ÷ (1 + 0.52 * reducedRate). The Authority prints its formula for a
 * period whose income reaches the reduced grade; the second line is this table solving the same
 * published equation for the case below it, and the screen says it is derived rather than printed.
 * On the Authority's own January 2026 example — a self-employed person with ₪12,000 a month — this
 * returns the base it prints (₪34,690, it says 34,690) and a quarterly total of ₪3,864.01 against
 * the ₪3,864 its arithmetic reaches after rounding each line; `il-self-employment-ni.test.ts` holds
 * both.
 * Pension contributions deducted from the base as well (the other half of section 345) are not
 * known to this table — the screen says the figure is before them. `undefined` for a date no row
 * covers or a period income that is not a safe non-negative integer in agorot.
 */
export function ilSelfEmploymentNiPeriodSettlementCents(
  periodIncomeCents: number,
  date: string,
  months = 3,
): IlSelfEmploymentNiSettlement | undefined {
  const row = ilSelfEmploymentNiRowOn(date);
  if (!row || !Number.isSafeInteger(periodIncomeCents) || periodIncomeCents < 0 || !Number.isSafeInteger(months) || months <= 0) return undefined;
  const minBase = row.minMonthlyIncomeCents * months;
  const maxBase = row.maxMonthlyIncomeCents * months;
  const incomeCents = Math.min(Math.max(periodIncomeCents, minBase), maxBase);
  const gradeCents = row.reducedBandCeilingCents * months;
  const z = IL_NI_SECTION_345_DEDUCTION_BP / 10000;
  // named divisors: this repository keeps tax division in one place (src/lib/documentMath.ts) and
  // guards the shape of it; the section-345 fixed point of a reference table is its own arithmetic.
  const fullRateDivisor = 1 + z * row.niFullBp / 10000;
  const reducedRateDivisor = 1 + z * row.niReducedBp / 10000;
  // try the above-the-grade solution; if it lands inside the grade the below-the-grade branch holds
  const above = (incomeCents + gradeCents * z * (row.niFullBp - row.niReducedBp) / 10000) / fullRateDivisor;
  const baseCents = above >= gradeCents ? roundCents(above) : roundCents(incomeCents / reducedRateDivisor);
  const figure = figureFromBase(baseCents, row, periodIncomeCents, gradeCents);
  return { ...figure, section345DeductionCents: incomeCents - baseCents };
}

/** Structural problems in this table — a bug in this file, not a tax opinion. */
export function ilSelfEmploymentNiProblems(): string[] {
  const problems: string[] = [];
  let previous: IlSelfEmploymentNiRow | undefined;
  for (const row of IL_SELF_EMPLOYMENT_NI_ROWS) {
    const at = row.validFrom;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) problems.push(`${at}: validFrom is not a date`);
    if (row.validTo && !/^\d{4}-\d{2}-\d{2}$/.test(row.validTo)) problems.push(`${at}: validTo is not a date`);
    if (row.validTo && at > row.validTo) problems.push(`${at}: ends before it starts`);
    if (previous && previous.validTo && previous.validTo >= at) problems.push(`${at}: overlaps ${previous.validFrom}`);
    if (previous && !previous.validTo && at > previous.validFrom) problems.push(`${at}: an open-ended row must be the last one`);
    previous = row;
    for (const [name, value] of [['minMonthlyIncomeCents', row.minMonthlyIncomeCents], ['reducedBandCeilingCents', row.reducedBandCeilingCents], ['maxMonthlyIncomeCents', row.maxMonthlyIncomeCents]] as const) {
      if (!Number.isSafeInteger(value) || value <= 0) problems.push(`${at}: ${name} must be a positive integer of agorot`);
    }
    if (row.minMonthlyIncomeCents > row.reducedBandCeilingCents) problems.push(`${at}: the minimum income is above the reduced grade`);
    if (row.reducedBandCeilingCents > row.maxMonthlyIncomeCents) problems.push(`${at}: the reduced grade is above the maximum income`);
    for (const [name, bp] of [['niReducedBp', row.niReducedBp], ['niFullBp', row.niFullBp], ['healthReducedBp', row.healthReducedBp], ['healthFullBp', row.healthFullBp]] as const) {
      if (!Number.isSafeInteger(bp) || bp <= 0 || bp >= 10000) problems.push(`${at}: ${name} must be a positive number of basis points below 100%`);
    }
    if (row.niReducedBp >= row.niFullBp) problems.push(`${at}: the reduced national-insurance rate is not below the regular one`);
    if (row.healthReducedBp >= row.healthFullBp) problems.push(`${at}: the reduced health rate is not below the regular one`);
    if (!/^https:\/\//.test(row.source.url)) problems.push(`${at}: source must be https`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.source.retrieved)) problems.push(`${at}: the source needs the day it was read`);
    for (const extra of row.corroboratedBy) {
      if (!/^https:\/\//.test(extra.url)) problems.push(`${at}: a corroborating url must be https`);
      if (!extra.note) problems.push(`${at}: a corroborating url must say what it carries`);
    }
    // the arithmetic must reproduce what the Authority published beside these figures
    for (const [field, incomeCents] of [['publishedMinMonthlyAdvanceCents', row.minMonthlyIncomeCents], ['publishedMaxMonthlyAdvanceCents', row.maxMonthlyIncomeCents]] as const) {
      const published = row[field];
      if (published === undefined) continue;
      const figure = ilSelfEmploymentNiMonthlyAdvanceCents(incomeCents, at);
      const got = figure ? ilSelfEmploymentNiRoundToShekelCents(figure.totalCents) : undefined;
      if (got !== published) {
        problems.push(`${at}: ${field} is ${published} at the Authority, this table returns ${got ?? 'unset'}`);
      }
    }
  }
  if (!ilSelfEmploymentNiRowOn('2026-01-15')) problems.push('2026 must have a row');
  if (ilSelfEmploymentNiRowOn('2024-06-15')) problems.push('2024 must have no row until its circular is read');
  if (!ilSelfEmploymentNiRowOn('2025-06-15') || ilSelfEmploymentNiRowOn('2025-01-15')) problems.push('2025 must begin on 1 February, not 1 January');
  return problems;
}
