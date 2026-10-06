import type { Firestore } from '../db/firestore';
import { isMailConfigured } from './mailer';

/**
 * System status (L-17): what the public status page shows. Checks only what the server can
 * see itself: the database answers, the daily job ran recently and without failures, and which
 * outside services are set up. No workspace data, counts or secrets.
 */

export type ComponentState = 'operational' | 'degraded' | 'down' | 'not_configured';

export interface StatusComponent {
  id: string;
  name: string;
  state: ComponentState;
  detail: string;
}

export interface SystemStatus {
  state: 'operational' | 'degraded' | 'down';
  checkedAt: string;
  components: StatusComponent[];
}

/** The record of the last daily job run (jobRuns/daily_latest). */
export interface DailyJobRun {
  job: 'daily';
  startedAt: string;
  finishedAt: string;
  status: 'ok' | 'failed';
  failedJobs: string[];
  /**
   * What each job answered — 'ok', or 'failed: why' (Settings → Schedule, BB-06, reads it to name the
   * job that went wrong instead of only saying that something did). Rows written before it existed have
   * no field, and the schedule screen says so rather than calling an unreported run a clean one.
   */
  results?: Record<string, string>;
}

const DAILY_RUN_ID = 'daily_latest';
/** The daily job runs once a day; later than this counts as late. */
const DAILY_LATE_HOURS = 36;

export async function recordDailyJobRun(db: Firestore, startedAt: string, results: Record<string, string>, now = new Date()): Promise<void> {
  const failedJobs = Object.entries(results).filter(([, r]) => r !== 'ok').map(([name]) => name);
  const run: DailyJobRun = { job: 'daily', startedAt, finishedAt: now.toISOString(), status: failedJobs.length ? 'failed' : 'ok', failedJobs, results: { ...results } };
  await db.collection('jobRuns').doc(DAILY_RUN_ID).set(run);
}

function dailyJobComponent(run: Partial<DailyJobRun> | undefined, cronConfigured: boolean, now: Date): StatusComponent {
  const base = { id: 'jobs', name: 'Scheduled jobs (recurring invoices, reminders, clean-up)' };
  if (!cronConfigured) return { ...base, state: 'not_configured', detail: 'The daily job is not set up (CRON_SECRET).' };
  if (!run?.finishedAt) return { ...base, state: 'operational', detail: 'No run recorded yet; the first one runs at 06:10 UTC.' };
  const hours = (now.getTime() - Date.parse(run.finishedAt)) / 3_600_000;
  if (hours > DAILY_LATE_HOURS) return { ...base, state: 'degraded', detail: `Last ran ${Math.floor(hours)} hours ago.` };
  if (run.status === 'failed') return { ...base, state: 'degraded', detail: `Last run had problems: ${(run.failedJobs || []).join(', ') || 'unknown'}.` };
  return { ...base, state: 'operational', detail: `Last ran ${Math.max(0, Math.floor(hours))} hours ago.` };
}

function configured(id: string, name: string, isSet: boolean, what: string): StatusComponent {
  return isSet
    ? { id, name, state: 'operational', detail: 'Set up.' }
    : { id, name, state: 'not_configured', detail: `${what} is not set up on this installation.` };
}

export async function checkSystemStatus(db: Firestore, env: NodeJS.ProcessEnv = process.env, now = new Date()): Promise<SystemStatus> {
  const components: StatusComponent[] = [{ id: 'api', name: 'App and server', state: 'operational', detail: 'Answering.' }];

  let run: Partial<DailyJobRun> | undefined;
  const started = Date.now();
  try {
    run = (await db.collection('jobRuns').doc(DAILY_RUN_ID).get()).data() as Partial<DailyJobRun> | undefined;
    const ms = Date.now() - started;
    components.push({ id: 'database', name: 'Database', state: ms > 2000 ? 'degraded' : 'operational', detail: ms > 2000 ? `Slow (${ms} ms).` : 'Answering.' });
    components.push(dailyJobComponent(run, Boolean(env.CRON_SECRET), now));
  } catch {
    components.push({ id: 'database', name: 'Database', state: 'down', detail: 'Not answering.' });
  }

  components.push(
    configured('signin', 'Sign-in', Boolean(env.SUPABASE_URL), 'Sign-in'),
    configured('email', 'Email (invoices, reminders)', isMailConfigured(), 'Sending email'),
    configured('payments', 'Card payments of invoices', Boolean(env.STRIPE_SECRET_KEY), 'Card payment'),
    configured('banks', 'Bank feeds', Boolean(env.PLAID_CLIENT_ID && env.PLAID_SECRET), 'Bank feeds'),
  );

  const states = components.map(c => c.state);
  const state = states.includes('down') ? 'down' : states.includes('degraded') ? 'degraded' : 'operational';
  return { state, checkedAt: now.toISOString(), components };
}
