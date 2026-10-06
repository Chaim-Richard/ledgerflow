import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { TagError, changeTag, listTags } from '../services/tagService';

/**
 * Tags for the whole workspace (K-15), mounted at /api/v1/workspaces/:workspaceId/tags
 * (workspaceRoutes.ts, every member may read). Renaming, merging and removing is for owners,
 * accountants and bookkeepers.
 */
export const tagRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string }; userRole?: string };
const WRITERS = new Set(['owner', 'accountant', 'bookkeeper']);
const changeSchema = z.object({ from: z.string().min(1).max(50), to: z.string().max(50).nullable() }).strict();

tagRouter.get('/', async (req, res) => {
  try {
    res.json({ status: 'success', data: { tags: await listTags(getDb(), (req.params as Record<string, string>).workspaceId) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'The tags could not be read', details: err instanceof Error ? err.message : String(err) });
  }
});

tagRouter.post('/change', async (req, res) => {
  const { user, userRole } = req as unknown as AuthedRequest;
  if (!WRITERS.has(String(userRole))) return res.status(403).json({ status: 'error', message: 'Only owners, accountants and bookkeepers change tags' });
  try {
    const { from, to } = changeSchema.parse(req.body);
    const changed = await changeTag(getDb(), (req.params as Record<string, string>).workspaceId, from, to, user);
    res.json({ status: 'success', data: { changed } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Invalid request', details: err.issues });
    if (err instanceof TagError) return res.status(err.status).json({ status: 'error', message: err.message });
    res.status(500).json({ status: 'error', message: 'The tag could not be changed', details: err instanceof Error ? err.message : String(err) });
  }
});
