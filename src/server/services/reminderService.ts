/**
 * Daily payment reminders (BE-01, K-26): for every workspace that turned them on (Settings →
 * Emails & Reminders), each open overdue invoice gets the next reminder it is due for, by the
 * workspace's own date. Customers marked "no automatic reminders" are skipped. The email itself,
 * the send log and the per-invoice counters are documentEmailService.emailInvoice's job.
 */
import type { Firestore } from '../db/firestore';
import { emailInvoice } from './documentEmailService';
import { isMailConfigured } from './mailer';
import { logger } from '../utils/logger';
import { getTrustedAppUrl } from '../utils/urlHelper';
import { normalizeReminderSettings, remindersDue } from '../../lib/reminders';
import type { ReminderInvoice } from '../../lib/reminders';
import { formatTzDate } from '../../lib/utils';

export async function runReminders(db: Firestore, now = new Date(), baseUrl?: string): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  if (!isMailConfigured()) return { sent, failed };
  const url = baseUrl || getTrustedAppUrl();
  const workspaces = await db.collection('workspaces').where('reminderSettings.enabled', '==', true).get();
  for (const wsDoc of workspaces.docs) {
    const workspace = wsDoc.data();
    const settings = normalizeReminderSettings(workspace.reminderSettings);
    if (!settings.enabled) continue;
    const today = formatTzDate(now, typeof workspace.timezone === 'string' ? workspace.timezone : 'UTC');
    const invoices = (await db.collection('invoices').where('workspaceId', '==', wsDoc.id).where('dueDate', '<', today).get())
      .docs.map(d => ({ ...d.data(), id: d.id }) as ReminderInvoice);
    const quiet = new Set((await db.collection('customers').where('workspaceId', '==', wsDoc.id).where('noReminders', '==', true).get()).docs.map(d => d.id));
    for (const due of remindersDue(invoices, settings, today, quiet)) {
      try {
        await emailInvoice(db, { workspaceId: wsDoc.id, invoiceId: due.invoiceId, uid: 'system', system: true, template: 'reminder', baseUrl: url });
        sent++;
      } catch (err) {
        failed++;
        logger.warn('payment reminder not sent', { workspaceId: wsDoc.id, invoiceId: due.invoiceId, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return { sent, failed };
}

export async function runDailyReminders() {
  const { getDb } = await import('../db/firestore');
  return runReminders(getDb());
}
