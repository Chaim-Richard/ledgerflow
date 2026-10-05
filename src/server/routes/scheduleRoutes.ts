import express from 'express';
import type { Firestore } from '../db/firestore';
import { getDb } from '../db/firestore';
import { describeSchedule, type DailyJobRunRecord, type ScheduleView } from '../../lib/jobSchedule';

/**
 * Settings → Schedule (BB-06): the daily run's own record, read for the screen — which jobs it covers,
 * when it last ran, whether anything in it went wrong, and when it is next due.
 *
 * Read-only, on purpose. When the jobs run belongs to the installation (`vercel.json`'s cron, and the
 * secret that lets it in), not to a workspace, so a control here would promise something the app cannot
 * do. Nothing but the run's own timings is answered: no workspace figures, no counts, no secrets — the
 * same facts are already on the public status page, less the times.
 */
export const scheduleRouter = express.Router();

/** the row the daily run writes for itself */
const DAILY_RUN_ID = 'daily_latest';

/** The screen's whole answer, from the row the last run left. */
export async function readSchedule(db: Firestore = getDb(), now = new Date(), cronConfigured = Boolean(process.env.CRON_SECRET)): Promise<ScheduleView> {
  const run = (await db.collection('jobRuns').doc(DAILY_RUN_ID).get()).data() as DailyJobRunRecord | undefined;
  return describeSchedule({ run: run || null, cronConfigured, now });
}

scheduleRouter.get('/', async (_req, res) => {
  try {
    res.json({ status: 'ok', schedule: await readSchedule() });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'The schedule could not be read. The jobs may still have run — the record of them is what is missing.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});
