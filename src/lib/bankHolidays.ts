/**
 * A-137: bank holiday calendars (US, Israel, UK — England & Wales, and the euro area's TARGET)
 * for moving a due date that falls on a day banks are closed. Every list is generated from the
 * authority's own rules and pinned by tests to the authority's published 2026–2027 lists:
 *
 * - US: the Federal Reserve's K.8 holiday schedule. Federal Reserve Banks close on the weekday
 *   holidays below; when a fixed holiday falls on Sunday they close the following Monday; when it
 *   falls on Saturday they are OPEN the preceding Friday (only the Board of Governors closes) —
 *   those Saturdays come back as `kind: 'note'` rows and do not move a due date.
 * - Israel: the Bank of Israel's list of bank and public holidays. Saturday is the weekly rest
 *   day; Friday is a short banking day (the Bank of Israel works until 13:15) and counts as a
 *   working day here. Closures are the statutory rest days, both Purims (Tel Aviv, then
 *   Jerusalem), the fast of Tisha B'Av and Independence Day as observed (5 Iyar, brought forward
 *   to Thursday when it falls on Friday or Saturday and put off to Tuesday when it falls on
 *   Monday). Holiday eves and the intermediate festival days are short days, not closures.
 *   Election days are also bank holidays but are announced separately and cannot be generated —
 *   the screen says so. Hebrew dates are read from the platform's Hebrew calendar (Intl), so no
 *   date table is hand-typed; tests pin the generated 2026 list to the Bank of Israel's PDF.
 * - UK: GOV.UK's bank holidays for England and Wales (Scotland and Northern Ireland have their
 *   own lists and are not generated here), with the substitute weekday when a fixed day falls at
 *   a weekend.
 * - TARGET: the ECB's TARGET closing days; fixed days are not moved when they fall at a weekend.
 *
 * A generated calendar describes the rules in force today; an authority can add a one-off holiday
 * (a royal occasion, an election) that no rule generates. Status: reference data ('calculation')
 * — a moved due date must still be checked before it is promised to anyone.
 */

export type BankCalendarId = 'US' | 'IL' | 'GB-EW' | 'TARGET';

export interface BankHoliday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** Hebrew name, for the Israeli calendar */
  nameHe?: string;
  /** closed = banks closed all day; short-day = shortened hours, still a working day; note = information only */
  kind: 'closed' | 'short-day' | 'note';
  note?: string;
}

export interface BankCalendarSource { authority: string; url: string; retrieved: string }

export interface BankCalendar {
  id: BankCalendarId;
  name: string;
  /** days of the week that are never working days (0 = Sunday … 6 = Saturday) */
  weekend: number[];
  source: BankCalendarSource;
  note: string;
}

const RETRIEVED = '2026-10-22';

export const BANK_CALENDARS: Record<BankCalendarId, BankCalendar> = {
  US: {
    id: 'US',
    name: 'United States (Federal Reserve Banks)',
    weekend: [0, 6],
    source: { authority: 'Federal Reserve — Holidays Observed, K.8', url: 'https://www.federalreserve.gov/aboutthefed/k8.htm', retrieved: RETRIEVED },
    note: 'For a holiday on Saturday the Federal Reserve Banks are open the preceding Friday, but the Board of Governors is closed; many commercial banks close that Friday too. Check the bank before relying on it.',
  },
  IL: {
    id: 'IL',
    name: 'Israel (Bank of Israel)',
    weekend: [6],
    source: { authority: 'Bank of Israel — Markets Department business days', url: 'https://www.boi.org.il/en/economic-roles/financial-markets/', retrieved: RETRIEVED },
    note: 'Fridays, holiday eves and the intermediate days of Passover and Sukkot are short banking days (the Bank of Israel works until 13:15) and count as working days here. Election days are bank holidays too but are announced separately and are not in this list.',
  },
  'GB-EW': {
    id: 'GB-EW',
    name: 'United Kingdom (England and Wales)',
    weekend: [0, 6],
    source: { authority: 'GOV.UK — UK bank holidays', url: 'https://www.gov.uk/bank-holidays', retrieved: RETRIEVED },
    note: 'England and Wales only: Scotland and Northern Ireland have their own bank holidays. A fixed day at a weekend moves to a substitute weekday.',
  },
  TARGET: {
    id: 'TARGET',
    name: 'Euro area (TARGET)',
    weekend: [0, 6],
    source: { authority: 'European Central Bank — TARGET closing days', url: 'https://www.ecb.europa.eu/press/pr/date/2000/html/pr001214_4.en.html', retrieved: RETRIEVED },
    note: 'The days the TARGET system itself is closed; each euro-area country also has national bank holidays that are not in this list.',
  },
};

