/**
 * A-220: dates and amounts shown the way the reader's locale writes them.
 *
 * The workspace already chooses how money looks (`moneyDisplay`, C-25). A date on a report header
 * had no such choice: it printed `2026-10-01 to 2026-10-31`, which is a storage format, not
 * something a reader in New York, London or Tel Aviv expects. This module turns the two dates a
 * report is about into that locale's own date, and hands amounts to the same `moneyText` the
 * screens already use, so a header and its totals agree.
 *
 * Display only: nothing here reads or changes a posted figure, and the ISO date stays what is
 * saved, filtered and exported to CSV (that file is data, not a page).
 */
import { moneyText, type MoneyDisplaySettings } from './moneyFormat';

export const REPORT_LOCALES = ['en-US', 'en-GB', 'he-IL'] as const;
export type ReportLocale = (typeof REPORT_LOCALES)[number];

/** Names a reader recognises in the picker (the workspace setting keeps the saved value). */
export const REPORT_LOCALE_LABELS: Record<ReportLocale, string> = {
  'en-US': 'United States (Oct 1, 2026)',
  'en-GB': 'United Kingdom (1 Oct 2026)',
  'he-IL': 'Israel (1 באוק׳ 2026)',
};

export interface ReportLocaleInput {
  /** The saved money format (`Workspace.moneyDisplay.locale`); it decides dates too. */
  moneyDisplayLocale?: string;
  /** The interface language — Hebrew reads dates in Hebrew when no format was chosen. */
  language?: string;
}

function canonical(locale: string | undefined): string | null {
  if (!locale || locale.length > 64) return null;
  try {
    return Intl.getCanonicalLocales(locale)[0] || null;
  } catch {
    return null;
  }
}

/**
 * Which locale a report header and its totals read in: the workspace's saved money format first
 * (so a books set to `de-DE` prints `1. Okt. 2026` too), then the interface language, then en-US.
 */
export function resolveReportLocale(input: ReportLocaleInput = {}): string {
  const saved = canonical(input.moneyDisplayLocale);
  if (saved === 'he' || saved === 'he-IL') return 'he-IL';
  if (saved) return saved;
  return input.language === 'he' ? 'he-IL' : 'en-US';
}

const MONTH_DAY_YEAR: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/**
 * `2026-10-01` → `Oct 1, 2026` (en-US), `1 Oct 2026` (en-GB), `1 באוק׳ 2026` (he-IL).
 * A stored date is a calendar date, not an instant: it is read in the reader's own day, so no
 * timezone can move a report's first day to the previous month. Anything unreadable comes back
 * unchanged (better a visible odd value than a silently empty header).
 */
export function reportDateText(isoDate: string | undefined | null, locale: string = 'en-US'): string {
  if (!isoDate) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate).trim());
  if (!match) return String(isoDate);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return String(isoDate);
  const resolved = canonical(locale) || 'en-US';
  try {
    return new Intl.DateTimeFormat(resolved, MONTH_DAY_YEAR).format(date);
  } catch {
    return String(isoDate);
  }
}

/**
 * The period a report covers, in the reader's locale: `Oct 1, 2026 – Oct 31, 2026`. A single day
 * is written once instead of twice, and a backwards range is still shown as typed (the report
 * itself explains the problem) — this function never guesses a period.
 */
export function reportPeriodText(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  locale: string = 'en-US',
): string {
  const start = reportDateText(startDate, locale);
  const end = reportDateText(endDate, locale);
  if (!start && !end) return '';
  if (!start) return `until ${end}`;
  if (!end) return `from ${start}`;
  if (String(startDate) === String(endDate)) return start;
  return `${start} – ${end}`;
}

/**
 * An amount on a report header or total, in the same format as the rows under it. `digits` is the
 * currency's own minor-unit precision (the caller supplies it, exactly as `moneyText` requires).
 */
export function reportAmountText(
  cents: number | null | undefined,
  currency: string,
  digits: number,
  settings: MoneyDisplaySettings & { locale?: string } = {},
): string {
  return moneyText(cents, currency, digits, settings);
}

/** A report header line: the report's name, then its period in the reader's locale. */
export function reportHeadingText(title: string, startDate: string, endDate: string, locale: string): string {
  const period = reportPeriodText(startDate, endDate, locale);
  return period ? `${title} · ${period}` : title;
}
