import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { errorMessage, requestUser } from '../auth/requestUser';
import { requireLedgerWriter } from '../middleware/requireLedgerWriter';
import { LedgerPostingError } from '../services/cogsStockService';
import { BulkRefusal } from '../services/ledgerBulkCommit';
import { postDocument } from '../services/documentPostService';

/**
 * L-94 step 2: POST /api/v1/documents/:type/:id/post — save an invoice or bill; the server builds its entries
 * (documentPostService.ts). Body: { workspaceId, action: 'create' | 'update', data }, header Idempotency-Key. Nothing
 * else is accepted: a body that carries entries is refused. Answer: the bulk answer plus the entries as written.
 */
export const documentPostRouter = express.Router();

const bodySchema = z.object({
  workspaceId: z.string().min(1).max(200),
  action: z.enum(['create', 'update']),
  data: z.record(z.string(), z.unknown()),
}).strict();

documentPostRouter.post('/:type/:id/post', requireLedgerWriter, async (req, res) => {
  try {
    const type = String(req.params.type);
    if (type !== 'invoices' && type !== 'bills') return res.status(400).json({ error: 'Only invoices and bills are posted here' });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Send the document only: { workspaceId, action, data }', details: parsed.error.issues });
    const { body, transactions, cogsPendingReason } = await postDocument(getDb(), requestUser(req), {
      collection: type, docId: String(req.params.id), ...parsed.data,
      idempotencyKey: req.headers['idempotency-key'] as string | undefined,
    });
    res.json({ ...body, transactions, ...(cogsPendingReason ? { cogsPendingReason } : {}) });
  } catch (e) {
    if (e instanceof BulkRefusal) return res.status(e.status).json(e.body);
    console.error('[DOCUMENT POST ERROR]', e);
    res.status(e instanceof LedgerPostingError ? e.status : 400).json({ error: errorMessage(e) });
  }
});
