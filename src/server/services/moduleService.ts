/**
 * Modules (BB-07, src/lib/modules.ts): owners and accountants turn modules on or off for the
 * workspace. Only the server writes the setting (`modules` on the workspace), with an audit line.
 * Turning a module off hides its screens; it never deletes anything.
 */
import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { MODULES, modulesProblem, type Modules } from '../../lib/modules';
import { writeServerAuditLog } from './auditLogService';

export class ModuleSettingError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ModuleSettingError';
  }
}

export async function setModules(db: Firestore, input: { workspaceId: string; uid: string; email?: string; modules: Modules }) {
  const problem = modulesProblem(input.modules);
  if (problem) throw new ModuleSettingError(400, problem);
  return db.runTransaction(async t => {
    const ref = db.collection('workspaces').doc(input.workspaceId);
    const workspace = (await t.get(ref)).data();
    if (!workspace) throw new ModuleSettingError(404, 'Workspace not found');
    const role = workspaceRole(workspace, input.uid);
    if (role !== 'owner' && role !== 'accountant') throw new ModuleSettingError(403, 'Only owners and accountants choose the modules');
    const before = (workspace.modules || {}) as Modules;
    const modules = { ...before, ...input.modules };
    t.update(ref, { modules, updatedAt: new Date().toISOString() });
    const changed = Object.entries(input.modules).filter(([id, on]) => (before[id] !== false) !== on)
      .map(([id, on]) => `${MODULES.find(m => m.id === id)?.name || id} ${on ? 'on' : 'off'}`);
    if (changed.length > 0) {
      await writeServerAuditLog({
        workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'MODULES_SET', entityType: 'workspaces', entityId: input.workspaceId,
        details: { description: `Modules: ${changed.join(', ')}` },
      }, { db, tx: t });
    }
    return { modules };
  });
}
