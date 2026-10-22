import { runDailyMaintenance } from '../services/maintenanceService';
import { processAllRecurring } from '../services/recurringService';
import { processErrorDigest } from '../services/errorDigestService';
import { runNotificationJobs } from '../services/notificationService';
import { runDailyReminders, runDailyStatements } from '../services/reminderService';
import { recordDailyJobRun } from '../services/statusService';
import { runDailyRetention } from '../services/retentionService';
import { runDailyScheduledReports } from '../services/scheduledReportService';
import { runDailyLedgerHealth } from '../services/ledgerHealthService';
import { runDailyBookAlerts } from '../services/bookAlertService';
import { runDailyAssetReminders } from '../services/assetReminderService';
import { runDailyWatches } from '../services/watchService';
import { runDailyNotificationDigest } from '../services/notificationEmailService';
import { getDb, type Firestore } from '../db/firestore';

/**
 * Every background job, once (AUD-05). This is the only list: the Vercel cron route
 * (routes/cronRoutes.ts, called by vercel.json's "crons") and the standalone scheduler
 * (jobs/standaloneScheduler.ts, started by `npm start` / `npm run dev`) both read it, so the two
 * deployments run the same jobs on the same schedule. `src/tests/aud05-job-registry.test.ts` checks
 * vercel.json against CRON_SCHEDULES and that no job is started from anywhere else.
 *
 * The jobs must tolerate being run twice for the same day (a retried cron, a second replica): each
 * one keeps its own "already done for this date" record. The standalone scheduler also claims each
 * run in the database first, so replicas do not run it side by side.
 */

/** One scheduled call: a cron path Vercel requests, and the same time for the standalone timer. */
export interface CronSchedule {
  id: string;
  /** what vercel.json calls; cronRoutes.ts serves it under /api/cron */
  path: string;
  /** five-field cron, UTC; only "M H * * *" (once a day) is supported by the standalone timer */
  schedule: string;
}

export const CRON_SCHEDULES: readonly CronSchedule[] = [
  { id: 'daily', path: '/api/cron/daily', schedule: '10 6 * * *' },
];

export interface BackgroundJob {
  /** the id the run records and the Settings → Schedule screen (src/lib/jobSchedule.ts) describes */
  id: string;
  /** the CronSchedule id that runs it */
  cron: string;
  run: () => Promise<unknown>;
  /**
   * Also run once when a standalone server starts, and why. Vercel has no start-up, so this is the
   * one deliberate difference between the two; it is an extra pass, never instead of the daily one.
   */
  standaloneBootReason?: string;
}

/** in the order they run */
export const BACKGROUND_JOBS: readonly BackgroundJob[] = [
  { id: 'maintenance', cron: 'daily', run: runDailyMaintenance },
  {
    id: 'recurring', cron: 'daily', run: processAllRecurring,
    standaloneBootReason: 'drafts that fell due while the server was stopped are made at once instead of the next morning; a schedule makes one draft per date, so the extra pass cannot duplicate',
  },
  { id: 'errorDigest', cron: 'daily', run: processErrorDigest },
  { id: 'notifications', cron: 'daily', run: runNotificationJobs },
  { id: 'reminders', cron: 'daily', run: runDailyReminders },
  { id: 'statements', cron: 'daily', run: runDailyStatements },
  { id: 'scheduledReports', cron: 'daily', run: runDailyScheduledReports },
  { id: 'ledgerHealth', cron: 'daily', run: runDailyLedgerHealth },
  { id: 'bookAlerts', cron: 'daily', run: runDailyBookAlerts },
  { id: 'assetReminders', cron: 'daily', run: runDailyAssetReminders },
  { id: 'watches', cron: 'daily', run: runDailyWatches },
  { id: 'notificationDigest', cron: 'daily', run: runDailyNotificationDigest },
  { id: 'retention', cron: 'daily', run: runDailyRetention },
];

export const jobsFor = (cronId: string): BackgroundJob[] => BACKGROUND_JOBS.filter(j => j.cron === cronId);

export interface CronRunResult {
  failed: boolean;
  /** 'ok', or 'failed: why', per job id */
  results: Record<string, string>;
}

/**
 * Runs one schedule's jobs in order; a job that throws is recorded and the next one still runs.
 * The daily run leaves its record (jobRuns/daily_latest) for the status page and Settings → Schedule.
 */
export async function runCron(cronId: string, options: { db?: Firestore; jobs?: readonly BackgroundJob[] } = {}): Promise<CronRunResult> {
  const startedAt = new Date().toISOString();
  const results: Record<string, string> = {};
  for (const job of options.jobs || jobsFor(cronId)) {
    try {
      await job.run();
      results[job.id] = 'ok';
    } catch (err) {
      console.error(`[Cron] ${job.id} failed:`, err);
      results[job.id] = `failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  const failed = Object.values(results).some(r => r !== 'ok');
  if (cronId === 'daily') {
    // for the status page (L-17)
    await recordDailyJobRun(options.db || getDb(), startedAt, results).catch(err => console.error('[Cron] could not record the run:', err));
  }
  return { failed, results };
}
