/**
 * EG-1 step 1: the repost run (docs/design/EG-1-repost-engine.md, src/server/services/repostService.ts).
 * POST /api/v1/repost  { workspaceId, runId?, kinds?, keys?, dryRun?, strictLock? } (or ?dryRun=1): owners and
 *   accountants; posts the corrections (or, in a dry run, only answers them). 409 when strictLock refused a key.
 * GET /api/v1/repost/queue?workspaceId=: what is waiting, for any member (the banner).
 */
import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { errorMessage, requestUser } from '../auth/requestUser';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { requireWorkspaceRole } from './workspaceRoutes';
import { RepostError, repostQueueOf, runRepost } from '../services/repostService';

export const repostRouter = express.Router();

const RunSchema = z.object({
  workspaceId: z.string().min(1),
  runId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, 'runId: 8–80 letters, digits, - or _').optional(),
  kinds: z.array(z.string().min(1)).max(10).optional(),
  keys: z.array(z.string().min(1)).max(500).optional(),
  dryRun: z.boolean().optional(),
  strictLock: z.boolean().optional(),
});

repostRouter.post('/', requireWorkspaceRole(['owner', 'accountant']), async (req, res) => {
  try {
    const parsed = RunSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the fields', details: parsed.error.issues });
    const body = parsed.data;
    const user = requestUser(req);
    const dryRun = body.dryRun === true || req.query.dryRun === '1' || req.query.dryRun === 'true';
    const result = await runRepost(getDb(), {
      workspaceId: body.workspaceId, user: { uid: user.uid, email: user.email, admin: user.admin },
      runId: body.runId || `run-${crypto.randomBytes(8).toString('hex')}`, dryRun, strictLock: body.strictLock, keys: body.keys, kinds: body.kinds,
    });
    const refusedWhy = result.keys.filter(k => k.reason).map(k => k.reason).join(' ');
    const error = [result.blocked > 0 ? 'A correction would land in a locked period and strictLock is set: nothing was posted for those items.' : '', refusedWhy].filter(Boolean).join(' ');
    res.status(error ? 409 : 200).json({ status: result.blocked > 0 ? 'blocked' : result.refused > 0 ? 'refused' : 'ok', ...result, ...(error ? { error } : {}) });
  } catch (e) {
    if (e instanceof RepostError) return res.status(e.status).json({ error: e.message });
    res.status(/Unauthorized|not a member/i.test(errorMessage(e)) ? 403 : 400).json({ error: errorMessage(e) });
  }
});

repostRouter.get('/queue', async (req, res) => {
  try {
    const workspaceId = String(req.query.workspaceId || '');
    if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });
    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, requestUser(req));
    res.json({ status: 'ok', rows: await repostQueueOf(db, workspaceId) });
  } catch (e) {
    res.status(/Unauthorized|not a member|FORBIDDEN/i.test(errorMessage(e)) ? 403 : 400).json({ error: errorMessage(e) });
  }
});
