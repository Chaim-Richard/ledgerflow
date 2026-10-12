/**
 * A-28 / PLAN US-1: when each state's sales-tax return is usually due — one row per state (50 + DC),
 * the frequencies the state commonly assigns, the day of the following month the return is due, and
 * a link to the state's revenue department (the same source the A-22 rate table cites).
 *
 * What this is: a **planning** table. What it is not: your schedule — the state assigns the filing
 * frequency from your liability (and tells you on the account or the return), and a due date that
 * falls on a weekend or a holiday moves; `filingDueDate` moves a weekend only, so the holiday must
 * still be checked on the state's own calendar before anything is relied on. Nothing here files,
 * posts or pays anything. Rates and schedules are the taxpayer's; this table never concludes one.
 */
import { US_STATE_SALES_TAX } from './usStateSalesTax';

export type FilingFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

/** The day of the month after the period that the return is commonly due, or 'none' (no state tax). */
export type FilingDueDay = 15 | 20 | 23 | 25 | 30 | 'last-day' | 'none';

export interface UsFilingCalendarRow {
  state: string;
  stateName: string;
  /** the frequencies the state commonly assigns, most common first */
  frequencies: FilingFrequency[];
  dueDay: FilingDueDay;
  validFrom: string;
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-11';
const SOURCE_BY_STATE = new Map(US_STATE_SALES_TAX.map(row => [row.state, { name: row.stateName, source: row.source }]));
const row = (state: string, frequencies: FilingFrequency[], dueDay: FilingDueDay, note?: string): UsFilingCalendarRow => {
  const base = SOURCE_BY_STATE.get(state);
  return { state, stateName: base?.name || state, frequencies, dueDay, validFrom: '2026-01-01', source: base?.source || '', checked: CHECKED, ...(note ? { note } : {}) };
};

/**
 * The rows, A→W. The common pattern for each state is the one its own return or filing page uses;
 * where the state assigns the schedule from liability, `note` says so. Five states have no state
 * sales tax at all ('none').
 */
export const US_FILING_CALENDAR: UsFilingCalendarRow[] = [
  row('AL', ['monthly', 'quarterly', 'annual'], 20, 'monthly above $1,000 of tax a year; the state may move a low-liability account to quarterly or annual'),
  row('AK', [], 'none', 'no state sales tax or state return; boroughs and cities set their own filings'),
  row('AZ', ['monthly'], 20, 'electronic filers may have a different deadline in the same month'),
  row('AR', ['monthly', 'quarterly', 'annual'], 20, 'the frequency is reassigned each year from the previous year’s tax'),
  row('CA', ['monthly', 'quarterly', 'annual'], 'last-day', 'most accounts file quarterly; larger sellers monthly; small sellers annual, due 31 January'),
  row('CO', ['monthly'], 20, 'home-rule cities file separately and set their own dates'),
  row('CT', ['monthly', 'quarterly', 'annual'], 'last-day', 'the state assigns the frequency from the tax collected'),
  row('DC', ['monthly', 'quarterly', 'annual'], 20, 'a low-liability account may be moved off monthly'),
  row('DE', [], 'none', 'no state sales tax; a gross receipts tax applies to sellers on its own schedule'),
  row('FL', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns; larger businesses file monthly, the smallest annual'),
  row('GA', ['monthly'], 20, 'the state assigns the frequency'),
  row('HI', ['monthly', 'quarterly', 'annual'], 20, 'general excise tax; the state assigns the frequency and large filers file electronically'),
  row('ID', ['monthly', 'quarterly', 'annual'], 20, 'a lower frequency needs the state’s approval'),
  row('IL', ['monthly', 'quarterly', 'annual'], 20, 'quarterly or annual for lower liability'),
  row('IN', ['monthly'], 20, 'larger accounts file by the 20th; lower-liability accounts by the 30th'),
  row('IA', ['monthly', 'annual'], 'last-day', 'the state assigns; monthly filers pay by the last day of the following month'),
  row('KS', ['monthly', 'quarterly', 'annual'], 25, 'the state assigns the frequency'),
  row('KY', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('LA', ['monthly', 'quarterly'], 20, 'quarterly allowed at low averages'),
  row('ME', ['monthly', 'quarterly', 'semiannual'], 15, 'one of the earliest deadlines; the frequency follows sales'),
  row('MD', ['monthly', 'quarterly'], 20, 'the frequency may change with activity'),
  row('MA', ['monthly', 'quarterly', 'annual'], 30, 'the frequency follows the annual tax liability'),
  row('MI', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('MN', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('MS', ['monthly'], 20, 'the state assigns the frequency'),
  row('MO', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns monthly, quarterly or annual from liability; confirm on the return'),
  row('MT', [], 'none', 'no state sales tax; resort-area local taxes file locally'),
  row('NE', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('NV', ['monthly', 'quarterly', 'annual'], 'last-day', 'the state assigns; the return is due the last day of the following month'),
  row('NH', [], 'none', 'no state sales tax; meals and rentals taxes run on their own returns'),
  row('NJ', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('NM', ['monthly'], 25, 'gross receipts tax; the 25th of the following month'),
  row('NY', ['quarterly', 'monthly', 'annual'], 20, 'quarterly is the common case and the quarters are not the calendar ones; the state assigns'),
  row('NC', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('ND', ['monthly', 'quarterly', 'annual'], 'last-day', 'the state assigns; the return is due the last day of the following month'),
  row('OH', ['monthly', 'quarterly', 'annual'], 23, 'the state assigns; the 23rd of the following month'),
  row('OK', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('OR', [], 'none', 'no state sales tax'),
  row('PA', ['monthly', 'quarterly', 'semiannual'], 20, 'assigned each November from July–September tax: $600+ monthly, $75–599.99 quarterly, under $75 semiannual'),
  row('RI', ['monthly', 'quarterly', 'annual'], 20, 'a quarterly option exists'),
  row('SC', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('SD', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('TN', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('TX', ['quarterly', 'monthly', 'annual'], 20, 'quarterly is common; monthly above $500,000 of tax a year; annual for the smallest'),
  row('UT', ['monthly', 'quarterly', 'annual'], 'last-day', 'the state assigns; the return is due the last day of the following month'),
  row('VT', ['monthly', 'quarterly', 'annual'], 25, 'the 25th of the following month'),
  row('VA', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('WA', ['monthly', 'quarterly', 'annual'], 25, 'the state assigns; the 25th of the following month'),
  row('WV', ['monthly', 'quarterly', 'annual'], 20, 'the state assigns the frequency'),
  row('WI', ['monthly', 'quarterly', 'annual'], 'last-day', 'the state assigns; early monthly filers are due by the 20th'),
  row('WY', ['monthly', 'quarterly', 'annual'], 'last-day', 'the state assigns; the return is due the last day of the following month'),
];

export const US_FILING_CALENDAR_STATES = US_FILING_CALENDAR.map(r => r.state);
export const NO_STATE_FILING: string[] = US_FILING_CALENDAR.filter(r => r.dueDay === 'none').map(r => r.state);

export function filingCalendarRow(state: string): UsFilingCalendarRow | undefined {
  return US_FILING_CALENDAR.find(r => r.state === state.trim().toUpperCase());
}

/** True when the state has no state-level sales-tax return (AK DE MT NH OR). */
export function hasNoStateFiling(state: string): boolean {
  return filingCalendarRow(state)?.dueDay === 'none';
}

const DAY_MS = 86_400_000;
/** The date's weekday: 0 = Sunday … 6 = Saturday (1 January 1970 was a Thursday). */
const weekdayOf = (iso: string) => (Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS) + 4) % 7;
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const monthLength = (year: number, month: number) => [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

/**
 * The return date for a period (a month or a quarter) that ends on `periodEnd`: the state's day in
 * the **following** month ('last-day' = the last day of it), moved to the next Monday when it lands
 * on a weekend. Holidays are not known here — the state's own calendar still governs. Undefined for
 * a state with no state return or an unknown state.
 */
export function filingDueDate(state: string, periodEnd: string): string | undefined {
  const row = filingCalendarRow(state);
  if (!row || row.dueDay === 'none') return undefined;
  const end = String(periodEnd).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return undefined;
  const year = Number(end.slice(0, 4));
  const month = Number(end.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const lastDay = monthLength(nextYear, nextMonth);
  const day = row.dueDay === 'last-day' ? lastDay : Math.min(row.dueDay, lastDay);
  const due = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (weekdayOf(due) === 6) return addDays(due, 2); // Saturday
  if (weekdayOf(due) === 0) return addDays(due, 1); // Sunday
  return due;
}

/** The rows a guard runs over: one per jurisdiction, a real day, a source and the tax states all present. */
export function filingCalendarProblems(rows: UsFilingCalendarRow[] = US_FILING_CALENDAR): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.state)) problems.push(`Two rows for ${row.state}.`);
    seen.add(row.state);
    if (!/^https:\/\//.test(row.source)) problems.push(`${row.state} has no https source.`);
    if (row.dueDay === 'none' && row.frequencies.length) problems.push(`${row.state} pays no state tax but lists frequencies.`);
    if (row.dueDay !== 'none' && !row.frequencies.length) problems.push(`${row.state} lists no frequency.`);
  }
  const taxStates = US_STATE_SALES_TAX.length;
  if (rows.length !== taxStates) problems.push(`Expected ${taxStates} rows (the rate table's states and DC), found ${rows.length}.`);
  return problems;
}
