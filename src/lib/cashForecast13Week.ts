/**
 * A-186: a 13-week cash forecast from the documents already in the workspace.
 *
 * Read-only and deliberately simple, because a forecast is an assumption and must look like one:
 * every open invoice is expected on its own due date, every open bill on its own due date, and a
 * recurring rule on its next occurrences. No payment history, no seasonality and no new business
 * are modelled, nothing is converted from another currency (a document in another currency is
 * counted in `skippedOtherCurrency` instead of a guessed rate) and nothing is posted.
 */
import { addDaysYMD, addMonthsYMD, dayNumber } from './fiscalCalendar';
import { resolveAccountRole } from './accountUtils';
import type { ChartAccount, RecurringTransaction } from '../types';

export type ForecastDirection = 'inflow' | 'outflow';

export interface ForecastDocument {
  id: string;
  /** What the reader sees on the line: a document number or a party name. */
  label: string;
  /** The date the money is expected: due date when there is one, otherwise the document date. */
  expectedDate?: string;
  /** Gross amount of the document, whole cents, absolute. */
  amountCents: number;
  /** Already-paid part of the document, whole cents. */
  paidCents?: number;
  currency?: string;
  status?: string;
}

export interface ForecastRecurringRule {
  id: string;
  label: string;
  amountCents: number;
  frequency: string;
  nextOccurrence?: string;
  isActive?: boolean;
  status?: string;
  /**
   * Which way the money moves, resolved by the caller from the rule's own lines and accounts.
   * 'unknown' rules are reported and left out of the weekly sums.
   */
  direction?: ForecastDirection | 'unknown';
}

export interface CashForecastInput {
  asOf: string;
  homeCurrency: string;
  openingCashCents?: number;
  weeks?: number;
  invoices: readonly ForecastDocument[];
  bills: readonly ForecastDocument[];
  recurring: readonly ForecastRecurringRule[];
}

export interface CashForecastLine {
  kind: 'invoice' | 'bill' | 'recurring';
  id: string;
  label: string;
  date: string;
  cents: number;
  /** The date was already past on the assessment day and is shown in the first week. */
  overdue: boolean;
}

export interface CashForecastWeek {
  index: number;
  startDate: string;
  endDate: string;
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  /** Opening cash plus every net up to and including this week. */
  closingCents: number;
  lines: CashForecastLine[];
}

export interface CashForecastReport {
  weeks: CashForecastWeek[];
  homeCurrency: string;
  openingCashCents: number;
  totalInflowCents: number;
  totalOutflowCents: number;
  /** Past-due money that the forecast places in the first week. */
  overdueInflowCents: number;
  overdueOutflowCents: number;
  /** Documents in another currency: counted, never converted. */
  skippedOtherCurrency: number;
  /** Documents dated after the last week of the forecast. */
  beyondHorizonCents: { inflowCents: number; outflowCents: number; documents: number };
  /** Documents with no readable date; nothing can be dated for them. */
  undated: number;
  /** Recurring rules whose direction could not be resolved from their own lines. */
  unclassifiedRecurring: number;
  /** Recurring rules that are paused, completed or inactive. */
  inactiveRecurring: number;
}

export const DEFAULT_FORECAST_WEEKS = 13;
export const MAX_FORECAST_WEEKS = 26;

/**
 * Which way a recurring rule moves money, read from its own lines' accounts through the shared role
 * resolver. A rule whose accounts do not resolve to revenue, an expense or COGS stays 'unknown' and
 * is reported instead of being guessed.
 */
export function recurringDirection(rule: Pick<RecurringTransaction, 'template'>, accountsById: Map<string, ChartAccount>): ForecastDirection | 'unknown' {
  let inflow = 0;
  let outflow = 0;
  for (const line of rule.template?.lines || []) {
    const role = resolveAccountRole(accountsById.get(line.accountId));
    if (role === 'revenue') inflow += Math.abs(line.amountCents || 0);
    else if (role === 'expense' || role === 'cogs') outflow += Math.abs(line.amountCents || 0);
  }
  if (inflow > 0 && inflow >= outflow) return 'inflow';
  if (outflow > 0) return 'outflow';
  return 'unknown';
}

const EXCLUDED_STATUSES = new Set(['draft', 'void', 'cancelled', 'canceled', 'rejected']);

/** A real calendar day, not just the shape of one: 2026-02-31 is refused, not shifted into March. */
export function isForecastDay(ymd: unknown): ymd is string {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  try {
    return new Date(`${ymd}T00:00:00Z`).toISOString().slice(0, 10) === ymd;
  } catch {
    return false;
  }
}
const isReadableDate = isForecastDay;

function isCounted(document: ForecastDocument, homeCurrency: string): boolean {
  const currency = (document.currency || homeCurrency).toUpperCase();
  return currency === homeCurrency.toUpperCase();
}

/** Whole cents still open on a document (gross less what is already recorded as paid). */
export function openCents(document: ForecastDocument): number {
  if (!Number.isSafeInteger(document.amountCents)) return 0;
  const paid = Number.isSafeInteger(document.paidCents) ? Math.max(0, document.paidCents || 0) : 0;
  return Math.max(0, document.amountCents - paid);
}

