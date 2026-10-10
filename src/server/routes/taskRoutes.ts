import express from 'express';
import { getDb } from '../db/firestore';
import { createTask, listTasks, removeTask, setTaskStatus, TaskError } from '../services/taskService';

/**
 * Tasks (BG-02, BG-03), mounted at /api/v1/workspaces/:workspaceId/tasks (workspaceRoutes.ts, every
 * member): GET the tasks and the people; POST a task; PATCH /:taskId {status}; DELETE /:taskId. Who
 * may do what is checked in src/server/services/taskService.ts.
 */
export const taskRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const actor = (req: express.Request) => {
  const { user } = req as unknown as AuthedRequest;
  return { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email };
};
const fail = (res: express.Response, err: unknown) => {
  if (err instanceof TaskError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: 'The task could not be saved', details: err instanceof Error ? err.message : String(err) });
};

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
