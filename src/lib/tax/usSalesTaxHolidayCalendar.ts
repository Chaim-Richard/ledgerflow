/**
 * A-109: the US sales-tax holiday CALENDAR — which states and territories run a window, when it is,
 * and what kind of relief it is. One dated row per window, with the publication that states it.
 *
 * A-58 (src/lib/tax/usSalesTaxHolidays.ts) states the windows whose QUALIFYING ITEMS and per-item
 * price caps are read from the state's publication, because those rows become taxability rules. This
 * table is deliberately a different thing: it answers "when", not "what". A row here has no item
 * bands, so it can never be read as "nothing is taxed that week" — the pack does not build a rule from
 * it, and `us-sales-tax-holiday-calendar.test.ts` asserts exactly that (no calendar-only window has a
 * rule id in the pack, and the pack still has one rule per A-58 row). When a state's items and caps are read and stated, the window grows a row in A-58's
 * table and the calendar keeps saying when it runs, so the two tables have to agree:
 * `src/tests/us-sales-tax-holiday-calendar.test.ts` compares the dates of every id both tables state, refuses
 * a rule for any calendar-only window, and refuses to let the calendar drop a state that already has rules.
 *
 * Three kinds of window, because they are not the same relief:
 *  - `exempt` — qualifying items carry no sales tax during the window (most states);
 *  - `reduced-rate` — the rate falls instead of disappearing (Illinois keeps 1.25% of the 6.25% state
 *    rate and no local tax relief; Skagway, Alaska drops its municipal rate from 5% to 3% for the
 *    season). Reading these as "no tax" overstates the saving.
 *  - `restricted-purchaser` — the goods are always taxable, but a named class of buyer is relieved
 *    (Nevada's National Guard weekend, New Mexico's Small Business Saturday is a different shape again).
 *
 * Sources: every row was read on 2026-10-20 from the Federation of Tax Administrators' dated 2026
 * table (the association of the state revenue agencies, which lists each state's own page beside it),
 * and `statePageUrl` carries that page so a person can confirm the window at the source. Where the
 * state's own page was opened for this change, `statePageRead` is true and its words are quoted in the
 * row; where it was not, the row says so. The FTA table itself marks a row "statute-derived" when the
 * state's page had not been updated — `statuteDerived` carries that warning, and no date here is
 * asserted to have been confirmed by the state unless the row says it was.
 *
 * Nothing here files, posts or calculates tax. A holiday does not change a return: it changes which
 * sales are taxable inside the window, and the state's own publication governs item by item.
 */

export type SalesTaxHolidayCalendarKind = 'exempt' | 'reduced-rate' | 'restricted-purchaser';

export interface SalesTaxHolidayCalendarRow {
  /** 'va-sales-tax-holiday-2026' — matches the id A-58's rule table uses for the same window, when it has one */
  id: string;
  /** USPS code, or 'PR' for Puerto Rico; a municipality says so in its note */
  state: string;
  stateName: string;
  /** the holiday's own name, stable across years */
  name: string;
  /** inclusive first day (YYYY-MM-DD) */
  from: string;
  /** inclusive last day (YYYY-MM-DD) */
  to: string;
  kind: SalesTaxHolidayCalendarKind;
  /** the state's recurrence rule, in its own words, where a page states one */
  pattern?: string;
  source: { authority: string; url: string; retrieved: string };
  /** the state agency's own page, as listed beside the row in the compilation */
  statePageUrl?: string;
  /** true only when this change opened that page and read the window from it */
  statePageRead?: boolean;
  /** the compilation marks this date as calculated from a rule because the agency's page was not yet updated */
  statuteDerived?: boolean;
  note?: string;
}

const CHECKED = '2026-10-20';
const FTA = 'https://taxadmin.org/2026-sales-tax-holidays/';
const FTA_AUTHORITY = 'Federation of Tax Administrators — 2026 Sales Tax Holidays (state-by-state table, research July 2026)';

/** read from Virginia Tax's own page on 2026-10-20, not only from the compilation */
const VA_PAGE = 'https://www.tax.virginia.gov/virginia-sales-tax-holiday';