export const BANK_CALENDAR_IDS = Object.keys(BANK_CALENDARS) as BankCalendarId[];

// ---------- civil-date helpers (pure integer maths, the same Hinnant algorithms as utils.ts) ----------

function dayNumber(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe;
}

function fromDayNumber(days: number): string {
  const era = Math.floor(days / 146097);
  const doe = days - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const parseIso = (iso: string) => (iso || '').slice(0, 10).split('-').map(Number) as [number, number, number];
const isoDayNumber = (iso: string) => { const [y, m, d] = parseIso(iso); return dayNumber(y, m, d); };
/** 0 = Sunday … 6 = Saturday (day number 719468 is 1970-01-01, a Thursday). */
const weekdayFromDayNumber = (n: number) => (((n - 719468 + 4) % 7) + 7) % 7;
const weekdayOf = (iso: string) => weekdayFromDayNumber(isoDayNumber(iso));
const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** The n-th weekday (1-based; negative counts from the month's end) of a month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = dayNumber(year, month, 1);
    const shift = (weekday - weekdayFromDayNumber(first) + 7) % 7;
    return fromDayNumber(first + shift + (n - 1) * 7);
  }
  const last = dayNumber(year, month, 1) + daysInMonthFor(year, month) - 1;
  const shift = (weekdayFromDayNumber(last) - weekday + 7) % 7;
  return fromDayNumber(last - shift + (n + 1) * 7);
}

