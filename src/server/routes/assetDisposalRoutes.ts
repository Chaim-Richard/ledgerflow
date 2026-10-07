import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { disposeAsset, DisposalError, undoDisposal } from '../services/assetDisposalService';

/**
 * Selling or scrapping a fixed asset (X-03), mounted at
 * /api/v1/workspaces/:workspaceId/assets/:assetId/disposal (workspaceRoutes.ts, writers).
 * POST disposes of it (one ledger entry with the gain or loss); DELETE undoes that while the date is open.
 */
export const assetDisposalRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const schema = z.object({
  date: z.string().max(10),
  proceedsCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  proceedsAccountId: z.string().max(200).optional(),
  gainLossAccountId: z.string().max(200).optional(),
  assetAccountId: z.string().max(200).optional(),
}).strict();

const fail = (res: express.Response, err: unknown, what: string) => {
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Enter the date and the amount received (zero if scrapped)' });
  if (err instanceof DisposalError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: what, details: err instanceof Error ? err.message : String(err) });
};

const actor = (req: express.Request) => {
  const { user } = req as unknown as AuthedRequest;
  const p = req.params as Record<string, string>;
  return { workspaceId: p.workspaceId, assetId: p.assetId, uid: user.uid, email: user.email };
};

assetDisposalRouter.post('/', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await disposeAsset(getDb(), { ...actor(req), ...schema.parse(req.body) })) });
  } catch (err) { fail(res, err, 'The asset could not be disposed of'); }
});

assetDisposalRouter.delete('/', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await undoDisposal(getDb(), actor(req))) });
  } catch (err) { fail(res, err, 'The disposal could not be undone'); }
});
