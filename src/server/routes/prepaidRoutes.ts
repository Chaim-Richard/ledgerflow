import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { PrepaidError, spreadBillExpense, spreadInvoiceRevenue, undoBillSpread, undoInvoiceSpread } from '../services/prepaidService';

/**
 * Spread a bill's expense (K-17) or an invoice's income (K-16) over months, and undo it, mounted at
 * /api/v1/workspaces/:workspaceId/bills and …/invoices (workspaceRoutes.ts, owner/accountant/bookkeeper).
 */
export const prepaidRouter = express.Router({ mergeParams: true });
export const revenueSpreadRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };

const spreadSchema = z.object({
  expenseAccountId: z.string().min(1).max(200),
  prepaidAccountId: z.string().min(1).max(200).optional(),
  amountCents: z.number().int().positive(),
  months: z.number().int().min(2).max(60),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
}).strict();

const revenueSpreadSchema = z.object({
  revenueAccountId: z.string().min(1).max(200),
  deferredAccountId: z.string().min(1).max(200).optional(),
  amountCents: z.number().int().positive(),
  months: z.number().int().min(2).max(60),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
}).strict();

function handle(work: (req: AuthedRequest, params: Record<string, string>) => Promise<unknown>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      res.json({ status: 'success', data: await work(req as AuthedRequest, req.params as Record<string, string>) });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Invalid request', details: err.issues });
      if (err instanceof PrepaidError) return res.status(err.status).json({ status: 'error', message: err.message });
      res.status(500).json({ status: 'error', message: 'The spread could not be saved', details: err instanceof Error ? err.message : String(err) });
    }
  };
}

prepaidRouter.post('/:billId/spread', handle((req, p) => spreadBillExpense(getDb(), {
  workspaceId: p.workspaceId, billId: p.billId, uid: req.user.uid, email: req.user.email, ...spreadSchema.parse(req.body),
})));
prepaidRouter.post('/:billId/spread/undo', handle((req, p) => undoBillSpread(getDb(), {
  workspaceId: p.workspaceId, billId: p.billId, uid: req.user.uid, email: req.user.email,
})));

revenueSpreadRouter.post('/:invoiceId/spread', handle((req, p) => spreadInvoiceRevenue(getDb(), {
  workspaceId: p.workspaceId, invoiceId: p.invoiceId, uid: req.user.uid, email: req.user.email, ...revenueSpreadSchema.parse(req.body),
})));
revenueSpreadRouter.post('/:invoiceId/spread/undo', handle((req, p) => undoInvoiceSpread(getDb(), {
  workspaceId: p.workspaceId, invoiceId: p.invoiceId, uid: req.user.uid, email: req.user.email,
})));
