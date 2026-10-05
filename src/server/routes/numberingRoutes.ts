import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { NUMBERED_TYPES, NumberingError, readNumbering, updateNumbering, type NumberedType } from '../services/numberingService';

/**
 * Document numbering settings (BA-07), mounted at /api/v1/workspaces/:workspaceId/numbering
 * (workspaceRoutes.ts, owner/accountant).
 */
export const numberingRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };

const seriesSchema = z.object({
  prefix: z.string().max(20).regex(/^[\p{L}\p{N} _\-/.#]*$/u, 'Use letters, digits, spaces and - _ / . #'),
  nextNumber: z.number().int().min(1).max(999_999_999),
  padding: z.number().int().min(1).max(10),
}).strict();

const fail = (res: express.Response, err: unknown) => {
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: err.issues[0]?.message || 'Invalid request', details: err.issues });
  if (err instanceof NumberingError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: 'Document numbering could not be saved', details: err instanceof Error ? err.message : String(err) });
};

numberingRouter.get('/', async (req, res) => {
  try {
    res.json({ status: 'success', series: await readNumbering(getDb(), String((req.params as Record<string, string>).workspaceId)) });
  } catch (err) { fail(res, err); }
});

numberingRouter.put('/:type', async (req, res) => {
  try {
    const params = req.params as Record<string, string>;
    const type = z.enum(NUMBERED_TYPES as unknown as [NumberedType, ...NumberedType[]]).parse(params.type);
    const { user } = req as unknown as AuthedRequest;
    const series = await updateNumbering(getDb(), { workspaceId: String(params.workspaceId), uid: user.uid, email: user.email, type, ...seriesSchema.parse(req.body) });
    res.json({ status: 'success', series });
  } catch (err) { fail(res, err); }
});
