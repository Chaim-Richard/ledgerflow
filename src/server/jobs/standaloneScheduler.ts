import { BACKGROUND_JOBS, CRON_SCHEDULES, runCron, type CronSchedule } from './jobRegistry';
import { markStandaloneScheduler } from './schedulerState';
import { getDb, FirestoreError } from '../db/firestore';
import { addDaysYMD } from '../../lib/fiscalCalendar';

/**
 * The standalone server's timer (AUD-05): `npm start` / `npm run dev` runs every CRON_SCHEDULES entry
 * at the time vercel.json gives it, through the same runCron() the Vercel route calls. Nothing here
 * chooses jobs; jobs/jobRegistry.ts does.
 *
 * Several replicas may run the timer. Each due run is claimed first with a document only one of them
 * can create (jobRuns/claim_<id>_<due time>); the others skip it. LF_STANDALONE_JOBS=off turns the
 * timer off, for a server whose jobs are run by an outside cron calling /api/cron/* instead.
 */

const ALREADY_EXISTS = 6;

/** the next time a "M H * * *" schedule (UTC) is due, strictly after `now` */
export function nextRunAfter(schedule: string, now: Date): Date {
  const fields = schedule.trim().split(/\s+/);
  const [minute, hour] = fields.map(Number);
  const daily = fields.length === 5 && fields.slice(2).every(f => f === '*')
    && Number.isInteger(minute) && minute >= 0 && minute < 60 && Number.isInteger(hour) && hour >= 0 && hour < 24;
  if (!daily) throw new Error(`only daily "M H * * *" schedules can run on the standalone timer, not "${schedule}"`);
  const at = (day: string) => new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  const today = now.toISOString().slice(0, 10);
  const due = at(today);
  return due.getTime() > now.getTime() ? due : at(addDaysYMD(today, 1));
}

/** true when this replica may run the schedule due at `dueAt` */
export async function claimRun(cronId: string, dueAt: Date): Promise<boolean> {
  try {
    await getDb().collection('jobRuns').doc(`claim_${cronId}_${dueAt.toISOString()}`).create({ cron: cronId, dueAt: dueAt.toISOString(), claimedAt: new Date().toISOString() });
    return true;
  } catch (err) {
    if (err instanceof FirestoreError && err.code === ALREADY_EXISTS) return false;
    throw err;
  }
}

export interface SchedulerDeps {
  now: () => Date;
  setTimer: (fn: () => void, ms: number) => void;
  claim: (cronId: string, dueAt: Date) => Promise<boolean>;
  run: (cronId: string) => Promise<unknown>;
  /** the start-up pass of the jobs that ask for one (BackgroundJob.standaloneBootReason) */
  runAtBoot: (jobId: string, run: () => Promise<unknown>) => Promise<unknown>;
}

const defaultDeps: SchedulerDeps = {
  now: () => new Date(),
  setTimer: (fn, ms) => { setTimeout(fn, ms).unref(); },
  claim: claimRun,
  run: cronId => runCron(cronId),
  runAtBoot: (_jobId, run) => run(),
};

export interface ScheduledCron extends CronSchedule {
  nextRunAt: string;
}

/**
 * Arms one timer per CRON_SCHEDULES entry; each, when it fires, claims and runs that schedule and
 * arms itself for the next day. Returns what was scheduled, for the start-up log and the test.
 */
export function startStandaloneScheduler(overrides: Partial<SchedulerDeps> = {}, env: NodeJS.ProcessEnv = process.env): ScheduledCron[] {
  if (env.LF_STANDALONE_JOBS === 'off') {
    console.warn('[Jobs] LF_STANDALONE_JOBS=off: this server does not run the daily jobs; call /api/cron/* with CRON_SECRET from an outside cron.');
    markStandaloneScheduler(false);
    return [];
  }
  const deps = { ...defaultDeps, ...overrides };

  const arm = (cron: CronSchedule): ScheduledCron => {
    const dueAt = nextRunAfter(cron.schedule, deps.now());
    deps.setTimer(() => {
      void (async () => {
        try {
          if (await deps.claim(cron.id, dueAt)) await deps.run(cron.id);
          else console.debug(`[Jobs] ${cron.id} for ${dueAt.toISOString()} was taken by another server`);
        } catch (err) {
          console.error(`[Jobs] ${cron.id} could not run:`, err);
        } finally {
          arm(cron);
        }
      })();
    }, Math.max(0, dueAt.getTime() - deps.now().getTime()));
    return { ...cron, nextRunAt: dueAt.toISOString() };
  };

  const scheduled = CRON_SCHEDULES.map(arm);
  markStandaloneScheduler(true);
  for (const job of BACKGROUND_JOBS) {
    if (!job.standaloneBootReason) continue;
    deps.runAtBoot(job.id, job.run).catch(err => console.error(`[Jobs] start-up pass of ${job.id} failed:`, err));
  }
  return scheduled;
}
