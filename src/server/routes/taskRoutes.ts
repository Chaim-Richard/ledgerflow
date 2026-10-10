import express from 'express';
import { getDb } from '../db/firestore';
import { createTask, listTasks, removeTask, setTaskStatus, TaskError } from '../services/taskService';
import { myWatches, unwatch, watchRecord, WatchError } from '../services/watchService';
import { linkEntries, LinkError, linksOf, unlinkEntries } from '../services/entryLinkService';
import { changeTime, listTime, logTime, markInvoiced, moveTime, removeTime, setRates, TimeError } from '../services/timeService';

/**
 * Tasks (BG-02, BG-03), mounted at /api/v1/workspaces/:workspaceId/tasks (workspaceRoutes.ts, every
 * member): GET the tasks and the people; POST a task; PATCH /:taskId {status}; DELETE /:taskId. Who
 * may do what is checked in src/server/services/taskService.ts. And watching records (BG-04,
 * watchService.ts): GET /watching (mine), POST /watching {record}, DELETE /watching/:watchId.
 */
export const taskRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const actor = (req: express.Request) => {
  const { user } = req as unknown as AuthedRequest;
  return { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email };
};
const fail = (res: express.Response, err: unknown) => {
  if (err instanceof TaskError || err instanceof WatchError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: 'The task could not be saved', details: err instanceof Error ? err.message : String(err) });
};

taskRouter.get('/watching', async (req, res) => {
  try { res.json({ status: 'success', watches: await myWatches(getDb(), actor(req)) }); } catch (err) { fail(res, err); }
});
taskRouter.post('/watching', async (req, res) => {
  try { res.json({ status: 'success', watch: await watchRecord(getDb(), { ...actor(req), record: req.body?.record }) }); } catch (err) { fail(res, err); }
});
taskRouter.delete('/watching/:watchId', async (req, res) => {
  try { await unwatch(getDb(), { ...actor(req), watchId: String(req.params.watchId) }); res.json({ status: 'success' }); } catch (err) { fail(res, err); }
});

taskRouter.get('/', async (req, res) => {
  try { res.json({ status: 'success', ...(await listTasks(getDb(), actor(req))) }); } catch (err) { fail(res, err); }
});
taskRouter.post('/', async (req, res) => {
  try { res.json({ status: 'success', ...(await createTask(getDb(), { ...actor(req), task: req.body || {} })) }); } catch (err) { fail(res, err); }
});
taskRouter.patch('/:taskId', async (req, res) => {
  try { res.json({ status: 'success', ...(await setTaskStatus(getDb(), { ...actor(req), taskId: String(req.params.taskId), status: req.body?.status })) }); } catch (err) { fail(res, err); }
});
taskRouter.delete('/:taskId', async (req, res) => {
  try { await removeTask(getDb(), { ...actor(req), taskId: String(req.params.taskId) }); res.json({ status: 'success' }); } catch (err) { fail(res, err); }
});

/**
 * Transaction links (M-10, entryLinkService.ts), mounted at /api/v1/workspaces/:workspaceId/entry-links
 * (every member reads): GET ?transactionId=, POST {a, b, note}, DELETE /:linkId.
 */
export const entryLinkRouter = express.Router({ mergeParams: true });
const linkFail = (res: express.Response, err: unknown) => {
  if (err instanceof LinkError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: 'The link could not be saved', details: err instanceof Error ? err.message : String(err) });
};
entryLinkRouter.get('/', async (req, res) => {
  try { res.json({ status: 'success', links: await linksOf(getDb(), { ...actor(req), transactionId: String(req.query.transactionId || '') }) }); } catch (err) { linkFail(res, err); }
});
entryLinkRouter.post('/', async (req, res) => {
  try { res.json({ status: 'success', link: await linkEntries(getDb(), { ...actor(req), a: req.body?.a, b: req.body?.b, note: req.body?.note }) }); } catch (err) { linkFail(res, err); }
});
entryLinkRouter.delete('/:linkId', async (req, res) => {
  try { await unlinkEntries(getDb(), { ...actor(req), linkId: String(req.params.linkId) }); res.json({ status: 'success' }); } catch (err) { linkFail(res, err); }
});

/** Mounts the team routes (every member; each service checks who may do what) under /:workspaceId. */
export function mountTeamRoutes(workspaceRouter: express.Router, members: express.RequestHandler) {
  workspaceRouter.use('/:workspaceId/tasks', members, taskRouter);
  workspaceRouter.use('/:workspaceId/entry-links', members, entryLinkRouter);
  workspaceRouter.use('/:workspaceId/time', members, timeRouter);
}

/**
 * Time tracking (V-01, V-03..V-06, timeService.ts), at /api/v1/workspaces/:workspaceId/time: GET;
 * POST an entry; PATCH /:entryId; DELETE /:entryId; POST /move {entryIds, to, note};
 * POST /invoiced {entryIds, invoiceId}; PUT /rates {rates}.
 */
export const timeRouter = express.Router({ mergeParams: true });
const timeFail = (res: express.Response, err: unknown) => {
  if (err instanceof TimeError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: 'The time could not be saved', details: err instanceof Error ? err.message : String(err) });
};
timeRouter.get('/', async (req, res) => { try { res.json({ status: 'success', ...(await listTime(getDb(), actor(req))) }); } catch (err) { timeFail(res, err); } });
timeRouter.post('/move', async (req, res) => { try { res.json({ status: 'success', entries: await moveTime(getDb(), { ...actor(req), entryIds: req.body?.entryIds, to: req.body?.to, note: req.body?.note }) }); } catch (err) { timeFail(res, err); } });
timeRouter.post('/invoiced', async (req, res) => { try { res.json({ status: 'success', ...(await markInvoiced(getDb(), { ...actor(req), entryIds: req.body?.entryIds, invoiceId: req.body?.invoiceId })) }); } catch (err) { timeFail(res, err); } });
timeRouter.put('/rates', async (req, res) => { try { res.json({ status: 'success', ...(await setRates(getDb(), { ...actor(req), rates: req.body?.rates })) }); } catch (err) { timeFail(res, err); } });
timeRouter.post('/', async (req, res) => { try { res.json({ status: 'success', entry: await logTime(getDb(), { ...actor(req), entry: req.body || {} }) }); } catch (err) { timeFail(res, err); } });
timeRouter.patch('/:entryId', async (req, res) => { try { res.json({ status: 'success', entry: await changeTime(getDb(), { ...actor(req), entryId: String(req.params.entryId), entry: req.body || {} }) }); } catch (err) { timeFail(res, err); } });
timeRouter.delete('/:entryId', async (req, res) => { try { await removeTime(getDb(), { ...actor(req), entryId: String(req.params.entryId) }); res.json({ status: 'success' }); } catch (err) { timeFail(res, err); } });
