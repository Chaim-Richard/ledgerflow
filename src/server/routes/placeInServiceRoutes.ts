import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { InServiceError, placeInService, undoPlaceInService } from '../services/placeInServiceService';

/**
 * Construction in progress (X-09), mounted at /api/v1/workspaces/:workspaceId/assets/:assetId/in-service
 * (workspaceRoutes.ts, writers): POST places an asset being built in service (one entry out of the
 * construction-in-progress account); DELETE undoes that while nothing happened to it since.
 */
export const placeInServiceRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const schema = z.object({
  date: z.string().max(10),
  assetAccountId: z.string().min(1).max(200),
  usefulLifeYears: z.number().gt(0).max(100).optional(),
  salvageValueCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();

const actor = (req: express.Request) => {
  const { user } = req as unknown as AuthedRequest;
  const p = req.params as Record<string, string>;
  return { workspaceId: p.workspaceId, assetId: p.assetId, uid: user.uid, email: user.email };
};
const fail = (res: express.Response, err: unknown, what: string) => {
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Choose the day and the account it belongs in' });
  if (err instanceof InServiceError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: what, details: err instanceof Error ? err.message : String(err) });
};

placeInServiceRouter.post('/', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await placeInService(getDb(), { ...actor(req), ...schema.parse(req.body) })) });
  } catch (err) { fail(res, err, 'The asset could not be placed in service'); }
});

placeInServiceRouter.delete('/', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await undoPlaceInService(getDb(), actor(req))) });
  } catch (err) { fail(res, err, 'That could not be undone'); }
});
