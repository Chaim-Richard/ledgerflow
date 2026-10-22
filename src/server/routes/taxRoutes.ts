import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { computeWorkspaceTaxReturn, fileTaxReturn, listTaxReturns, TaxReturnError } from '../services/taxReturnService';

/**
 * Tax returns, mounted at /api/v1/workspaces/:workspaceId/tax-returns (workspaceRoutes.ts, members).
 * GET lists filed returns; GET /preview computes a period; POST files it (owners and accountants).
 */
export const taxRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string } };

const periodSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().max(100).optional(),
  /** CON-4b: the registration the return is for ('vat:IL:514000001'); absent: the whole workspace */
  registration: z.string().max(120).regex(/^[a-z_]+:[^:]{2,60}:[^:]{1,40}$/).optional(),
}).strict();

function fail(res: express.Response, err: unknown) {
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Choose a valid period', details: err.issues });
  if (err instanceof TaxReturnError) return res.status(err.status).json({ status: 'error', message: err.message });
  return res.status(500).json({ status: 'error', message: 'The tax return could not be prepared', details: err instanceof Error ? err.message : String(err) });
}

taxRouter.get('/', async (req, res) => {
  try {
    res.json({ status: 'success', returns: await listTaxReturns(getDb(), String((req.params as Record<string, string>).workspaceId)) });
  } catch (err) {
    fail(res, err);
  }
});

taxRouter.get('/preview', async (req, res) => {
  try {
    const { startDate, endDate } = periodSchema.omit({ reference: true, registration: true }).parse({ startDate: req.query.startDate, endDate: req.query.endDate });
    res.json({ status: 'success', return: await computeWorkspaceTaxReturn(getDb(), String((req.params as Record<string, string>).workspaceId), startDate, endDate) });
  } catch (err) {
    fail(res, err);
  }
});

taxRouter.post('/', async (req, res) => {
  try {
    const body = periodSchema.parse(req.body);
    const filed = await fileTaxReturn(getDb(), { ...body, workspaceId: String((req.params as Record<string, string>).workspaceId), uid: (req as unknown as AuthedRequest).user.uid });
    res.json({ status: 'success', return: filed });
  } catch (err) {
    fail(res, err);
  }
});
