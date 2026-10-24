import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { errorMessage } from '../auth/requestUser';
import { writeServerAuditLog } from '../services/auditLogService';
import { BUDGET_CONTROLS, budgetControlOf, type BudgetControl } from '../services/budgetGuard';

/**
 * EG-4: PUT /api/v1/workspaces/:workspaceId/budget-control { budgetControl: 'off' | 'warn' | 'block' } — what a
 * posting over a budget does (budgetGuard.ts; 'warn' by default). Mounted in workspaceRoutes.ts for owners only.
 */
export const budgetControlRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const bodySchema = z.object({ budgetControl: z.enum(BUDGET_CONTROLS as [BudgetControl, ...BudgetControl[]]) }).strict();

budgetControlRouter.put('/', async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "budgetControl is 'off', 'warn' or 'block'" });
  try {
    const db = getDb();
    const user = (req as AuthedRequest).user;
    const ref = db.collection('workspaces').doc(workspaceId);
    const before = budgetControlOf((await ref.get()).data());
    const to = parsed.data.budgetControl;
    await ref.update({ budgetControl: to });
    await writeServerAuditLog({
      workspaceId, uid: user.uid, email: user.email, action: 'BUDGET_CONTROL_CHANGED', entityType: 'workspaces', entityId: workspaceId,
      details: { description: `Budget control changed from ${before} to ${to}`, from: before, to },
    }, { db });
    res.json({ status: 'success', budgetControl: to });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save the budget control', details: errorMessage(err) });
  }
});
