import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { AccountMergeError, mergeAccounts, previewAccountMerge } from '../services/accountMergeService';

/**
 * Merging two accounts (CA-33), mounted at /api/v1/workspaces/:workspaceId/chart-accounts
 * (workspaceRoutes.ts, owners and accountants; checked again in accountMergeService).
 * POST /merge/preview says what would change; POST /merge does it.
 */
export const accountMergeRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const schema = z.object({ fromId: z.string().min(1).max(200), intoId: z.string().min(1).max(200) }).strict();

const handle = (work: typeof mergeAccounts) => async (req: express.Request, res: express.Response) => {
  const { user } = req as unknown as AuthedRequest;
  try {
    const body = schema.parse(req.body);
    const result = await work(getDb(), { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email, ...body });
    res.json({ status: 'success', ...result });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Choose the account to merge and the one to keep' });
    if (err instanceof AccountMergeError) return res.status(err.status).json({ status: 'error', message: err.message, ...(err.details ? { details: err.details } : {}) });
    res.status(500).json({ status: 'error', message: 'The accounts could not be merged', details: err instanceof Error ? err.message : String(err) });
  }
};

accountMergeRouter.post('/merge/preview', handle(previewAccountMerge));
accountMergeRouter.post('/merge', handle(mergeAccounts));
