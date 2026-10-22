import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { errorMessage, requestUser } from '../auth/requestUser';
import { requireLedgerWriter } from '../middleware/requireLedgerWriter';
import { LedgerPostingError } from '../services/cogsStockService';
import { BulkRefusal } from '../services/ledgerBulkCommit';
import { postDocument } from '../services/documentPostService';

/**
 * L-94 step 2: POST /api/v1/documents/:type/:id/post — save or delete an invoice, bill, credit note or vendor credit;
 * the server builds its entries (documentPostService.ts). Body: { workspaceId, action: 'create' | 'update' | 'delete',
 * data, creditLimitOverride? (EG-5) }, header Idempotency-Key. Nothing
 * else is accepted: a body that carries entries is refused. Answer: the bulk answer plus the entries as written.
 */
export const documentPostRouter = express.Router();

const bodySchema = z.object({
  workspaceId: z.string().min(1).max(200),
  action: z.enum(['create', 'update', 'delete']),
  data: z.record(z.string(), z.unknown()).optional(),
  /** the day the browser counted as today (L-94): used within one day of the server's, never part of the hash */
  postingDay: z.string().max(10).optional(),
  /** EG-5: issue an invoice over the customer's credit limit anyway; owner or accountant only, the reason is kept */
  creditLimitOverride: z.object({ reason: z.string().trim().min(1).max(500) }).strict().optional(),
}).strict();

const TYPES = new Set(['invoices', 'bills', 'creditNotes', 'vendorCredits']);

documentPostRouter.post('/:type/:id/post', requireLedgerWriter, async (req, res) => {
  try {
    const type = String(req.params.type);
    if (!TYPES.has(type)) return res.status(400).json({ error: 'Only invoices, bills, credit notes and vendor credits are posted here' });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Send the document only: { workspaceId, action, data }', details: parsed.error.issues });
    const { body, transactions, cogsPendingReason } = await postDocument(getDb(), requestUser(req), {
      collection: type as 'invoices', docId: String(req.params.id), workspaceId: parsed.data.workspaceId, action: parsed.data.action,
      data: parsed.data.action === 'delete' ? {} : parsed.data.data || {},
      ...(parsed.data.postingDay ? { postingDay: parsed.data.postingDay } : {}),
      ...(parsed.data.creditLimitOverride ? { creditLimitOverride: parsed.data.creditLimitOverride } : {}),
      idempotencyKey: req.headers['idempotency-key'] as string | undefined,
    });
    res.json({ ...body, transactions, ...(cogsPendingReason ? { cogsPendingReason } : {}) });
  } catch (e) {
    if (e instanceof BulkRefusal) return res.status(e.status).json(e.body);
    console.error('[DOCUMENT POST ERROR]', e);
    res.status(e instanceof LedgerPostingError ? e.status : 400).json({ error: errorMessage(e) });
  }
});
