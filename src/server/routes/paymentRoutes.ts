import express from 'express';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { createPaymentAtomic } from '../services/paymentService';

export const paymentRouter = express.Router();

paymentRouter.post('/', async (req, res) => {
  try {
    const authReq = req as any;
    const { workspaceId, ...payload } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ status: 'error', message: 'workspaceId is required' });
    }

    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);

    const result = await createPaymentAtomic(db, {
      ...payload,
      workspaceId,
      uid: authReq.user?.uid || 'system'
    });

    res.json({ status: 'success', data: result });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
    if (err.message === 'NOT_FOUND') return res.status(404).json({ status: 'error', message: 'Workspace not found' });
    res.status(400).json({ status: 'error', message: err.message || 'Payment processing failed' });
  }
});
