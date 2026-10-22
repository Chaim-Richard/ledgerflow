/**
 * Whether this process runs the background jobs on its own timer (AUD-05). Kept apart from the
 * scheduler so the status page and Settings → Schedule can ask without importing every job.
 * On Vercel it stays false and CRON_SECRET is what lets the cron in.
 */
let standaloneRunning = false;

export const markStandaloneScheduler = (running: boolean): void => { standaloneRunning = running; };
export const isStandaloneSchedulerRunning = (): boolean => standaloneRunning;

/** the daily jobs are set to run here: Vercel Cron has its secret, or this server keeps the timer */
export const isJobScheduleConfigured = (env: NodeJS.ProcessEnv = process.env): boolean =>
  Boolean(env.CRON_SECRET) || standaloneRunning;
