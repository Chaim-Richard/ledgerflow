import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { BadDebtError, reverseWriteOff, writeOffInvoice } from '../services/badDebtService';

/**
 * Bad debt write-off and its reversal (K-19), mounted at
 * /api/v1/workspaces/:workspaceId/invoices (workspaceRoutes.ts, owner/accountant).
 */
export const badDebtRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };

const writeOffSchema = z.object({
  badDebtAccountId: z.string().min(1).max(200).optional(),
  date: z.string().optional(),
  reason: z.string().max(300).optional(),
}).strict();
const reverseSchema = z.object({ date: z.string().optional(), reason: z.string().max(300).optional() }).strict();

function handle(work: (req: AuthedRequest, params: Record<string, string>) => Promise<unknown>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      res.json({ status: 'success', ...(await work(req as AuthedRequest, req.params as Record<string, string>) as object) });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Invalid request', details: err.issues });
      if (err instanceof BadDebtError) return res.status(err.status).json({ status: 'error', message: err.message });
      res.status(500).json({ status: 'error', message: 'The write-off could not be saved', details: err instanceof Error ? err.message : String(err) });
    }
  };
}

badDebtRouter.post('/:invoiceId/write-off', handle((req, p) => writeOffInvoice(getDb(), {
  workspaceId: p.workspaceId, invoiceId: p.invoiceId, uid: req.user.uid, email: req.user.email, ...writeOffSchema.parse(req.body),
})));
badDebtRouter.post('/:invoiceId/write-off/reverse', handle((req, p) => reverseWriteOff(getDb(), {
  workspaceId: p.workspaceId, invoiceId: p.invoiceId, uid: req.user.uid, email: req.user.email, ...reverseSchema.parse(req.body),
})));
