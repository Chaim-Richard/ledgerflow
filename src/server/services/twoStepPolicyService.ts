import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { approverCount } from '../../lib/twoPersonRule';
import { writeServerAuditLog } from './auditLogService';
import { forgetTwoStepRequirements } from '../auth/supabaseAuth';

/**
 * Two-step login for everyone in a workspace (Y-30). An owner turns it on from a session that
 * passed two-step login themselves (so they cannot lock themselves out); from then on the server's
 * token check and the database rules refuse a password-only session of anyone in the workspace
 * until they set up an authenticator app. Saved on the workspace (`requireTwoStep`, server-only).
 */
export class TwoStepPolicyError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function setRequireTwoStep(db: Firestore, input: { workspaceId: string; uid: string; email?: string; aal?: string; required: boolean }) {
  if (input.required && input.aal !== 'aal2') {
    throw new TwoStepPolicyError(409, 'Turn on two-step login for your own account first (Settings → Security), then sign in again with a code');
  }
  const result = await db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new TwoStepPolicyError(404, 'Workspace not found');
    if (workspaceRole(workspace, input.uid) !== 'owner') throw new TwoStepPolicyError(403, 'Only owners decide this');
    t.update(ref, { requireTwoStep: input.required, updatedAt: new Date().toISOString() });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'TWO_STEP_REQUIREMENT_SET', entityType: 'workspaces', entityId: input.workspaceId,
      details: { description: input.required ? 'Everyone in the workspace must now use two-step login' : 'Two-step login is no longer required in the workspace' },
    }, { db, tx: t });
    return { required: input.required };
  });
  forgetTwoStepRequirements();
  return result;
}

/**
 * The two-person rule (P-05, src/lib/twoPersonRule.ts): owners turn it on so nobody approves what
 * they prepared. It needs two people who can approve (owners and accountants), or invoices over the
 * limit and pay runs could never be approved. Saved on the workspace (`twoPersonRule`, server-only).
 */
export async function setTwoPersonRule(db: Firestore, input: { workspaceId: string; uid: string; email?: string; on: boolean }) {
  return db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new TwoStepPolicyError(404, 'Workspace not found');
    if (workspaceRole(workspace, input.uid) !== 'owner') throw new TwoStepPolicyError(403, 'Only owners decide this');
    if (input.on && approverCount(workspace) < 2) throw new TwoStepPolicyError(409, 'The two-person rule needs a second owner or accountant in the workspace first (Settings → Team)');
    t.update(ref, { twoPersonRule: input.on, updatedAt: new Date().toISOString() });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'TWO_PERSON_RULE_SET', entityType: 'workspaces', entityId: input.workspaceId,
      details: { description: input.on ? 'Nobody approves what they prepared themselves (two-person rule on)' : 'The two-person rule is off' },
    }, { db, tx: t });
    return { on: input.on };
  });
}
