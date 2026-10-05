/**
 * Automatic payment reminders (BE-01 reminder schedule, K-26 dunning). A workspace chooses the
 * days after the due date on which a reminder goes out (e.g. 3, 14 and 30 days); the daily job
 * (src/server/services/reminderService.ts) emails each open invoice the next reminder it is due
 * for, at most one per invoice per day. Customers (or single invoices) can be excluded.
 */
import { calculateAmountDue } from './documentMath';
import { dayNumber } from './fiscalCalendar';

export interface ReminderSettings {
  enabled: boolean;
  /** Days after the due date, one reminder each (sorted, 1–365, at most 6). */
  daysAfterDue: number[];
  /** BE-02: email the customer the "Payment received (thank you)" template when a payment is recorded. */
  thankYou?: boolean;
  /** Y-28: each month (first daily run, normally the 1st) email every customer with something open their statement. */
  monthlyStatements?: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, daysAfterDue: [3, 14, 30] };

export function normalizeReminderSettings(input: Partial<ReminderSettings> | null | undefined): ReminderSettings {
  const days = Array.isArray(input?.daysAfterDue) ? input.daysAfterDue : DEFAULT_REMINDER_SETTINGS.daysAfterDue;
  const clean = [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 1 && d <= 365))].sort((a, b) => a - b).slice(0, 6);
  return { enabled: Boolean(input?.enabled), daysAfterDue: clean.length ? clean : DEFAULT_REMINDER_SETTINGS.daysAfterDue, thankYou: Boolean(input?.thankYou), monthlyStatements: Boolean(input?.monthlyStatements) };
}

/**
 * Monthly statements (Y-28): the month ("YYYY-MM") to send for on `today` (the workspace's date),
 * or null when this month's were already sent. The first daily run of a month sends them, so a
 * missed 1st is made up the next day.
 */
export function statementMonthDue(today: string, lastSentMonth?: string | null): string | null {
  const month = today.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) && month !== lastSentMonth ? month : null;
}

const OPEN = new Set(['sent', 'pending', 'approved', 'partially_paid', 'overdue']);

export interface ReminderInvoice {
  id: string;
  status?: string;
  dueDate?: string;
  amountCents?: number;
  amountPaidCents?: number;
  customerId?: string;
  /** read by the daily job to name the invoice it tells the team about (Y-27); no amounts are changed */
  number?: string;
  customerName?: string;
  currency?: string;
  metadata?: { remindersSent?: number; lastReminderAt?: string; noReminders?: boolean } & Record<string, unknown>;
}

export interface ReminderDue {
  invoiceId: string;
  /** Which reminder this is (1 = the first). */
  step: number;
  daysOverdue: number;
}

export function remindersDue(
  invoices: ReminderInvoice[],
  settings: ReminderSettings,
  today: string,
  excludedCustomers: Set<string> = new Set(),
): ReminderDue[] {
  if (!settings.enabled) return [];
  const out: ReminderDue[] = [];
  for (const inv of invoices) {
    if (!OPEN.has(String(inv.status)) || !inv.dueDate || !/^\d{4}-\d{2}-\d{2}/.test(inv.dueDate)) continue;
    if (inv.metadata?.noReminders || (inv.customerId && excludedCustomers.has(inv.customerId))) continue;
    if (calculateAmountDue(inv) <= 0) continue;
    const daysOverdue = dayNumber(today) - dayNumber(inv.dueDate.slice(0, 10));
    const sent = Number(inv.metadata?.remindersSent) || 0;
    if (sent >= settings.daysAfterDue.length || daysOverdue < settings.daysAfterDue[sent]) continue;
    if (typeof inv.metadata?.lastReminderAt === 'string' && inv.metadata.lastReminderAt.slice(0, 10) === today) continue;
    out.push({ invoiceId: inv.id, step: sent + 1, daysOverdue });
  }
  return out;
}

/**
 * The reminders the daily job may email, and the ones it must not because the customer asked for
 * paper (Y-27): `paperCustomers` holds those customer ids. A reminder with no customer on it (a
 * one-off invoice typed without choosing one) stays with the emails, as it was before anyone could
 * choose. Nothing here looks at amounts: the invoice keeps its counters either way.
 */
export function separatePaperReminders<T extends { customerId?: string }>(
  due: T[],
  paperCustomers: Set<string>,
): { email: T[]; paper: T[] } {
  const email: T[] = [];
  const paper: T[] = [];
  for (const item of due) (item.customerId && paperCustomers.has(item.customerId) ? paper : email).push(item);
  return { email, paper };
}
