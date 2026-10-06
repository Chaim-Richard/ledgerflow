import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { ContactMergeError, deleteContact, mergeContacts } from '../services/contactMergeService';

/**
 * Merge duplicate customers or vendors (Y-23 BA-01; owner/accountant) and delete one that nothing
 * refers to (I-22; writers), mounted at /api/v1/workspaces/:workspaceId/contacts (workspaceRoutes.ts).
 */
export const contactMergeRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };

const mergeSchema = z.object({
  side: z.enum(['customer', 'vendor']),
  keepId: z.string().min(1).max(200),
  mergeId: z.string().min(1).max(200),
}).strict();

contactMergeRouter.post('/merge', async (req, res) => {
  try {
    const body = mergeSchema.parse(req.body);
    const { user } = req as AuthedRequest;
    const result = await mergeContacts(getDb(), { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email, ...body });
    res.json({ status: 'success', ...result });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Invalid request', details: err.issues });
    if (err instanceof ContactMergeError) return res.status(err.status).json({ status: 'error', message: err.message });
    res.status(500).json({ status: 'error', message: 'The contacts could not be merged', details: err instanceof Error ? err.message : String(err) });
  }
});

const deleteSchema = z.object({ side: z.enum(['customer', 'vendor']), id: z.string().min(1).max(200) });

contactMergeRouter.delete('/:side/:id', async (req, res) => {
  try {
    const params = req.params as Record<string, string>;
    const { side, id } = deleteSchema.parse({ side: params.side, id: params.id });
    const { user } = req as unknown as AuthedRequest;
    // ?check=1: may it be deleted? (nothing is deleted; the screen then offers Undo before deleting)
    const checkOnly = req.query.check === '1';
    await deleteContact(getDb(), { workspaceId: String(params.workspaceId), uid: user.uid, email: user.email, side, id, checkOnly });
    res.json({ status: 'success', ...(checkOnly ? { deletable: true } : {}) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Invalid request', details: err.issues });
    if (err instanceof ContactMergeError) return res.status(err.status).json({ status: 'error', message: err.message });
    res.status(500).json({ status: 'error', message: 'The contact could not be deleted', details: err instanceof Error ? err.message : String(err) });
  }
});
