import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
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
