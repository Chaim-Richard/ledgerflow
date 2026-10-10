/**
 * Per-role dashboards (BC-02, src/lib/dashboardOverview.ts): an owner gives a role (accountant,
 * bookkeeper, viewer, or owners) the dashboard layout its people start from; anyone who has not
 * arranged their own sees it. Only the server writes them (`roleDashboards` on the workspace), with
 * an audit line. Nothing in the books changes.
 */
import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { dashboardLayout, roleDashboardProblem, type DashboardRole, type RoleDashboards } from '../../lib/dashboardOverview';
import { writeServerAuditLog } from './auditLogService';

export class RoleDashboardError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'RoleDashboardError';
  }
}

export async function setRoleDashboard(db: Firestore, input: { workspaceId: string; uid: string; email?: string; role: unknown; layout: unknown }) {
  const problem = roleDashboardProblem(input.role, input.layout);
  if (problem) throw new RoleDashboardError(400, problem);
  const role = input.role as DashboardRole;
  return db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new RoleDashboardError(404, 'Workspace not found');
    if (workspaceRole(workspace, input.uid) !== 'owner') throw new RoleDashboardError(403, 'Only owners choose the dashboards of each role');
    const current = (workspace.roleDashboards && typeof workspace.roleDashboards === 'object' ? workspace.roleDashboards : {}) as RoleDashboards;
    const { [role]: _old, ...others } = current;
    const roleDashboards: RoleDashboards = input.layout === null ? others : { ...others, [role]: dashboardLayout(input.layout) };
    t.update(ref, { roleDashboards, updatedAt: new Date().toISOString() });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'ROLE_DASHBOARD_SET', entityType: 'workspaces', entityId: input.workspaceId,
      details: { description: input.layout === null ? `The ${role} dashboard is back to the standard one` : `New starting dashboard for ${role === 'owner' ? 'owners' : `${role}s`}` },
    }, { db, tx: t });
    return { roleDashboards };
  });
}
