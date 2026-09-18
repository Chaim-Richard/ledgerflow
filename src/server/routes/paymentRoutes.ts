import express from 'express';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { createPaymentAtomic } from '../services/paymentService';
import { requireOpenPeriod } from '../middleware/periodLock';

export const paymentRouter = express.Router();

paymentRouter.post('/', requireOpenPeriod('payments'), async (req, res) => {
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

paymentRouter.delete('/:id', requireOpenPeriod('payments'), async (req, res) => {
  try {
    const authReq = req as any;
    const { id } = req.params;
    const db = getDb();
    const docRef = db.collection('payments').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ status: 'error', message: 'Payment not found' });
    }
    const payment = snap.data();
    await validateWorkspaceMember(db, payment?.workspaceId, authReq.user);

    if (payment?.status && payment.status !== 'draft') {
      return res.status(403).json({
        status: 'error',
        message: `Forbidden: Only draft payments can be deleted. Current status: ${payment.status}. Void the payment instead.`
      });
    }

    await docRef.delete();
    res.json({ status: 'success', message: 'Payment deleted' });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
    res.status(400).json({ status: 'error', message: err.message || 'Failed to delete payment' });
  }
});
