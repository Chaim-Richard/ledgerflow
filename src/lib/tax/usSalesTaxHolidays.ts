/**
 * A-58: US state sales tax holidays — the dated windows in which qualifying items stop being
 * taxed, the categories each window covers and the per-item price cap it sets.
 *
 * What this is: a dated table with one official source per row (the state's own page or
 * publication), plus the plain question "is an item at this price inside a band's cap today?".
 * Each row is the state's own announcement for that year — never a date this file guessed. A
 * window is not repeated here until its dates are published: a holiday whose year is not in this
 * table is listed under `unmapped` by the rule pack so a person can add it, never assumed absent.
 *
 * What it is not: the qualifying-item lists themselves (each source's list governs item by item),
 * the rate the rest of the year (A-22), product taxability (A-31), or anything that posts or
 * files. Caps are on the item's SALES PRICE — each state counts delivery, shipping, handling and
 * transportation charges in that price, and both tables below say so.
 *
 * `capInclusive` is the difference between "less than $300" (Texas wording: an item at $300 is
 * taxable) and "$100 or less" (Florida wording: an item at $100 is exempt). The states differ,
 * so each band records which side of the line its cap sits on.
 */

export interface HolidayBand {
  /** the band's own id ('clothing-footwear', 'generators', …), stable across years */
  id: string;
  label: string;
  /** the most an item's sales price may be and still be exempt, in cents */
  capCents: number;
  /** true: the cap itself qualifies ("$100 or less"); false: only less than the cap ("under $300") */
  capInclusive: boolean;
  /** A-31 tax categories this band maps to, where the vocabularies fit (src/lib/tax/taxCategories.ts) */
  taxCategories?: string[];
  note?: string;
}

