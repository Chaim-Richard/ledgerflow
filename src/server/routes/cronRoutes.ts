import express from 'express';
import crypto from 'crypto';
import { runDailyMaintenance } from '../services/maintenanceService';
import { processAllRecurring } from '../services/recurringService';
import { processErrorDigest } from '../services/errorDigestService';
import { runNotificationJobs } from '../services/notificationService';
import { runDailyReminders } from '../services/reminderService';

/**
 * Scheduled jobs for Vercel Cron (see vercel.json). Vercel calls them with
 * "Authorization: Bearer <CRON_SECRET>"; without that secret they refuse to run.
 */
export const cronRouter = express.Router();

function isCronRequest(req: express.Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.authorization || '');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const DAILY_JOBS: [string, () => Promise<unknown>][] = [
  ['maintenance', runDailyMaintenance],
  ['recurring', processAllRecurring],
  ['errorDigest', () => processErrorDigest()],
  ['notifications', runNotificationJobs],
  ['reminders', runDailyReminders],
];

cronRouter.get('/daily', async (req, res) => {
  if (!isCronRequest(req)) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
  const results: Record<string, string> = {};
  for (const [name, job] of DAILY_JOBS) {
    try {
      await job();
      results[name] = 'ok';
    } catch (err) {
      console.error(`[Cron] ${name} failed:`, err);
      results[name] = `failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  const failed = Object.values(results).some(r => r !== 'ok');
  res.status(failed ? 500 : 200).json({ status: failed ? 'error' : 'ok', results });
});
