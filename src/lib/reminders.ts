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
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, daysAfterDue: [3, 14, 30] };

export function normalizeReminderSettings(input: Partial<ReminderSettings> | null | undefined): ReminderSettings {
  const days = Array.isArray(input?.daysAfterDue) ? input.daysAfterDue : DEFAULT_REMINDER_SETTINGS.daysAfterDue;
  const clean = [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 1 && d <= 365))].sort((a, b) => a - b).slice(0, 6);
  return { enabled: Boolean(input?.enabled), daysAfterDue: clean.length ? clean : DEFAULT_REMINDER_SETTINGS.daysAfterDue };
}

const OPEN = new Set(['sent', 'pending', 'approved', 'partially_paid', 'overdue']);

export interface ReminderInvoice {
  id: string;
  status?: string;
  dueDate?: string;
  amountCents?: number;
  amountPaidCents?: number;
  customerId?: string;
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