function fta(
  id: string,
  state: string,
  stateName: string,
  name: string,
  from: string,
  to: string,
  kind: SalesTaxHolidayCalendarKind,
  statePageUrl?: string,
  extra?: Partial<SalesTaxHolidayCalendarRow>,
): SalesTaxHolidayCalendarRow {
  return {
    id, state, stateName, name, from, to, kind,
    source: { authority: FTA_AUTHORITY, url: FTA, retrieved: CHECKED },
    statePageUrl,
    ...extra,
  };
}

export const US_SALES_TAX_HOLIDAY_CALENDAR: SalesTaxHolidayCalendarRow[] = [
  fta('al-severe-weather-2026', 'AL', 'Alabama', 'Severe Weather Preparedness Sales Tax Holiday', '2026-02-20', '2026-02-22', 'exempt',
    'https://www.revenue.alabama.gov/wp-content/uploads/2025/11/2026-Severe-Weather-Sales-Tax-Holiday-Fact-Sheet.pdf',
    { note: 'The compilation lists the caps with the window (general items $94 an item, generators and power cords $1,564); they are not stated as bands here, so no rule is made from this row. Alabama caps are CPI-indexed under Act 2025-309.' }),
  fta('al-back-to-school-2026', 'AL', 'Alabama', 'Back-to-School Sales Tax Holiday', '2026-07-17', '2026-07-19', 'exempt',
    'https://www.revenue.alabama.gov/wp-content/uploads/2025/11/2026-Back-to-School-Sales-Tax-Holiday-Fact-Sheet.pdf',
    { pattern: 'the Friday through the following Sunday (12:01 am to midnight), set each year by the Department', note: 'Local participation is opt-in in Alabama, so a qualifying item in a county that opted out is still taxed. The compilation carries the indexed caps ($156 clothing, $1,173 computers, $78 supplies, $47 books); they are not stated as bands here.' }),
  fta('ak-skagway-seasonal-2026-27', 'AK', 'Alaska (Skagway, municipal)', 'Skagway seasonal reduced municipal sales tax rate', '2026-10-01', '2027-03-31', 'reduced-rate',
    'https://skagway.municipal.codes/SMC/4.08.020',
    { pattern: 'October 1 through March 31 each year, by municipal code', statuteDerived: true, note: 'Not a state holiday and not an exemption: Skagway\'s municipal rate is 5% April to September and 3% October to March. The compilation gives the 2025-26 season and says the same cycle continues into 2026-27, so this row is the cycle rather than an announcement — confirm it against the municipal code before using it.' }),
  fta('ar-back-to-school-2026', 'AR', 'Arkansas', 'Back-to-School Sales Tax Holiday', '2026-08-01', '2026-08-02', 'exempt',
    'https://www.dfa.arkansas.gov/wp-content/uploads/Sales_Tax_Holiday_Instructions_2026.pdf',
    { note: 'Applies to state and local tax. The Department\'s instructions carry the item lists and the under-$100 / under-$50 limits; those are not stated as bands here, so no rule is made.' }),
  fta('ct-back-to-school-2026', 'CT', 'Connecticut', 'Sales Tax-Free Week', '2026-08-16', '2026-08-22', 'exempt',
    'https://portal.ct.gov/drs/sales-tax/sales-tax-free-week',
    { pattern: 'the third Sunday in August through the following Saturday', note: 'A change enacted for 2026 raised the clothing and footwear limit from $100 to under $300 and added cleated shoes and backpacks, and a year-round exemption for some non-electronic school supplies began July 1, 2026. Neither is stated as a band here.' }),
  fta('fl-back-to-school-2026', 'FL', 'Florida', 'Back-to-School Sales Tax Holiday', '2026-07-20', '2026-08-20', 'exempt',
    'https://floridarevenue.com/backtoschool/Pages/default.aspx',
    { note: 'The Department\'s own page and publication state this window, and A-58 already carries its four bands with their caps as a rule — the two tables must agree on these dates, which the test below enforces. The 2026 window moved about two weeks earlier than 2025 to line up with the school year.' }),
  fta('fl-hunting-fishing-camping-2026', 'FL', 'Florida', 'Hunting, Fishing and Camping Sales Tax Holiday', '2026-09-01', '2026-12-31', 'exempt',
    'https://floridarevenue.com/HuntFishCamp/Pages/default.aspx',
    { pattern: 'renewed by the Legislature each year — it is not permanent, unlike the back-to-school window', note: 'The compilation says the 2026 window starts a week earlier than 2025 and adds suppressors. Its sub-caps are not stated as bands here.' }),
  fta('il-back-to-school-2026', 'IL', 'Illinois', 'Back-to-School Sales Tax Holiday', '2026-08-07', '2026-08-16', 'reduced-rate',
    'https://www.illinois.gov/news/release.html?releaseid=25262',
    { note: 'Illinois does not exempt these sales: the state rate falls from 6.25% to 1.25% and LOCAL taxes are still charged in full. A shop that treats this window as tax-free under-collects. Illinois had no sales tax holiday at all from 2023 through 2025.' }),
  fta('ia-back-to-school-2026', 'IA', 'Iowa', 'Back-to-School Sales Tax Holiday', '2026-08-07', '2026-08-08', 'exempt',
    'https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/iowas-annual-sales-tax-holiday',
    { pattern: 'the first Friday and Saturday of August', note: 'Clothing and footwear under $100 an item, per the Department; not stated as a band here.' }),
  fta('la-second-amendment-2026', 'LA', 'Louisiana', 'Second Amendment Weekend Sales Tax Holiday', '2026-09-04', '2026-09-06', 'exempt',
    'https://revenue.louisiana.gov/secondamendment/',
    { pattern: 'the Friday through Sunday after Labor Day', note: 'Firearms, ammunition and hunting supplies, with no price limit; applies to state and local tax.' }),
  fta('md-energy-weekend-2026', 'MD', 'Maryland', 'Shop MD Energy Weekend', '2026-02-14', '2026-02-16', 'exempt',
    'https://www.marylandcomptroller.gov/about/comptroller/programs.html',
    { note: 'Energy Star products, no price cap.' }),
  fta('md-tax-free-week-2026', 'MD', 'Maryland', 'Shop MD Tax-Free Week', '2026-08-09', '2026-08-15', 'exempt',
    'https://www.marylandcomptroller.gov/about/comptroller/programs.html',
    { note: 'Clothing and footwear at or under $100 an item, and the first $40 of a backpack or bookbag — a partial exemption, which is a different shape again from a cap.' }),
  fta('ma-sales-tax-holiday-2026', 'MA', 'Massachusetts', 'Sales Tax Holiday', '2026-08-08', '2026-08-09', 'exempt',
    'https://malegislature.gov/PressRoom/Detail?pressReleaseId=1408',
    { pattern: 'authorized by the Legislature each year — the 2026 dates were adopted by resolution on June 11, 2026', note: 'Tangible personal property for personal use at $2,500 or less. There is no permanent Massachusetts holiday: a year without a resolution has no window.' }),
  fta('ms-back-to-school-2026', 'MS', 'Mississippi', 'Back-to-School Sales Tax Holiday', '2026-07-10', '2026-07-12', 'exempt',
    'https://www.dor.ms.gov/news/sales-tax-holiday-july-10-12',
    { pattern: 'the second Friday of July and the two days after it, since 2024 (SB 2470); before that it was the last Friday in July, two days', note: 'A town may opt out by resolution, so local tax can still apply inside the corporate limits. Clothing, footwear and school supplies under $100 an item.' }),
  fta('ms-second-amendment-2026', 'MS', 'Mississippi', 'Second Amendment Weekend Sales Tax Holiday', '2026-08-28', '2026-08-30', 'exempt',
    'https://www.dor.ms.gov/',
    { note: 'Firearms, ammunition, hunting supplies and safety equipment including safes, no price limit; state and local.' }),
  fta('mo-show-me-green-2026', 'MO', 'Missouri', 'Show Me Green Sales Tax Holiday', '2026-04-19', '2026-04-25', 'exempt',
    'https://dor.mo.gov/taxation/business/tax-types/sales-use/holidays/show-me-green/consumers.html',
    { note: 'Energy Star appliances, $1,500 or less — Missouri exempts the first $1,500 of a qualifying item and taxes what is above it, so an expensive unit is partly taxable rather than wholly outside the holiday.' }),
  fta('mo-back-to-school-2026', 'MO', 'Missouri', 'Back-to-School Sales Tax Holiday', '2026-08-07', '2026-08-09', 'exempt',
    'https://dor.mo.gov/taxation/business/tax-types/sales-use/holidays/back-to-school/consumers.html',
    { note: 'Clothing at or under $100, supplies at or under $50, software at or under $350, computers and peripherals at or under $1,500, graphing calculators at or under $150, per the Department; not stated as bands here.' }),
  fta('nm-back-to-school-2026', 'NM', 'New Mexico', 'Back-to-School Sales Tax Holiday', '2026-07-31', '2026-08-02', 'exempt',
    'https://www.tax.newmexico.gov/news-alerts/tax-holiday/',
    { note: 'School supplies at or under $30, clothing and footwear under $100, computers at or under $1,000, computer equipment at or under $500.' }),
  fta('nm-small-business-saturday-2026', 'NM', 'New Mexico', 'Small Business Saturday Tax Holiday', '2026-11-28', '2026-11-28', 'exempt',
    'https://www.tax.newmexico.gov/news-alerts/small-business-saturday-tax-holiday/',
    { pattern: 'the Saturday after Thanksgiving, by statute', note: 'Qualifying items under $500 from qualifying small businesses, and gift cards are excluded — the relief depends on the SELLER as well as the item, which a per-item cap cannot express.' }),
  fta('nv-national-guard-2026', 'NV', 'Nevada', 'Nevada Day National Guard Sales Tax Exemption', '2026-10-30', '2026-11-01', 'restricted-purchaser',
    'https://tax.nv.gov/faqs/nevada-national-guard-tax-holiday-faqs/',
    { note: 'Not a shopping holiday: purchases by qualifying National Guard members and their relatives are exempt in the window. It cannot be applied from an item list, which is why it is recorded here and nowhere in the rule packs.' }),
  fta('oh-sales-tax-holiday-2026', 'OH', 'Ohio', 'Sales Tax Holiday', '2026-08-07', '2026-08-09', 'exempt',
    'https://tax.ohio.gov/wps/portal/gov/tax/home/news-and-events/all-news/ohio-sales-tax-holiday-2026',
    { note: 'The wider ten-day holiday of 2024 and 2025 was repealed, so 2026 is back to the three-day window with narrower categories (clothing at or under $75, supplies and instructional materials at or under $20). A table that carried 2025\'s ten days forward would be wrong for 2026 — which is why each year is its own row.' }),
  fta('ok-back-to-school-2026', 'OK', 'Oklahoma', 'Back-to-School Sales Tax Holiday', '2026-08-07', '2026-08-09', 'exempt',
    'https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/infographics/SalesTaxHoliday.pdf',
    { pattern: 'the first Friday, Saturday and Sunday of August', note: 'Clothing and footwear under $100 an item, and participation is mandatory for merchants in Oklahoma — unlike the states where a shop may opt out.' }),
  fta('pr-hurricane-preparedness-2026', 'PR', 'Puerto Rico', 'Hurricane Preparedness Sales Tax Holiday', '2026-05-22', '2026-05-25', 'exempt',
    'https://hacienda.pr.gov/sobre-hacienda/sala-de-prensa-virtual/comunicados-de-prensa/hacienda-anuncia-ventas-sin-ivu-para-articulos-de-preparacion-para-la-temporada-de-huracanes-del-22-al-25-de-mayo',
    { note: 'Portable generators at or under $3,000 and other listed hurricane items, against the IVU.' }),
  fta('pr-back-to-school-2026', 'PR', 'Puerto Rico', 'Back-to-School Sales Tax Holiday', '2026-07-17', '2026-07-18', 'exempt',
    'https://hacienda.pr.gov/publicaciones/carta-circular-de-rentas-internas-num-26-11-cc-ri-26-11',
    { note: 'Puerto Rico runs two separate two-day periods in a fiscal year, per Hacienda\'s circular CC RI 26-11; the other one is the January row below.' }),
  fta('pr-back-to-school-2027', 'PR', 'Puerto Rico', 'Back-to-School Sales Tax Holiday', '2027-01-08', '2027-01-09', 'exempt',
    'https://hacienda.pr.gov/publicaciones/carta-circular-de-rentas-internas-num-26-11-cc-ri-26-11',
    { note: 'The second of the fiscal year\'s two periods, published in the same circular as the July 2026 window — a 2027 date that is already official, unlike most states\' next-year windows.' }),
  fta('sc-tax-free-weekend-2026', 'SC', 'South Carolina', 'Sales Tax Free Weekend', '2026-08-07', '2026-08-09', 'exempt',
    undefined,
    { pattern: 'the first Friday, Saturday and Sunday of August, 12:01 am Friday to midnight Sunday', note: 'Clothing, accessories, footwear, school supplies, computers, printers, printer supplies and software, and certain bed and bath items, with NO price limit, and merchants must participate. The compilation states this window without a link, so it is the one row here with no state page listed — the South Carolina Department\'s own page should be opened before it is relied on.' }),
  fta('tn-back-to-school-2026', 'TN', 'Tennessee', 'Back-to-School Sales Tax Holiday', '2026-07-31', '2026-08-02', 'exempt',
    'https://revenue.support.tn.gov/hc/en-us/sections/201022109-Sales-Tax-Holiday',
    { note: 'Clothing and school supplies at or under $100, computers at or under $1,500. Two things a shopping-guide list still gets wrong about Tennessee: the gun-safe holiday became a PERMANENT year-round exemption on November 1, 2023 and is not a dated window, and the 2023 grocery suspension was a one-time event, not a recurring holiday. A July 24-26 or July 25-27 date in circulation is the 2025 weekend.' }),
  fta('tx-back-to-school-2026', 'TX', 'Texas', 'Back-to-School Sales Tax Holiday', '2026-08-07', '2026-08-09', 'exempt',
    'https://comptroller.texas.gov/taxes/publications/98-490/',
    { note: 'A-58 states this window with its bands and caps as a rule (publication 98-490), and the two tables carry the same dates on purpose; the test compares them by id.' }),
  fta('tx-energy-star-2026', 'TX', 'Texas', 'ENERGY STAR Products Sales Tax Holiday', '2026-05-23', '2026-05-25', 'exempt',
    'https://comptroller.texas.gov/taxes/publications/96-1331.php',
    { pattern: 'Memorial Day weekend', note: 'Air-conditioning units at or under $6,000, refrigerators at or under $2,000, and ceiling fans, bulbs, washers, dishwashers and dehumidifiers without a limit (publication 96-1331). It runs the same weekend as the water-efficient window below.' }),
  fta('tx-water-efficient-2026', 'TX', 'Texas', 'Water-Efficient Products Sales Tax Holiday', '2026-05-23', '2026-05-25', 'exempt',
    'https://comptroller.texas.gov/taxes/publications/98-1018.php',
    { pattern: 'Memorial Day weekend', note: 'WaterSense-labeled products without a limit, for residential use. This is the window A-58 listed as a row still to add; its dates are now stated here so a planner can see it, and its product list is still to be read from publication 98-1018 before any rule exists.' }),
  fta('tx-emergency-prep-2026', 'TX', 'Texas', 'Emergency Preparation Supplies Sales Tax Holiday', '2026-04-25', '2026-04-27', 'exempt',
    'https://comptroller.texas.gov/taxes/publications/98-1017.php',
    { note: 'A-58 states this window with its three bands (generators under $3,000, shutters and ladders under $300, other supplies under $75 — Texas says UNDER, so an item at the cap is taxed) as a rule from publication 98-1017; the dates are the same here and the test enforces it.' }),
  {
    id: 'va-sales-tax-holiday-2026',
    state: 'VA', stateName: 'Virginia', name: 'Sales Tax Holiday',
    from: '2026-08-07', to: '2026-08-09', kind: 'exempt',
    pattern: 'the 3-day holiday starts the first Friday in August at 12:01 am and ends the following Sunday at 11:59 pm (the Department\'s own words)',
    source: { authority: 'Virginia Department of Taxation — Virginia Sales Tax Holiday', url: VA_PAGE, retrieved: CHECKED },
    statePageUrl: VA_PAGE,
    statePageRead: true,
    note: 'The one window in this table read from the state\'s own page for this change, and it is worth knowing why: a widely-copied commercial calendar lists Virginia\'s 2026 holiday as August 1-3, which is wrong — the Department says August 7-9 and gives the rule that fixes it (the first Friday in August). The page also lists the items and limits (school supplies $20 or less, clothing and footwear $100 or less, portable generators $1,000, gas-powered chainsaws $350, chainsaw accessories and other specified hurricane items $60, Energy Star and WaterSense products $2,500), with three qualifying-item lists and the Sales Tax Holiday Guidelines linked from it. Those are not stated as bands here — a Virginia row in A-58\'s table is the place for them.',
  },
  fta('wv-sales-tax-holiday-2026', 'WV', 'West Virginia', 'Sales Tax Holiday', '2026-07-31', '2026-08-03', 'exempt',
    'https://tax.wv.gov/Business/Pages/SalesTaxHoliday.aspx',
    { pattern: 'the Friday before the first Sunday in August through the following Monday', note: 'Four days, not three — clothing and footwear at or under $125, computers at or under $500, instructional materials at or under $20, supplies at or under $50, sports equipment at or under $150.' }),
];

