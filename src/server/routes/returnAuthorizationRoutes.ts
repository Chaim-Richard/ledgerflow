import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { requestUser } from '../auth/requestUser';
import { moveReturnAuthorization, requestReturnAuthorization, ReturnAuthorizationError } from '../services/returnAuthorizationService';

/**
 * ISS-143: return authorizations through the server (returnAuthorizationService.ts), mounted at
 * /api/v1/workspaces/:workspaceId/return-authorizations for workspace editors; the service checks the role again
 * from the workspace's own membership for each action.
 *   POST /           { customerId, invoiceId, reason, lines: [{ invoiceLineId, quantity }], requestKey }
 *   POST /:rmaId     { customerId, action, expectedStatus, note?, creditNoteId?, requestKey }
 */
export const returnAuthorizationRouter = express.Router({ mergeParams: true });

const key = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
const id = z.string().min(1).max(200);
const requestSchema = z.object({
  customerId: id, invoiceId: id, reason: z.string().max(1000),
  lines: z.array(z.object({ invoiceLineId: id, quantity: z.number().positive() }).strict()).min(1).max(200),
  requestKey: key,
}).strict();
const moveSchema = z.object({
  customerId: id,
  action: z.enum(['approve', 'decline', 'receive', 'link-credit-note']),
  expectedStatus: z.enum(['requested', 'approved', 'declined', 'received', 'closed']),
  note: z.string().max(1000).optional(),
  creditNoteId: id.optional(),
  requestKey: key,
}).strict();

const actor = (req: express.Request) => {
  const user = requestUser(req);
  return { uid: user.uid, name: String((user as { name?: string; email?: string }).name || user.email || '') };
};
const fail = (res: express.Response, err: unknown) => {
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'This RMA request is not complete: check the lines, the action and the request key.' });
  if (err instanceof ReturnAuthorizationError) return res.status(err.status).json({ status: 'error', message: err.message });
  return res.status(500).json({ status: 'error', message: err instanceof Error ? err.message : 'The RMA could not be saved' });
};

returnAuthorizationRouter.post('/', async (req, res) => {
  try {
    const body = requestSchema.parse(req.body);
    const result = await requestReturnAuthorization(getDb(), { workspaceId: String((req.params as Record<string, string>).workspaceId), actor: actor(req), ...body });
    res.json({ status: 'success', ...result });
  } catch (err) {
    fail(res, err);
  }
});

returnAuthorizationRouter.post('/:rmaId', async (req, res) => {
  try {
    const body = moveSchema.parse(req.body);
    const result = await moveReturnAuthorization(getDb(), { workspaceId: String((req.params as Record<string, string>).workspaceId), actor: actor(req), rmaId: String(req.params.rmaId), ...body });
    res.json({ status: 'success', ...result });
  } catch (err) {
    fail(res, err);
  }
});
