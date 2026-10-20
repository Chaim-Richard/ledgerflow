/**
 * A-100: Israel's osek patur (עוסק פטור) annual turnover ceiling, one dated row per tax year.
 *
 * What this is: the legal comparison amount in the VAT Law's definition — "עוסק שמחזור העסקאות שלו
 * בכל עסקיו אינו עולה על [X] שקלים חדשים לשנה או על סכום גבוה יותר שקבע שר האוצר" — for each year
 * it was in force, with `validFrom` on 1 January (the indexation clause in Chapter Y of the VAT Law
 * adjusts the sums on 1 January of each year to the published CPI increase). The figure is the
 * *ceiling*, and the test is "does not exceed": a turnover exactly at the ceiling is still inside it.
 *
 * What this is not: a determination that a business is or must be an osek patur. Eligibility also
 * turns on facts this table does not hold — the occupation list in Regulation 13 of the VAT
 * Regulations (a free profession must register as a dealer whatever its turnover), the statutory
 * basis (the year that passed, or an expected-turnover calculation, and the "over the earlier of the
 * two" rule once someone learns the year will be exceeded), the exclusion of equipment sales
 * (מכירת ציוד) from "מחזור עסקאות", and the turnover of all the person's businesses. `turnoverVsCeiling`
 * only compares two numbers it is given; it draws no legal conclusion.
 *
 * One answer: `src/lib/tax/registrationThresholds.ts` builds its Israeli rows FROM this table, so
 * the Registration Threshold Watch, the rule pack and this history cannot drift apart. `osekPaturCeilingProblems()`
 * is the check that says so.
 *
 * Where the figures were read (each row repeats it, and `npm run check:rule-sources` re-opens the URLs):
 * 2024–2026 from the Israel Tax Authority's own pages; 2017–2023 from the Knesset Research and
 * Information Center's note on the exempt-dealer ceiling, cross-read against the Tax Authority's
 * yearly "know your rights" income-tax guide and two professional rate tables. The years before the
 * 5764 (2004) amendments are deliberately absent: this lane states a figure only where a source in
 * hand names it, and an unlisted year answers "unknown", never zero and never a guess.
 */

export interface IlOsekPaturCeilingRow {
  /** the tax year (calendar year, as the VAT Law's "שנת מס" uses it for this definition) */
  year: number;
  /** the ceiling in whole agorot; ₪1 = 100 */
  ceilingCents: number;
  /** 1 January of the year — the day the figure starts governing that year's turnover */
  validFrom: string;
  /** 31 December of the year; the newest row is open-ended because the Authority sets each year */
  validTo?: string;
  /** how the year's figure came about, in the source's own terms */
  basis: 'indexed' | 'statute' | 'unchanged';
  source: { authority: string; url: string; retrieved: string };
  /** a second page on the same figure, where one exists */
  corroboratedBy?: string;
  note: string;
}

const RETRIEVED = '2026-10-20';
const NEVO_LAW = 'https://www.nevo.co.il/law_html/law00/72813.htm';
const ITA_EXEMPT_DEALER_SERVICE = 'https://www.gov.il/he/service/request-open-exempt-dealer-via-internet';
const KNESSET_RIC_NOTE = 'https://fs.knesset.gov.il/globaldocs/MMM/f5014c7e-c8e2-ed11-8157-005056aac6c3/2_f5014c7e-c8e2-ed11-8157-005056aac6c3_11_20067.pdf';
const ITA_GUIDE_2024 = 'https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2024.pdf';
const ITA_GUIDE_2025 = 'https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2025.pdf';
const TAXO_2018 = 'https://www.taxo.co.il/info/infoMaam2018_Taxo.asp';

const yearStart = (year: number) => `${year}-01-01`;
const yearEnd = (year: number) => `${year}-12-31`;

