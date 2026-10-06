import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { askQuery, closeQuery, QueryError, replyToQuery } from '../services/clientQueryService';
import { MAX_QUESTION, MAX_REPLY } from '../../lib/clientQueries';

/**
 * Client queries (BD-07), mounted at /api/v1/workspaces/:workspaceId/queries for every member
 * (workspaceRoutes.ts); who may ask, answer or close is checked in clientQueryService. Members read
 * the questions straight from the database (live); only these routes write them.
 */
export const clientQueryRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };

const askSchema = z.object({ transactionId: z.string().min(1).max(200), question: z.string().max(MAX_QUESTION + 100) }).strict();
const replySchema = z.object({ text: z.string().max(MAX_REPLY + 100) }).strict();

const fail = (res: express.Response, err: unknown, what: string) => {
  if (err instanceof QueryError) return res.status(err.status).json({ status: 'error', message: err.message });
  if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'That request is not in the expected form' });
  res.status(500).json({ status: 'error', message: what, details: err instanceof Error ? err.message : String(err) });
};

const actor = (req: express.Request) => {
  const { user } = req as unknown as AuthedRequest;
  return { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email };
};

clientQueryRouter.post('/', async (req, res) => {
  try {
    const body = askSchema.parse(req.body);
    res.json({ status: 'success', data: { query: await askQuery(getDb(), { ...actor(req), ...body }) } });
  } catch (err) { fail(res, err, 'The question could not be sent'); }
});

clientQueryRouter.post('/:queryId/reply', async (req, res) => {
  try {
    const body = replySchema.parse(req.body);
    res.json({ status: 'success', data: { query: await replyToQuery(getDb(), { ...actor(req), queryId: String(req.params.queryId), text: body.text }) } });
  } catch (err) { fail(res, err, 'The answer could not be sent'); }
});

clientQueryRouter.post('/:queryId/close', async (req, res) => {
  try {
    await closeQuery(getDb(), { ...actor(req), queryId: String(req.params.queryId) });
    res.json({ status: 'success' });
  } catch (err) { fail(res, err, 'The question could not be closed'); }
});
