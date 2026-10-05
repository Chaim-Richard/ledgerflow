/**
 * Prepaid expenses spread over months (K-17): a year of insurance paid in September is not all
 * September's cost. Spreading a bill moves the amount from the expense to a Prepaid asset on the
 * bill's date, then back to the expense at the end of each month, one share a month: whole cents,
 * the remainder in the last month, so the shares always add up to the amount. Shared by the server
 * (src/server/services/prepaidService.ts) and the screen.
 */
import { resolveAccountRole } from './accountUtils';
import type { ChartAccount } from '../types';

export const MAX_SPREAD_MONTHS = 60;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 'YYYY-MM' plus n months (integer maths, no time zones). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The last day of a 'YYYY-MM' month. */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return `${month}-${String(days).padStart(2, '0')}`;
}

/** `totalCents` in `parts` whole-cent shares; the last one takes the remainder. */
export function splitEvenly(totalCents: number, parts: number): number[] {
  const share = Math.floor(totalCents / parts);
  return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? totalCents - share * (parts - 1) : share));
}

export interface SpreadInput {
  /** The bill's date: the amount moves to Prepaid on this day. */
  date: string;
  amountCents: number;
  months: number;
  /** The first month that carries a share ('YYYY-MM'); not before the bill's month. */
  startMonth: string;
}

/** Why the spread can't be made, or null when it can. */
export function spreadProblem(input: SpreadInput, maxCents?: number): string | null {
  if (!DAY.test(input.date)) return 'The bill has no valid date';
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'Enter the amount to spread';
  if (maxCents !== undefined && input.amountCents > maxCents) return 'That is more than the bill';
  if (!Number.isInteger(input.months) || input.months < 2 || input.months > MAX_SPREAD_MONTHS) return `Spread over 2 to ${MAX_SPREAD_MONTHS} months`;
  if (!MONTH.test(input.startMonth)) return 'Choose the first month';
  if (input.startMonth < input.date.slice(0, 7)) return 'The first month cannot be before the bill';
  return null;
}

/** The month-end dates and shares of a spread. */
export function spreadPlan(input: SpreadInput): Array<{ date: string; amountCents: number; installment: number }> {
  return splitEvenly(input.amountCents, input.months).map((amountCents, i) => ({ date: monthEnd(addMonths(input.startMonth, i)), amountCents, installment: i + 1 }));
}

/** The Prepaid Expenses asset (Settings → Defaults, else an asset account named "prepaid"), or undefined. */
export function prepaidAccount(accounts: ChartAccount[], mappings?: Record<string, string | undefined>): ChartAccount | undefined {
  const usable = accounts.filter(a => !a.isArchived && a.isActive !== false);
  return usable.find(a => a.id === mappings?.['prepaid expenses'] && resolveAccountRole(a) === 'asset')
    || usable.find(a => resolveAccountRole(a) === 'asset' && /prepaid|prepayment/i.test(a.name || '') && !/vendor/i.test(a.name || ''));
}

interface BillLines {
  amountCents?: number;
  exchangeRate?: number;
  items?: Array<{ accountId?: string; amountCents?: number }>;
  splits?: Array<{ accountId?: string; amountCents?: number }>;
}

/** The bill's biggest expense line in the home currency (what is usually spread), or undefined. */
export function billExpenseLine(bill: BillLines, accounts: ChartAccount[]): { accountId: string; baseCents: number } | undefined {
  const rate = typeof bill.exchangeRate === 'number' && bill.exchangeRate > 0 ? bill.exchangeRate : 1;
  const isExpense = new Set(accounts.filter(a => resolveAccountRole(a) === 'expense').map(a => a.id));
  const byAccount = new Map<string, number>();
  for (const line of [...(bill.items || []), ...(bill.splits || [])]) {
    if (line.accountId && isExpense.has(line.accountId)) byAccount.set(line.accountId, (byAccount.get(line.accountId) || 0) + (Number(line.amountCents) || 0));
  }
  const [best] = [...byAccount.entries()].sort((a, b) => b[1] - a[1]);
  return best ? { accountId: best[0], baseCents: Math.min(Math.round(best[1] * rate), Math.round((Number(bill.amountCents) || 0) * rate)) } : undefined;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Spread over 12 months from Sep 2026 · 2 of 12 taken", as of `today`. */
export function spreadProgress(schedule: { months: number; startMonth: string }, today: string): string {
  const [y, m] = schedule.startMonth.split('-').map(Number);
  const name = `${MONTH_NAMES[m - 1]} ${y}`;
  const taken = Array.from({ length: schedule.months }, (_, i) => monthEnd(addMonths(schedule.startMonth, i))).filter(d => d <= today).length;
  return `Spread over ${schedule.months} months from ${name} · ${taken} of ${schedule.months} taken`;
}