/** the years this table answers for, oldest first */
export const IL_OSEK_PATUR_CEILINGS: IlOsekPaturCeilingRow[] = [
  {
    year: 2017, ceilingCents: 9_870_700, validFrom: yearStart(2017), validTo: yearEnd(2017), basis: 'indexed',
    source: { authority: 'Knesset — Research and Information Center', url: KNESSET_RIC_NOTE, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪98,707 for 2017 — the indexed figure in the definition of "עוסק פטור" in section 1 of the VAT Law.',
  },
  {
    year: 2018, ceilingCents: 9_900_300, validFrom: yearStart(2018), validTo: yearEnd(2018), basis: 'indexed',
    source: { authority: 'Knesset — Research and Information Center', url: KNESSET_RIC_NOTE, retrieved: RETRIEVED },
    corroboratedBy: TAXO_2018,
    note: '₪99,003 for 2018 — the figure the Taxo rate table for the 2018 tax year quotes from section 1 of the VAT Law.',
  },
  {
    year: 2019, ceilingCents: 10_018_700, validFrom: yearStart(2019), validTo: yearEnd(2019), basis: 'indexed',
    source: { authority: 'Knesset — Research and Information Center', url: KNESSET_RIC_NOTE, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪100,187 for 2019, after the January 2019 CPI adjustment.',
  },
  {
    year: 2020, ceilingCents: 10_049_100, validFrom: yearStart(2020), validTo: yearEnd(2020), basis: 'indexed',
    source: { authority: 'Knesset — Research and Information Center', url: KNESSET_RIC_NOTE, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪100,491 for 2020, after the January 2020 CPI adjustment.',
  },
  {
    // The 2021 figure is LOWER than 2020's: the law indexes to the CPI *increase*, and the consumer
    // price index fell over 2021, so the adjusted ceiling came down. A table that assumed "never
    // decreases" would quietly give the wrong answer for that year.
    year: 2021, ceilingCents: 9_989_300, validFrom: yearStart(2021), validTo: yearEnd(2021), basis: 'indexed',
    source: { authority: 'Knesset — Research and Information Center', url: KNESSET_RIC_NOTE, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪99,893 for 2021 — lower than 2020 because the January 2021 adjustment followed a fall in the consumer price index (−0.6% from November 2020 to November 2021). Indexation here is not a one-way ratchet.',
  },
  {
    year: 2022, ceilingCents: 10_229_200, validFrom: yearStart(2022), validTo: yearEnd(2022), basis: 'indexed',
    source: { authority: 'Knesset — Research and Information Center', url: KNESSET_RIC_NOTE, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪102,292 for 2022, after the January 2022 CPI adjustment.',
  },
  {
    year: 2023, ceilingCents: 10_769_200, validFrom: yearStart(2023), validTo: yearEnd(2023), basis: 'indexed',
    source: { authority: 'Knesset — Research and Information Center', url: KNESSET_RIC_NOTE, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪107,692 for 2023 — the last year before the statutory figure was re-set at ₪120,000.',
  },
  {
    year: 2024, ceilingCents: 12_000_000, validFrom: yearStart(2024), validTo: yearEnd(2024), basis: 'statute',
    source: { authority: 'Israel Tax Authority', url: ITA_GUIDE_2024, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪120,000 for 2024 — the figure fixed in the definition of "עוסק פטור", replacing the indexed 2023 amount.',
  },
  {
    year: 2025, ceilingCents: 12_000_000, validFrom: yearStart(2025), validTo: yearEnd(2025), basis: 'unchanged',
    source: { authority: 'Israel Tax Authority', url: ITA_GUIDE_2025, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪120,000 for 2025 — the same figure as 2024; the published ceiling did not move for that January.',
  },
  {
    year: 2026, ceilingCents: 12_283_300, validFrom: yearStart(2026), basis: 'indexed',
    source: { authority: 'Israel Tax Authority', url: ITA_EXEMPT_DEALER_SERVICE, retrieved: RETRIEVED },
    corroboratedBy: NEVO_LAW,
    note: '₪122,833 for 2026 — stated on the Tax Authority\'s own "open an exempt dealer file" service page (the page was last updated 18.01.2026) and in the current consolidated text of the VAT Law.',
  },
];

/** The row whose period contains the date, or nothing when the year is not in this table. */
export function osekPaturCeilingOn(date: string): IlOsekPaturCeilingRow | undefined {
  return IL_OSEK_PATUR_CEILINGS.find(row => row.validFrom <= date && (!row.validTo || date <= row.validTo));
}

/** The ceiling for one tax year, or nothing for a year this table does not answer for. */
export function osekPaturCeilingForYear(year: number): IlOsekPaturCeilingRow | undefined {
  return IL_OSEK_PATUR_CEILINGS.find(row => row.year === year);
}

/** True when a year's turnover is inside the ceiling — "אינו עולה על", so the ceiling itself is inside. */
export function isWithinOsekPaturCeiling(turnoverCents: number, dateOrYear: string | number): boolean | undefined {
  const row = typeof dateOrYear === 'number' ? osekPaturCeilingForYear(dateOrYear) : osekPaturCeilingOn(dateOrYear);
  if (!row) return undefined;
  return turnoverCents <= row.ceilingCents;
}

export interface OsekPaturCeilingProblem {
  row: string;
  problem: string;
}

/**
 * What this table promises itself: one row per year, dated from that year, an integer amount in
 * agorot, an https source with an authority and a real retrieval date, and the years in order.
 * A problem here is a broken table, not a tax opinion.
 */
export function osekPaturCeilingProblems(): OsekPaturCeilingProblem[] {
  const problems: OsekPaturCeilingProblem[] = [];
  const seen = new Set<number>();
  let previous: IlOsekPaturCeilingRow | undefined;
  for (const row of IL_OSEK_PATUR_CEILINGS) {
    const label = String(row.year);
    if (seen.has(row.year)) problems.push({ row: label, problem: 'two rows for the same tax year' });
    seen.add(row.year);
    if (previous && row.year !== previous.year + 1) {
      problems.push({ row: label, problem: `the year after ${previous.year} is missing — a gap answers "unknown", so it must be a choice, not a typo` });
    }
    if (previous && row.validFrom <= previous.validFrom) problems.push({ row: label, problem: 'the rows are not in date order' });
    if (row.validFrom !== yearStart(row.year)) problems.push({ row: label, problem: 'validFrom must be 1 January of the year' });
    if (row.validTo !== undefined && row.validTo !== yearEnd(row.year)) problems.push({ row: label, problem: 'validTo must be 31 December of the year' });
    if (!Number.isSafeInteger(row.ceilingCents) || row.ceilingCents <= 0) problems.push({ row: label, problem: 'ceilingCents must be a positive whole number of agorot' });
    if (!row.source.url.startsWith('https://') || row.source.url.includes(' ')) problems.push({ row: label, problem: 'the source must be one https address' });
    if (!row.source.authority.trim()) problems.push({ row: label, problem: 'the source needs the authority that published it' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.source.retrieved)) problems.push({ row: label, problem: 'the source needs the day it was read' });
    if (!row.note.trim()) problems.push({ row: label, problem: 'the row must say what the figure covers' });
    previous = row;
  }
  if (previous && previous.validTo !== undefined) problems.push({ row: String(previous.year), problem: 'the newest year must stay open — the Authority sets each year' });
  return problems;
}
