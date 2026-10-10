/**
 * Cost allocation rules (Q-05, src/lib/allocationRules.ts): owners and accountants keep the
 * workspace's rules. Only the server writes them (`allocationRules` on the workspace), with new ids
 * for new rules and an audit line. A rule never posts anything: it is a suggestion on a bill.
 */
import crypto from 'crypto';
import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { allocationRulesProblem, type AllocationRule } from '../../lib/allocationRules';
import { writeServerAuditLog } from './auditLogService';

export class AllocationRuleError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'AllocationRuleError';
  }
}

export async function setAllocationRules(db: Firestore, input: { workspaceId: string; uid: string; email?: string; rules: unknown }) {
  const problem = allocationRulesProblem(input.rules);
  if (problem) throw new AllocationRuleError(400, problem);
  return db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new AllocationRuleError(404, 'Workspace not found');
    const role = workspaceRole(workspace, input.uid);
    if (role !== 'owner' && role !== 'accountant') throw new AllocationRuleError(403, 'Only owners and accountants keep the split rules');
    const before = Array.isArray(workspace.allocationRules) ? workspace.allocationRules as AllocationRule[] : [];
    const known = new Set(before.map(r => r.id));
    const rules: AllocationRule[] = (input.rules as AllocationRule[]).map(r => ({
      // an id that is not one of this workspace's rules gets a new one
      id: r.id && known.has(r.id) ? r.id : `ar_${crypto.randomBytes(6).toString('hex')}`,
      name: r.name.trim(),
      match: r.match.trim(),
      shares: r.shares.map(s => ({ percent: s.percent, ...(s.accountId ? { accountId: s.accountId } : {}), ...(s.labels && Object.keys(s.labels).length ? { labels: s.labels } : {}) })),
    }));
    t.update(ref, { allocationRules: rules, updatedAt: new Date().toISOString() });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'ALLOCATION_RULES_SET', entityType: 'workspaces', entityId: input.workspaceId,
      details: { description: `Split rules: ${rules.map(r => r.name).join(', ') || 'none'}` },
    }, { db, tx: t });
    return { rules };
  });
}