/**
 * Windows that exist but are NOT dated here, so nobody reads this table as complete. A-109 states the
 * calendar of the states whose 2026 publication was read; these are the ones still to add.
 */
export const HOLIDAY_CALENDAR_NOT_STATED: { row: string; reason: string }[] = [
  {
    row: 'Florida disaster preparedness holidays (two 14-day windows a year)',
    reason: 'the 2026 table read for this change lists Florida\'s back-to-school and hunting/fishing/camping windows but not the two disaster-preparedness ones, so their dates are not stated; the Legislature sets them each year and the Department\'s TIP is the source to read',
  },
  {
    row: 'Alabama food sales tax holiday (May 1 – June 30, 2026 in two professional summaries)',
    reason: 'not in the compilation read for this change, so this table does not state it; the Alabama Department\'s own page is the source, and note it suspends only the STATE tax on food for home consumption',
  },
  {
    row: 'every state\'s 2027 windows',
    reason: 'most states publish next year\'s dates in the spring or summer; only Puerto Rico\'s fiscal-year pair is already published for January 2027 and that one is a row above',
  },
  {
    row: 'item lists and price caps for every calendar row here',
    reason: 'A-109 is the calendar. A window becomes a rule only when A-58\'s table carries its bands from the state\'s publication, which today is Texas (two windows) and Florida (one); the caps named in a row\'s note are what the compilation says, not a stated band',
  },
];

