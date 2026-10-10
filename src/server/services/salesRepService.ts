/**
 * Sales reps (P-13, src/lib/salesReps.ts): owners and accountants keep the workspace's reps, their
 * commission percentages and customers. Only the server writes them (`salesReps` on the workspace),
 * with new ids for new reps and an audit line. Nothing is posted: commission is a report.
 */
import crypto from 'crypto';
import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { salesRepsProblem, type SalesRep } from '../../lib/salesReps';
import { writeServerAuditLog } from './auditLogService';

export class SalesRepError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'SalesRepError';
  }
}

export async function setSalesReps(db: Firestore, input: { workspaceId: string; uid: string; email?: string; reps: unknown }) {
  const problem = salesRepsProblem(input.reps);
  if (problem) throw new SalesRepError(400, problem);
  return db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new SalesRepError(404, 'Workspace not found');
    const role = workspaceRole(workspace, input.uid);
    if (role !== 'owner' && role !== 'accountant') throw new SalesRepError(403, 'Only owners and accountants keep the sales reps');
    const known = new Set((Array.isArray(workspace.salesReps) ? workspace.salesReps as SalesRep[] : []).map(r => r.id));
    const reps: SalesRep[] = (input.reps as SalesRep[]).map(r => ({
      id: r.id && known.has(r.id) ? r.id : `sr_${crypto.randomBytes(6).toString('hex')}`,
      name: r.name.trim(),
      commissionPercent: r.commissionPercent,
      ...(r.customerIds && r.customerIds.length ? { customerIds: [...new Set(r.customerIds)] } : {}),
    }));
    t.update(ref, { salesReps: reps, updatedAt: new Date().toISOString() });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'SALES_REPS_SET', entityType: 'workspaces', entityId: input.workspaceId,
      details: { description: `Sales reps: ${reps.map(r => `${r.name} ${r.commissionPercent}%`).join(', ') || 'none'}` },
    }, { db, tx: t });
    return { reps };
  });
}
