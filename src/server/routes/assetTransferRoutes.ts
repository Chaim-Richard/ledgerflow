import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { transferAsset, TransferError, undoTransfer } from '../services/assetTransferService';

/**
 * Moving a fixed asset (X-05), mounted at /api/v1/workspaces/:workspaceId/assets/:assetId/transfer
 * (workspaceRoutes.ts, writers). POST moves it (a new location and/or accounts; a move between
 * accounts is posted); DELETE undoes the latest move while its date is open.
 */
export const assetTransferRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const schema = z.object({
  date: z.string().max(10),
  location: z.string().max(200).optional(),
  assetAccountId: z.string().max(200).optional(),
  accumulatedAccountId: z.string().max(200).optional(),
}).strict();

const actor = (req: express.Request) => {
  const { user } = req as unknown as AuthedRequest;
  const p = req.params as Record<string, string>;
  return { workspaceId: p.workspaceId, assetId: p.assetId, uid: user.uid, email: user.email };
};
const fail = (res: express.Response, err: unknown, what: string) => {
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Choose the day and where it moves' });
  if (err instanceof TransferError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: what, details: err instanceof Error ? err.message : String(err) });
};

assetTransferRouter.post('/', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await transferAsset(getDb(), { ...actor(req), ...schema.parse(req.body) })) });
  } catch (err) { fail(res, err, 'The asset could not be moved'); }
});

assetTransferRouter.delete('/', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await undoTransfer(getDb(), actor(req))) });
  } catch (err) { fail(res, err, 'The move could not be undone'); }
});