export function holidayCalendarRowsForYear(year: number): SalesTaxHolidayCalendarRow[] {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return US_SALES_TAX_HOLIDAY_CALENDAR.filter(r => r.from <= to && r.to >= from).sort((a, b) => a.from.localeCompare(b.from));
}

/** windows running on a date, whether or not they started earlier */
export function holidayCalendarRowsOn(date: string): SalesTaxHolidayCalendarRow[] {
  return US_SALES_TAX_HOLIDAY_CALENDAR.filter(r => r.from <= date && date <= r.to).sort((a, b) => a.from.localeCompare(b.from));
}

/** the next window that starts on or after a date — the planner's question */
export function nextHolidayWindow(fromDate: string): SalesTaxHolidayCalendarRow | undefined {
  return [...US_SALES_TAX_HOLIDAY_CALENDAR].sort((a, b) => a.from.localeCompare(b.from)).find(r => r.from >= fromDate);
}

export interface HolidayCalendarMonth {
  /** '2026-08' */
  month: string;
  rows: SalesTaxHolidayCalendarRow[];
}

/** the years this table has a window in, so the screen can offer only what it can answer */
export function holidayCalendarYears(): number[] {
  const years = new Set<number>();
  for (const row of US_SALES_TAX_HOLIDAY_CALENDAR) {
    years.add(Number(row.from.slice(0, 4)));
    if (row.to.slice(0, 4) !== row.from.slice(0, 4)) years.add(Number(row.to.slice(0, 4)));
  }
  return [...years].sort((a, b) => a - b);
}

