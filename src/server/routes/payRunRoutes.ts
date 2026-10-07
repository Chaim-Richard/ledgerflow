import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { PayRunError, postPayRun, undoPayRun } from '../services/payRunService';

/**
 * Pay runs (U-02), mounted at /api/v1/workspaces/:workspaceId/pay-runs (workspaceRoutes.ts, owners
 * and accountants). POST posts a run for the pay date; DELETE /:payRunId undoes it while the date is open.
 */
export const payRunRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const schema = z.object({
  date: z.string().max(10),
  bankAccountId: z.string().min(1).max(200),
  wagesAccountId: z.string().min(1).max(200),
  taxExpenseAccountId: z.string().min(1).max(200),
  liabilitiesAccountId: z.string().min(1).max(200),
  again: z.boolean().optional(),
}).strict();

const actor = (req: express.Request) => {
  const { user } = req as unknown as AuthedRequest;
  return { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email };
};
const fail = (res: express.Response, err: unknown, what: string) => {
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Choose the pay date and the four accounts' });
  if (err instanceof PayRunError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: what, details: err instanceof Error ? err.message : String(err) });
};

payRunRouter.post('/', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await postPayRun(getDb(), { ...actor(req), ...schema.parse(req.body) })) });
  } catch (err) { fail(res, err, 'The pay run could not be posted'); }
});

payRunRouter.delete('/:payRunId', async (req, res) => {
  try {
    res.json({ status: 'success', ...(await undoPayRun(getDb(), { ...actor(req), payRunId: String(req.params.payRunId) })) });
  } catch (err) { fail(res, err, 'The pay run could not be undone'); }
});