function daysInMonthFor(year: number, month: number): number {
  return [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Easter Sunday (Gregorian computus) as YYYY-MM-DD. */
function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}
const plusDays = (date: string, days: number) => fromDayNumber(isoDayNumber(date) + days);

// ---------- the four calendars ----------

function usHolidays(year: number): BankHoliday[] {
  const out: BankHoliday[] = [];
  const fixed = (month: number, day: number, name: string) => {
    const date = iso(year, month, day);
    const weekday = weekdayOf(date);
    if (weekday === 0) out.push({ date: plusDays(date, 1), name, kind: 'closed', note: `Observed on Monday: ${name} falls on Sunday this year` });
    else if (weekday === 6) out.push({ date, name, kind: 'note', note: 'Falls on Saturday: Federal Reserve Banks are open the preceding Friday; the Board of Governors is closed' });
    else out.push({ date, name, kind: 'closed' });
  };
  fixed(1, 1, "New Year's Day");
  fixed(6, 19, 'Juneteenth National Independence Day');
  fixed(7, 4, 'Independence Day');
  fixed(11, 11, 'Veterans Day');
  fixed(12, 25, 'Christmas Day');
  out.push(
    { date: nthWeekday(year, 1, 1, 3), name: 'Birthday of Martin Luther King Jr.', kind: 'closed' },
    { date: nthWeekday(year, 2, 1, 3), name: "Washington's Birthday (Presidents Day)", kind: 'closed' },
    { date: nthWeekday(year, 5, 1, -1), name: 'Memorial Day', kind: 'closed' },
    { date: nthWeekday(year, 9, 1, 1), name: 'Labor Day', kind: 'closed' },
    { date: nthWeekday(year, 10, 1, 2), name: 'Columbus Day', kind: 'closed' },
    { date: nthWeekday(year, 11, 4, 4), name: 'Thanksgiving Day', kind: 'closed' },
  );
  return out.sort(byDate);
}

function ukHolidays(year: number): BankHoliday[] {
  const out: BankHoliday[] = [];
  const taken = new Set<string>();
  const fixed = (month: number, day: number, name: string) => {
    let date = iso(year, month, day);
    const weekday = weekdayOf(date);
    if (weekday === 6 || weekday === 0) {
      do { date = plusDays(date, 1); } while (weekdayOf(date) === 6 || weekdayOf(date) === 0 || taken.has(date));
      out.push({ date, name, kind: 'closed', note: `Substitute day: ${name} falls at the weekend this year` });
    } else out.push({ date, name, kind: 'closed' });
    taken.add(date);
  };
  fixed(1, 1, "New Year's Day");
  fixed(12, 25, 'Christmas Day');
  fixed(12, 26, 'Boxing Day');
  const easter = easterSunday(year);
  out.push(
    { date: plusDays(easter, -2), name: 'Good Friday', kind: 'closed' },
    { date: plusDays(easter, 1), name: 'Easter Monday', kind: 'closed' },
    { date: nthWeekday(year, 5, 1, 1), name: 'Early May bank holiday', kind: 'closed' },
    { date: nthWeekday(year, 5, 1, -1), name: 'Spring bank holiday', kind: 'closed' },
    { date: nthWeekday(year, 8, 1, -1), name: 'Summer bank holiday', kind: 'closed' },
  );
  return out.sort(byDate);
}

function targetHolidays(year: number): BankHoliday[] {
  const easter = easterSunday(year);
  return [
    { date: iso(year, 1, 1), name: "New Year's Day", kind: 'closed' as const },
    { date: plusDays(easter, -2), name: 'Good Friday', kind: 'closed' as const },
    { date: plusDays(easter, 1), name: 'Easter Monday', kind: 'closed' as const },
    { date: iso(year, 5, 1), name: 'Labour Day', kind: 'closed' as const },
    { date: iso(year, 12, 25), name: 'Christmas Day', kind: 'closed' as const },
    { date: iso(year, 12, 26), name: 'Boxing Day', kind: 'closed' as const },
  ].sort(byDate);
}

const hebrewParts = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long' });

/** Every day of one Gregorian year with its Hebrew month and day, read at midday UTC. */
function hebrewDays(year: number): Array<{ date: string; month: string; day: number }> {
  const out: Array<{ date: string; month: string; day: number }> = [];
  for (let n = dayNumber(year, 1, 1); n <= dayNumber(year, 12, 31); n += 1) {
    const date = fromDayNumber(n);
    const parts = hebrewParts.formatToParts(new Date(`${date}T12:00:00Z`));
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = Number(parts.find(p => p.type === 'day')?.value || 0);
    out.push({ date, month, day });
  }
  return out;
}

function israelHolidays(year: number): BankHoliday[] {
  const out: BankHoliday[] = [];
  const days = hebrewDays(year);
  const find = (month: string, day: number) => days.find(d => d.month === month && d.day === day)?.date;
  const closed = (month: string, day: number, name: string, nameHe: string, note?: string) => {
    const date = find(month, day);
    if (date) out.push({ date, name, nameHe, kind: 'closed', ...(note ? { note } : {}) });
  };
  const shortDay = (month: string, day: number, name: string, nameHe: string) => {
    const date = find(month, day);
    if (date) out.push({ date, name, nameHe, kind: 'short-day', note: 'Short banking day: the Bank of Israel works until 13:15' });
  };

  closed('Tishri', 1, 'Rosh Hashanah (New Year) 1st day', 'א׳ ראש השנה');
  closed('Tishri', 2, 'Rosh Hashanah (New Year) 2nd day', 'ב׳ ראש השנה');
  closed('Tishri', 10, 'Yom Kippur (Day of Atonement)', 'יום כיפור');
  closed('Tishri', 15, 'Sukkot (Tabernacles)', 'סוכות');
  closed('Tishri', 22, 'Shemini Atzeret and Simchat Torah', 'שמיני עצרת ושמחת תורה');
  closed('Nisan', 15, 'Passover (Pesach) 1st day', 'א׳ פסח');
  closed('Nisan', 21, 'Passover (Pesach) last day', 'שביעי של פסח');
  closed('Sivan', 6, 'Shavuot (Pentecost)', 'שבועות');
  closed('Av', 9, 'Fast of Tisha B\'Av (Ninth of Av)', 'תשעה באב', 'A chosen holiday for many employers; the Bank of Israel lists it among its bank holidays');

  // Purim is in Adar, or in the second Adar of a leap year; Jerusalem keeps the day after
  const purimMonth = days.some(d => d.month === 'Adar II') ? 'Adar II' : 'Adar';
  closed(purimMonth, 14, 'Purim (Tel Aviv)', 'פורים');
  closed(purimMonth, 15, 'Shushan Purim (Jerusalem)', 'שושן פורים');

  // Independence Day is 5 Iyar, observed early on Thursday when it falls on Friday or Saturday,
  // and put off to Tuesday when it falls on Monday
  const iyar5 = find('Iyar', 5);
  if (iyar5) {
    const weekday = weekdayOf(iyar5);
    const observed = weekday === 5 ? plusDays(iyar5, -1)
      : weekday === 6 ? plusDays(iyar5, -2)
      : weekday === 1 ? plusDays(iyar5, 1)
      : iyar5;
    out.push({
      date: observed, name: 'Israel Independence Day', nameHe: 'יום העצמאות', kind: 'closed',
      ...(observed !== iyar5 ? { note: `Observed on this day: 5 Iyar falls on a ${weekday === 1 ? 'Monday' : weekday === 5 ? 'Friday' : 'Saturday'} this year` } : {}),
    });
  }

  // festival eves and intermediate days are short banking days, not closures
  shortDay('Elul', 29, 'Eve of Rosh Hashanah', 'ערב ראש השנה');
  shortDay('Tishri', 9, 'Eve of Yom Kippur', 'ערב יום כיפור');
  shortDay('Tishri', 14, 'Eve of Sukkot', 'ערב סוכות');
  for (const d of [16, 17, 18, 19, 20]) shortDay('Tishri', d, 'Intermediate days of Sukkot (Chol HaMoed)', 'חול המועד סוכות');
  shortDay('Tishri', 21, 'Hoshana Rabbah (eve of Shemini Atzeret)', 'הושענא רבה');
  shortDay('Nisan', 14, 'Eve of Passover', 'ערב פסח');
  for (const d of [16, 17, 18, 19, 20]) shortDay('Nisan', d, 'Intermediate days of Passover (Chol HaMoed)', 'חול המועד פסח');
  shortDay('Sivan', 5, 'Eve of Shavuot', 'ערב שבועות');

  return out.sort(byDate);
}

const byDate = (a: BankHoliday, b: BankHoliday) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name);

