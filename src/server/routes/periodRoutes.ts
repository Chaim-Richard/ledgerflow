import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { closePeriod, closingBalanceCheck, partialUnlock, PeriodCloseError, relock, reopenPeriod, saveCloseSteps, signOff } from '../services/periodCloseService';
import { DepreciationError, runDepreciation } from '../services/depreciationService';

/**
 * Closing the books, mounted at /api/v1/workspaces/:workspaceId/periods (workspaceRoutes.ts,
 * behind membership + writer role). Roles per action are checked in periodCloseService.ts.
 */
export const periodRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };

const closeSchema = z.object({ mode: z.enum(['soft', 'hard']) }).strict();
const reopenSchema = z.object({ reason: z.string().min(5).max(500) }).strict();
const signOffSchema = z.object({ itemId: z.string().min(1).max(40), note: z.string().max(500).optional(), remove: z.boolean().optional() }).strict();
const stepsSchema = z.object({
  steps: z.array(z.object({ id: z.string().max(40).optional(), title: z.string().max(200), frequency: z.string().max(20) }).strict()).max(100),
}).strict();
const unlockSchema = z.object({ fromDate: z.string(), toDate: z.string(), reason: z.string().min(5).max(500) }).strict();

function handle(work: (req: AuthedRequest, params: Record<string, string>) => Promise<unknown>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const result = await work(req as AuthedRequest, req.params as Record<string, string>);
      res.json({ status: 'success', ...(result as object) });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Invalid request', details: err.issues });
      if (err instanceof PeriodCloseError) return res.status(err.status).json({ status: 'error', message: err.message, ...(err.details ? { details: err.details } : {}) });
      if (err instanceof DepreciationError) return res.status(err.status).json({ status: 'error', message: err.message });
      res.status(500).json({ status: 'error', message: 'The period could not be changed', details: err instanceof Error ? err.message : String(err) });
    }
  };
}

const actor = (req: AuthedRequest, params: Record<string, string>) => ({ workspaceId: params.workspaceId, uid: req.user.uid, email: req.user.email });

periodRouter.post('/unlock', handle((req, p) => partialUnlock(getDb(), { ...actor(req, p), ...unlockSchema.parse(req.body) })));
// BD-10: the client's own month-end steps (owners and accountants)
periodRouter.put('/close-steps', handle((req, p) => saveCloseSteps(getDb(), { ...actor(req, p), ...stepsSchema.parse(req.body) })));
periodRouter.post('/relock', handle((req, p) => relock(getDb(), actor(req, p))));
periodRouter.post('/:month/close', handle((req, p) => closePeriod(getDb(), { ...actor(req, p), month: p.month, ...closeSchema.parse(req.body) })));
periodRouter.post('/:month/reopen', handle((req, p) => reopenPeriod(getDb(), { ...actor(req, p), month: p.month, ...reopenSchema.parse(req.body) })));
// CA-06: the closed month's balances now, against the snapshot taken when it was closed (read only)
periodRouter.get('/:month/balance-check', handle((req, p) => closingBalanceCheck(getDb(), { ...actor(req, p), month: p.month })));
periodRouter.post('/:month/sign-off', handle((req, p) => signOff(getDb(), { ...actor(req, p), month: p.month, ...signOffSchema.parse(req.body) })));
// Month-end depreciation run for all active fixed assets (R-06, depreciationService.ts)
periodRouter.post('/:month/depreciation', handle((req, p) => runDepreciation(getDb(), { ...actor(req, p), month: p.month })));