/** grouped by the month a window STARTS in, so a window that runs into the next month is not listed twice */
export function holidayCalendarMonthsForYear(year: number): HolidayCalendarMonth[] {
  const out: HolidayCalendarMonth[] = [];
  for (const row of holidayCalendarRowsForYear(year)) {
    const month = row.from.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === month) last.rows.push(row);
    else out.push({ month, rows: [row] });
  }
  return out;
}

export function holidayCalendarStatesForYear(year: number): Array<{ state: string; stateName: string; windows: number }> {
  const byState = new Map<string, { state: string; stateName: string; windows: number }>();
  for (const row of holidayCalendarRowsForYear(year)) {
    const found = byState.get(row.state);
    if (found) found.windows += 1;
    else byState.set(row.state, { state: row.state, stateName: row.stateName, windows: 1 });
  }
  return [...byState.values()].sort((a, b) => a.state.localeCompare(b.state));
}

/**
 * Every id this table shares with A-58's rule table must carry the same window, and no calendar-only
 * window may have become a rule. Structural problems, not a tax opinion.
 */
export function usSalesTaxHolidayCalendarProblems(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const row of US_SALES_TAX_HOLIDAY_CALENDAR) {
    if (ids.has(row.id)) problems.push(`${row.id}: duplicate id`);
    ids.add(row.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.from)) problems.push(`${row.id}: from is not a date`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.to)) problems.push(`${row.id}: to is not a date`);
    if (row.from > row.to) problems.push(`${row.id}: ends before it starts`);
    if (!/^[A-Z]{2}$/.test(row.state)) problems.push(`${row.id}: state must be a two-letter code`);
    if (!row.stateName || !row.name) problems.push(`${row.id}: a state and a holiday name are required`);
    if (!['exempt', 'reduced-rate', 'restricted-purchaser'].includes(row.kind)) problems.push(`${row.id}: kind is not in the vocabulary`);
    if (!/^https:\/\//.test(row.source.url)) problems.push(`${row.id}: source must be https`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.source.retrieved)) problems.push(`${row.id}: the source needs the day it was read`);
    if (row.statePageUrl && !/^https:\/\//.test(row.statePageUrl)) problems.push(`${row.id}: the state page url must be https`);
    if (row.statePageRead && row.statePageUrl && row.source.url !== row.statePageUrl) {
      problems.push(`${row.id}: a row that says its state page was read must be sourced from that page, not the compilation`);
    }
  }
  // the anchors, so a silent edit to a date is caught here and not in a client's filing plan
  const anchor = (id: string, from: string, to: string) => {
    const row = US_SALES_TAX_HOLIDAY_CALENDAR.find(r => r.id === id);
    if (!row) { problems.push(`${id}: the row is gone`); return; }
    if (row.from !== from || row.to !== to) problems.push(`${id}: ${row.from}→${row.to}, expected ${from}→${to}`);
  };
  anchor('va-sales-tax-holiday-2026', '2026-08-07', '2026-08-09');
  anchor('tx-back-to-school-2026', '2026-08-07', '2026-08-09');
  anchor('fl-back-to-school-2026', '2026-07-20', '2026-08-20');
  anchor('wv-sales-tax-holiday-2026', '2026-07-31', '2026-08-03');
  anchor('il-back-to-school-2026', '2026-08-07', '2026-08-16');
  return problems;
}

export const HOLIDAY_CALENDAR_CSV_HEADERS: string[] = ['State', 'Holiday', 'From', 'To', 'Kind', 'Recurrence rule', 'Source', 'Read on', 'State page', 'State page read', 'Note'];

export function holidayCalendarCsvRows(): string[][] {
  return US_SALES_TAX_HOLIDAY_CALENDAR.map(r => [
    r.stateName, r.name, r.from, r.to, r.kind, r.pattern || '', r.source.authority, r.source.retrieved,
    r.statePageUrl || '', r.statePageRead ? 'yes' : 'no', r.note || '',
  ]);
}