// ---------- the public reading ----------

const cache = new Map<string, BankHoliday[]>();

/** One calendar year's bank holidays, generated from the authority's rules (2000–2100). */
export function bankHolidays(calendar: BankCalendarId, year: number): BankHoliday[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return [];
  const key = `${calendar}:${year}`;
  const found = cache.get(key);
  if (found) return found;
  const list = calendar === 'US' ? usHolidays(year)
    : calendar === 'IL' ? israelHolidays(year)
    : calendar === 'GB-EW' ? ukHolidays(year)
    : targetHolidays(year);
  cache.set(key, list);
  return list;
}

const closedDates = new Map<string, Set<string>>();
function closedSet(calendar: BankCalendarId, year: number): Set<string> {
  const key = `${calendar}:${year}`;
  const found = closedDates.get(key);
  if (found) return found;
  const set = new Set(bankHolidays(calendar, year).filter(h => h.kind === 'closed').map(h => h.date));
  closedDates.set(key, set);
  return set;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Is this a day the calendar's banks work? (Weekend and closures are not; short days are.) */
export function isBankWorkingDay(calendar: BankCalendarId, date: string): boolean {
  const day = (date || '').slice(0, 10);
  if (!ISO_DAY.test(day)) return false;
  if (BANK_CALENDARS[calendar].weekend.includes(weekdayOf(day))) return false;
  return !closedSet(calendar, Number(day.slice(0, 4))).has(day);
}

/** The first bank working day on or after the date given. */
export function nextBankWorkingDay(calendar: BankCalendarId, date: string): string {
  let day = (date || '').slice(0, 10);
  if (!ISO_DAY.test(day)) return day;
  for (let step = 0; step < 40 && !isBankWorkingDay(calendar, day); step += 1) day = plusDays(day, 1);
  return day;
}

/**
 * A due date under the "following" convention: kept as it is when banks work that day, otherwise
 * moved forward to the next day they do. Returns the input unchanged when it is not a date.
 */
export function moveDueDate(calendar: BankCalendarId, dueDate: string): string {
  return nextBankWorkingDay(calendar, dueDate);
}

/** The date `count` bank working days after the given date (negative counts back). */
export function addBankWorkingDays(calendar: BankCalendarId, date: string, count: number): string {
  let day = (date || '').slice(0, 10);
  if (!ISO_DAY.test(day) || !Number.isFinite(count)) return day;
  const step = count >= 0 ? 1 : -1;
  let left = Math.abs(Math.trunc(count));
  while (left > 0) {
    day = plusDays(day, step);
    if (isBankWorkingDay(calendar, day)) left -= 1;
  }
  return day;
}

export const BANK_HOLIDAYS_CSV_HEADERS = ['Calendar', 'Date', 'Holiday', 'Holiday (Hebrew)', 'Banks', 'Note'] as const;

export function bankHolidaysCsvRows(calendar: BankCalendarId, rows: readonly BankHoliday[]): string[][] {
  const name = BANK_CALENDARS[calendar].name;
  return rows.map(row => [name, row.date, row.name, row.nameHe || '',
    row.kind === 'closed' ? 'Closed' : row.kind === 'short-day' ? 'Short day' : 'Open (see note)', row.note || '']);
}