export interface SalesTaxHolidayRow {
  /** 'tx-back-to-school-2026': state, holiday and year */
  id: string;
  /** USPS state code */
  state: string;
  stateName: string;
  name: string;
  /** inclusive window (YYYY-MM-DD); the row is in force through its last day */
  from: string;
  to: string;
  bands: HolidayBand[];
  source: { authority: string; url: string; retrieved: string };
  /** the day this row was compared with the source */
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-15';
const TX_BTS = 'https://comptroller.texas.gov/taxes/publications/98-490.php';
const TX_EMERGENCY = 'https://comptroller.texas.gov/taxes/publications/98-1017.php';
const FL_TIP_26 = 'https://floridarevenue.com/taxes/tips/Documents/TIP_26A01-11.pdf';

/** Texas back-to-school bands: the state's own words are "less than $100" (the cap excludes). */
const TX_BACK_TO_SCHOOL_BANDS: HolidayBand[] = [
  {
    id: 'clothing-footwear',
    label: 'Most clothing, footwear and accessories (the publication’s qualifying list)',
    capCents: 10_000,
    capInclusive: false,
    taxCategories: ['clothing'],
    note: 'Specialized athletic or protective clothing and footwear, jewelry, handbags, luggage, watches and similar items are not on the qualifying list',
  },
  {
    id: 'school-supplies',
    label: 'School supplies and backpacks (the publication’s qualifying list)',
    capCents: 10_000,
    capInclusive: false,
    note: 'Only the supplies the Comptroller lists qualify; framed backpacks, computer bags and athletic bags do not',
  },
];

/** Florida back-to-school bands: the state's own words are "$X or less" (the cap includes). */
const FL_BACK_TO_SCHOOL_BANDS: HolidayBand[] = [
  {
    id: 'clothing-footwear',
    label: 'Clothing, footwear, wallets, handbags, backpacks, fanny packs and diaper bags',
    capCents: 10_000,
    capInclusive: true,
    taxCategories: ['clothing'],
    note: 'Briefcases, suitcases and garment bags are not included',
  },
  {
    id: 'school-supplies',
    label: 'The listed school supplies (pens, pencils, notebooks, binders, lunch boxes, …)',
    capCents: 5_000,
    capInclusive: true,
    note: 'Books not otherwise exempt, masking tape, computer and printer paper and correction supplies are not included',
  },
  {
    id: 'learning-aids',
    label: 'Learning aids and jigsaw puzzles',
    capCents: 3_000,
    capInclusive: true,
    note: 'General toys that do not teach reading or math are not included',
  },
  {
    id: 'computers-home-use',
    label: 'Personal computers and the listed computer-related accessories, for noncommercial home or personal use',
    capCents: 150_000,
    capInclusive: true,
    taxCategories: ['general'],
    note: 'A computer bought for commercial use, cellular phones, video game consoles and digital media receivers are not included; accessories qualify item by item',
  },
];

/**
 * The windows this table states. Texas holds three holidays a year and Florida two more (a
 * disaster-preparedness pair and a hunting/fishing/camping window); only the rows dated from a
 * source this lane checked are listed — the rest are named in the rule pack's `unmapped`.
 */
export const US_SALES_TAX_HOLIDAYS: SalesTaxHolidayRow[] = [
  {
    id: 'tx-back-to-school-2025',
    state: 'TX',
    stateName: 'Texas',
    name: 'Back-to-School',
    from: '2025-08-08',
    to: '2025-08-10',
    bands: TX_BACK_TO_SCHOOL_BANDS,
    source: { authority: 'Texas Comptroller of Public Accounts', url: TX_BTS, retrieved: CHECKED },
    checked: CHECKED,
    note: 'Friday 8 August through Sunday 10 August 2025; the sales price cap includes delivery, shipping, handling and transportation charges',
  },
  {
    id: 'tx-back-to-school-2026',
    state: 'TX',
    stateName: 'Texas',
    name: 'Back-to-School',
    from: '2026-08-07',
    to: '2026-08-09',
    bands: TX_BACK_TO_SCHOOL_BANDS,
    source: { authority: 'Texas Comptroller of Public Accounts', url: TX_BTS, retrieved: CHECKED },
    checked: CHECKED,
    note: 'Friday 7 August through Sunday 9 August 2026; from 2026 the window is fixed by law to the first Friday in August and the weekend after it',
  },
  {
    id: 'tx-emergency-prep-2026',
    state: 'TX',
    stateName: 'Texas',
    name: 'Emergency Preparation Supplies',
    from: '2026-04-25',
    to: '2026-04-27',
    bands: [
      {
        id: 'generators',
        label: 'Portable generators',
        capCents: 300_000,
        capInclusive: false,
      },
      {
        id: 'shutters-ladders',
        label: 'Emergency ladders and hurricane shutters',
        capCents: 30_000,
        capInclusive: false,
      },
      {
        id: 'emergency-supplies',
        label: 'Axes, batteries, non-electric can openers, carbon monoxide detectors, coolers, fire extinguishers, first aid kits, fuel containers, hatchets, reusable ice and the publication’s other listed supplies',
        capCents: 7_500,
        capInclusive: false,
      },
    ],
    source: { authority: 'Texas Comptroller of Public Accounts', url: TX_EMERGENCY, retrieved: CHECKED },
    checked: CHECKED,
    note: '12:01 a.m. Saturday 25 April through midnight Monday 27 April 2026; no limit on the number of qualifying items; delivery and shipping charges count toward each cap (the Comptroller’s own $299 ladder + $10 delivery example is taxable)',
  },
  {
    id: 'fl-back-to-school-2025',
    state: 'FL',
    stateName: 'Florida',
    name: 'Back-to-School',
    from: '2025-08-01',
    to: '2025-08-31',
    bands: FL_BACK_TO_SCHOOL_BANDS,
    source: { authority: 'Florida Department of Revenue', url: 'https://floridarevenue.com/taxes/tips/Pages/default.aspx', retrieved: CHECKED },
    checked: CHECKED,
    note: 'The 2025 window ran the full month of August; sales inside a theme park, entertainment complex, public lodging establishment or airport are never covered',
  },
  {
    id: 'fl-back-to-school-2026',
    state: 'FL',
    stateName: 'Florida',
    name: 'Back-to-School',
    from: '2026-07-20',
    to: '2026-08-20',
    bands: FL_BACK_TO_SCHOOL_BANDS,
    source: { authority: 'Florida Department of Revenue (TIP 26A01-11)', url: FL_TIP_26, retrieved: CHECKED },
    checked: CHECKED,
    note: 'Monday 20 July through Thursday 20 August 2026 (Section 27, Chapter 2026-239, Laws of Florida; Rule 12A-1.117, F.A.C.); dealers may not opt out; rentals, repairs and alterations of eligible items are not covered',
  },
];

const inWindow = (row: SalesTaxHolidayRow, date: string) => row.from <= date && date <= row.to;

/** Every state this table has a row for (A→Z), with the state's name. */
export function holidayStates(): Array<{ state: string; stateName: string }> {
  const seen = new Map<string, string>();
  for (const row of US_SALES_TAX_HOLIDAYS) if (!seen.has(row.state)) seen.set(row.state, row.stateName);
  return [...seen.entries()].map(([state, stateName]) => ({ state, stateName })).sort((a, b) => a.state.localeCompare(b.state));
}

/** The rows in force on a date (a window is inclusive of its first and last day). */
export function holidayRowsInForce(state: string, date: string): SalesTaxHolidayRow[] {
  const code = state.toUpperCase();
  return US_SALES_TAX_HOLIDAYS.filter(row => row.state === code && inWindow(row, date));
}

/** A state's rows for one year, for the calendar. */
export function holidayRowsForYear(state: string, year: number): SalesTaxHolidayRow[] {
  const code = state.toUpperCase();
  return US_SALES_TAX_HOLIDAYS.filter(row => row.state === code && row.from.slice(0, 4) === String(year));
}

export type HolidayAnswerState = 'within-cap' | 'over-cap' | 'not-in-force';

export interface HolidayItemAnswer {
  state: HolidayAnswerState;
  /** the row and band the question was asked about */
  holidayId?: string;
  bandId?: string;
  capCents?: number;
  capInclusive?: boolean;
  /** one plain sentence, the same words the screen shows */
  because: string;
}

/**
 * Is an item at `priceCents` inside one band's cap on a date? The reference application of a
 * holiday row: the window is inclusive, the cap is on the item's sales price (delivery and
 * handling count in it), and the cap's own side of the line comes from the state's wording.
 * This answers the table's question only — it never changes a tax the engine computed.
 */
export function holidayItemAnswer(
  state: string,
  date: string,
  bandId: string,
  priceCents: number,
): HolidayItemAnswer {
  const code = state.toUpperCase();
  const rows = holidayRowsInForce(code, date);
  if (rows.length === 0) {
    return { state: 'not-in-force', because: `No sales tax holiday from this table is in force in ${code} on ${date}.` };
  }
  for (const row of rows) {
    const band = row.bands.find(b => b.id === bandId);
    if (!band) continue;
    const within = band.capInclusive ? priceCents <= band.capCents : priceCents < band.capCents;
    const capWords = `${band.capInclusive ? 'at or below' : 'below'} ${(band.capCents / 100).toFixed(2)}`;
    return {
      state: within ? 'within-cap' : 'over-cap',
      holidayId: row.id,
      bandId: band.id,
      capCents: band.capCents,
      capInclusive: band.capInclusive,
      because: within
        ? `Inside ${row.name} (${row.stateName}, ${row.from} to ${row.to}): this band is exempt while the item’s sales price is ${capWords}. The qualifying-item list in the source governs which items the band covers.`
        : `Over the cap for this band: the exemption reaches only items with a sales price ${capWords}, and this item is at ${(priceCents / 100).toFixed(2)}. The whole item is taxable — the cap is not a deduction.`,
    };
  }
  return { state: 'not-in-force', because: `No holiday in force in ${code} on ${date} has the band '${bandId}'.` };
}

export const HOLIDAY_CSV_HEADERS: string[] = ['State', 'Holiday', 'From', 'To', 'Band', 'Cap (major units)', 'Cap wording', 'Authority', 'Source URL', 'Checked', 'Note'];

/** The cap in words on the state's own side of the line: "below 100.00" or "at or below 100.00". */
export function bandCapWords(band: HolidayBand): string {
  return `${band.capInclusive ? 'at or below' : 'below'} ${(band.capCents / 100).toFixed(2)}`;
}

/** One CSV line per row × band, the way the screen exports the calendar. */
export function holidayCsvRows(rows: SalesTaxHolidayRow[]): string[][] {
  return rows.flatMap(row => row.bands.map(band => [
    `${row.state} ${row.stateName}`,
    row.name,
    row.from,
    row.to,
    band.label,
    (band.capCents / 100).toFixed(2),
    band.capInclusive ? 'at or below the cap' : 'below the cap',
    row.source.authority,
    row.source.url,
    row.checked,
    [row.note, band.note].filter(Boolean).join(' · '),
  ]));
}
