import express from 'express';
import { z } from 'zod';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { createPaymentAtomic } from '../services/paymentService';
import { getLocalDateISO } from '../../lib/utils';
import { getWorkspaceUserRole } from './workspaceRoutes';

export const paymentRouter = express.Router();

const paymentAllocationSchema = z.object({
  documentId: z.string().min(1),
  documentType: z.enum(['invoice', 'bill']),
  amountCents: z.number().int().positive()
});

const paymentInputSchema = z.object({
  workspaceId: z.string().min(1),
  amountCents: z.number().int().positive(),
  paymentDate: z.string().default(() => getLocalDateISO()),
  cashAccountId: z.string().min(1),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  memo: z.string().optional(),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
  entityName: z.string().optional(),
  offsetAccountId: z.string().optional(),
  allocations: z.array(paymentAllocationSchema).default([])
});

paymentRouter.post('/', async (req, res) => {
  try {
    const authReq = req as any;
    const parsed = paymentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid payment payload', details: parsed.error.issues });
    }
    const { workspaceId, ...payload } = parsed.data;

    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);

    if (authReq.user?.uid && !authReq.user?.admin) {
      const userRole = await getWorkspaceUserRole(db, workspaceId, authReq.user.uid);
      if (!['owner', 'accountant', 'bookkeeper'].includes(userRole)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: requires owner, accountant, or bookkeeper role' });
      }
    }

    const result = await createPaymentAtomic(db, {
      ...payload,
      workspaceId,
      uid: authReq.user?.uid || 'system'
    });

    res.json({ status: 'success', data: result });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN' || err.message?.includes('Security Violation') || err.message?.includes('Forbidden')) {
      return res.status(403).json({ status: 'error', message: err.message || 'Forbidden' });
    }
    if (err.message === 'NOT_FOUND' || err.message?.includes('not found')) {
      return res.status(404).json({ status: 'error', message: err.message || 'Workspace not found' });
    }
    res.status(400).json({ status: 'error', message: err.message || 'Payment processing failed' });
  }
});
