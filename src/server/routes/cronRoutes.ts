import express from 'express';
import crypto from 'crypto';
import { CRON_SCHEDULES, runCron } from '../jobs/jobRegistry';

/**
 * Scheduled jobs for Vercel Cron (see vercel.json). Vercel calls them with
 * "Authorization: Bearer <CRON_SECRET>"; without that secret they refuse to run.
 * Which jobs run, and when, is jobs/jobRegistry.ts — the standalone server's timer reads the same list.
 */
export const cronRouter = express.Router();

/** where the router is mounted (server.ts); the registry's paths are full paths */
export const CRON_MOUNT = '/api/cron';

function isCronRequest(req: express.Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.authorization || '');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

for (const cron of CRON_SCHEDULES) {
  if (!cron.path.startsWith(`${CRON_MOUNT}/`)) throw new Error(`cron ${cron.id}: ${cron.path} is not under ${CRON_MOUNT}`);
  cronRouter.get(cron.path.slice(CRON_MOUNT.length), async (req, res) => {
    if (!isCronRequest(req)) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    const { failed, results } = await runCron(cron.id);
    res.status(failed ? 500 : 200).json({ status: failed ? 'error' : 'ok', results });
  });
}
