import express from 'express';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { createPaymentAtomic } from '../services/paymentService';
import { getLocalDateISO } from '../../lib/utils';
import { getWorkspaceUserRole, AuthenticatedRequest } from './workspaceRoutes';

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

export async function handleCreatePayment(req: express.Request, res: express.Response, dbOverride?: Firestore) {
  try {
    const authReq = req as Partial<AuthenticatedRequest>;
    if (!authReq.user?.uid) {
      return res.status(401).json({ status: 'error', message: 'Sign in required' });
    }

    const parsed = paymentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: 'Invalid payment payload', details: parsed.error.issues });
    }
    const { workspaceId, ...payload } = parsed.data;

    const db = dbOverride || getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);

    if (!authReq.user.admin) {
      const userRole = await getWorkspaceUserRole(db, workspaceId, authReq.user.uid);
      if (!['owner', 'accountant', 'bookkeeper'].includes(userRole)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: requires owner, accountant, or bookkeeper role' });
      }
    }

    const result = await createPaymentAtomic(db, {
      ...payload,
      workspaceId,
      uid: authReq.user.uid
    });

    res.json({ status: 'success', data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'FORBIDDEN' || message.includes('Forbidden') || message.includes('Unauthorized') || message.includes('Security Violation')) {
      return res.status(403).json({ status: 'error', message });
    }
    if (message === 'NOT_FOUND' || message.includes('not found')) {
      return res.status(404).json({ status: 'error', message });
    }
    res.status(400).json({ status: 'error', message });
  }
}

paymentRouter.post('/', (req, res) => handleCreatePayment(req, res));


