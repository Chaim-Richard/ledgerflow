import type { Firestore } from '../db/firestore';
import { computeBalanceSheet, computeProfitAndLoss } from '../reports/computeReports';
import { AGING_BUCKETS, computePartyAging } from '../../lib/aging';
import { addToDateISO, formatCurrency, formatTzDate } from '../../lib/utils';
import {
  agingTable, balanceSheetTable, lastFinishedPeriod, profitAndLossTable, reportCsv, reportEmailHtml,
  scheduleProblem, SCHEDULED_REPORTS, type ReportPeriod, type ReportTable, type ScheduledReport,
} from '../../lib/scheduledReports';
import type { ChartAccount, Customer, Invoice, Transaction } from '../../types';
import { isMailConfigured, sendMail } from './mailer';
import { logger } from '../utils/logger';

/**
 * Scheduled reports (K-28): the daily job emails each schedule's last finished week or month once;
 * "Send now" sends it straight away. The period is recorded before sending (as monthly statements
 * do), so a crash halfway never sends the same period twice; a failed send is logged.
 */
export class ScheduledReportError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function workspaceRows<T>(db: Firestore, collection: string, workspaceId: string, before?: string): Promise<T[]> {
  let q = db.collection(collection).where('workspaceId', '==', workspaceId);
  if (before) q = q.where('date', '<', before);
  return (await q.get()).docs.map(d => ({ ...(d.data() as T), id: d.id }));
}

export async function buildReport(db: Firestore, workspaceId: string, schedule: Pick<ScheduledReport, 'report'>, period: ReportPeriod): Promise<ReportTable> {
  const dayAfter = addToDateISO(period.endDate, { days: 1 });
  if (schedule.report === 'receivables-aging') {
    const [customers, invoices] = await Promise.all([
      workspaceRows<Customer>(db, 'customers', workspaceId),
      workspaceRows<Invoice>(db, 'invoices', workspaceId, dayAfter),
    ]);
    return agingTable(computePartyAging(customers, invoices, 'customer', period.endDate), [...AGING_BUCKETS], period);
  }
  const [accounts, entries] = await Promise.all([
    workspaceRows<ChartAccount>(db, 'chartAccounts', workspaceId),
    workspaceRows<Transaction>(db, 'transactions', workspaceId, dayAfter),
  ]);
  if (schedule.report === 'profit-and-loss') return profitAndLossTable(computeProfitAndLoss(accounts, entries, period.startDate, period.endDate), period);
  return balanceSheetTable(computeBalanceSheet(accounts, entries, period.endDate), accounts, period);
}

export async function sendReport(db: Firestore, workspace: { id: string; name?: string; currency?: string }, schedule: ScheduledReport, period: ReportPeriod): Promise<{ sent: number; failed: string[] }> {
  const table = await buildReport(db, workspace.id, schedule, period);
  const currency = workspace.currency || 'USD';
  const html = reportEmailHtml(table, { workspaceName: workspace.name || 'Your books', currency, format: cents => formatCurrency(cents, currency) });
  const attachment = { filename: `${schedule.report}-${period.endDate}.csv`, content: Buffer.from(`\uFEFF${reportCsv(table)}`, 'utf8'), contentType: 'text/csv' };
  let sent = 0;
  const failed: string[] = [];
  for (const to of schedule.recipients) {
    try {
      await sendMail({ to, subject: `${table.title} · ${workspace.name || 'LedgerFlow'}`, html, attachments: [attachment] });
      sent++;
    } catch (err) {
      failed.push(to);
      logger.warn('scheduled report not sent', { workspaceId: workspace.id, scheduleId: schedule.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { sent, failed };
}

const today = (ws: Record<string, unknown>, now: Date) => formatTzDate(now, typeof ws.timezone === 'string' ? ws.timezone : 'UTC');

/** "Send now" (owners and accountants): the last finished period, without changing what the schedule has sent. */
export async function sendScheduleNow(db: Firestore, input: { workspaceId: string; scheduleId: string; now?: Date }) {
  if (!isMailConfigured()) throw new ScheduledReportError(503, 'Email sending is not set up yet, so nothing can be sent');
  const snap = await db.collection('workspaces').doc(input.workspaceId).get();
  const ws = snap.data() as (Record<string, unknown> & { scheduledReports?: ScheduledReport[] }) | undefined;
  const schedule = ws?.scheduledReports?.find(s => s.id === input.scheduleId);
  if (!ws || !schedule) throw new ScheduledReportError(404, 'That schedule is not in this workspace');
  const problem = scheduleProblem(schedule);
  if (problem) throw new ScheduledReportError(400, problem);
  const period = lastFinishedPeriod(schedule.frequency, today(ws, input.now || new Date()));
  return { period, ...(await sendReport(db, { id: input.workspaceId, name: ws.name as string, currency: ws.currency as string }, schedule, period)) };
}

/** The daily run: every schedule whose last finished period has not been sent yet. */
export async function runScheduledReports(db: Firestore, now = new Date()) {
  let reports = 0;
  let emails = 0;
  if (!isMailConfigured()) return { reports, emails };
  const workspaces = await db.collection('workspaces').get();
  for (const wsDoc of workspaces.docs) {
    const ws = wsDoc.data() as Record<string, unknown> & { scheduledReports?: ScheduledReport[]; scheduledReportsSent?: Record<string, string> };
    const schedules = Array.isArray(ws.scheduledReports) ? ws.scheduledReports : [];
    for (const schedule of schedules) {
      if (!schedule?.id || scheduleProblem(schedule)) continue;
      const period = lastFinishedPeriod(schedule.frequency, today(ws, now));
      if (ws.scheduledReportsSent?.[schedule.id] === period.key) continue;
      await wsDoc.ref.update({ [`scheduledReportsSent.${schedule.id}`]: period.key });
      try {
        const result = await sendReport(db, { id: wsDoc.id, name: ws.name as string, currency: ws.currency as string }, schedule, period);
        reports++;
        emails += result.sent;
      } catch (err) {
        logger.warn('scheduled report failed', { workspaceId: wsDoc.id, scheduleId: schedule.id, report: SCHEDULED_REPORTS[schedule.report], error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return { reports, emails };
}

export async function runDailyScheduledReports() {
  const { getDb } = await import('../db/firestore');
  return runScheduledReports(getDb());
}