function occurrences(rule: ForecastRecurringRule, from: string, until: string): string[] {
  const dates: string[] = [];
  if (!isReadableDate(rule.nextOccurrence) || !Number.isSafeInteger(rule.amountCents) || rule.amountCents <= 0) return dates;
  let current = rule.nextOccurrence;
  const step = (value: string) => {
    switch (rule.frequency) {
      case 'daily': return addDaysYMD(value, 1);
      case 'weekly': return addDaysYMD(value, 7);
      case 'monthly': return addMonthsYMD(value, 1);
      case 'quarterly': return addMonthsYMD(value, 3);
      case 'yearly': return addMonthsYMD(value, 12);
      default: return null;
    }
  };
  // An unknown frequency is not expanded: the report says so through `unclassifiedRecurring`.
  if (!step(current)) return dates;
  while (current <= until && dates.length < 400) {
    if (current >= from) dates.push(current);
    const next = step(current);
    if (!next || next <= current) break;
    current = next;
  }
  return dates;
}

export function cashForecast13Week(input: CashForecastInput): CashForecastReport {
  const weeks = Math.min(Math.max(Math.trunc(input.weeks ?? DEFAULT_FORECAST_WEEKS) || DEFAULT_FORECAST_WEEKS, 1), MAX_FORECAST_WEEKS);
  if (!isReadableDate(input.asOf)) throw new Error('Choose a real assessment day.');
  const homeCurrency = (input.homeCurrency || 'USD').toUpperCase();
  const openingCashCents = Number.isSafeInteger(input.openingCashCents) ? input.openingCashCents! : 0;
  const horizonEnd = addDaysYMD(input.asOf, weeks * 7 - 1);

  const buckets: CashForecastWeek[] = Array.from({ length: weeks }, (_, index) => {
    const startDate = addDaysYMD(input.asOf, index * 7);
    return { index: index + 1, startDate, endDate: addDaysYMD(startDate, 6), inflowCents: 0, outflowCents: 0, netCents: 0, closingCents: 0, lines: [] };
  });

  let skippedOtherCurrency = 0;
  let undated = 0;
  let overdueInflowCents = 0;
  let overdueOutflowCents = 0;
  const beyondHorizon: CashForecastReport['beyondHorizonCents'] = { inflowCents: 0, outflowCents: 0, documents: 0 };

  const place = (kind: CashForecastLine['kind'], document: ForecastDocument, direction: ForecastDirection) => {
    if (EXCLUDED_STATUSES.has((document.status || '').toLowerCase())) return;
    const cents = openCents(document);
    if (cents <= 0) return;
    if (!isCounted(document, homeCurrency)) { skippedOtherCurrency++; return; }
    const date = document.expectedDate;
    if (!isReadableDate(date)) { undated++; return; }
    if (date > horizonEnd) {
      beyondHorizon.documents++;
      if (direction === 'inflow') beyondHorizon.inflowCents += cents; else beyondHorizon.outflowCents += cents;
      return;
    }
    const overdue = date < input.asOf;
    const weekIndex = Math.min(weeks - 1, Math.max(0, Math.floor((dayNumber(date) - dayNumber(input.asOf)) / 7)));
    const week = buckets[overdue ? 0 : weekIndex];
    week.lines.push({ kind, id: document.id, label: document.label, date, cents, overdue });
    if (direction === 'inflow') {
      week.inflowCents += cents;
      if (overdue) overdueInflowCents += cents;
    } else {
      week.outflowCents += cents;
      if (overdue) overdueOutflowCents += cents;
    }
  };

  for (const invoice of input.invoices) place('invoice', invoice, 'inflow');
  for (const bill of input.bills) place('bill', bill, 'outflow');

  let unclassifiedRecurring = 0;
  let inactiveRecurring = 0;
  for (const rule of input.recurring) {
    if (rule.isActive === false || rule.status === 'paused' || rule.status === 'completed') { inactiveRecurring++; continue; }
    if (rule.direction !== 'inflow' && rule.direction !== 'outflow') { unclassifiedRecurring++; continue; }
    for (const date of occurrences(rule, input.asOf, horizonEnd)) {
      place('recurring', { id: `${rule.id}@${date}`, label: rule.label, expectedDate: date, amountCents: rule.amountCents, currency: homeCurrency }, rule.direction);
    }
  }

  let running = openingCashCents;
  for (const week of buckets) {
    week.netCents = week.inflowCents - week.outflowCents;
    running += week.netCents;
    week.closingCents = running;
    week.lines.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  }

  return {
    weeks: buckets,
    homeCurrency,
    openingCashCents,
    totalInflowCents: buckets.reduce((sum, week) => sum + week.inflowCents, 0),
    totalOutflowCents: buckets.reduce((sum, week) => sum + week.outflowCents, 0),
    overdueInflowCents,
    overdueOutflowCents,
    skippedOtherCurrency,
    beyondHorizonCents: beyondHorizon,
    undated,
    unclassifiedRecurring,
    inactiveRecurring,
  };
}

export const CASH_FORECAST_CSV_HEADERS = ['Week', 'Week start', 'Week end', 'Expected in', 'Expected out', 'Net', 'Projected balance'];

export function cashForecastCsvRows(report: CashForecastReport): Array<Array<string>> {
  return report.weeks.map(week => [
    String(week.index), week.startDate, week.endDate,
    (week.inflowCents / 100).toFixed(2), (week.outflowCents / 100).toFixed(2),
    (week.netCents / 100).toFixed(2), (week.closingCents / 100).toFixed(2),
  ]);
}
