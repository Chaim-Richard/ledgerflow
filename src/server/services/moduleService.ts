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

/**
 * What each module still holds (BB-07 step 2): the records of its screens, so Settings → Modules can
 * say that a module turned off still keeps them. Counted by the server for the workspace; a table the
 * database doesn't have yet counts nothing.
 */
const MODULE_RECORDS: Record<string, Array<{ table: string; where?: string }>> = {
  estimates: [{ table: 'estimates' }],
  'purchase-orders': [{ table: 'purchaseOrders' }],
  payroll: [{ table: 'employees' }, { table: 'payRuns' }],
  'fixed-assets': [{ table: 'assets' }],
  loans: [{ table: 'loans' }],
  'petty-cash': [{ table: 'transactions', where: `data->'metadata' ? 'pettyCash'` }],
  intercompany: [{ table: 'transactions', where: `data->'metadata'->>'isIntercompany' = 'true'` }],
  forecasting: [{ table: 'scenarios' }],
  inventory: [{ table: 'inventory' }],
  projects: [{ table: 'projects' }],
  budgets: [{ table: 'budgets' }],
};

export async function moduleRecords(db: Firestore, workspaceId: string): Promise<Record<string, number>> {
  const existing = await db.tables();
  const counts: Record<string, number> = {};
  for (const [id, sources] of Object.entries(MODULE_RECORDS)) {
    let n = 0;
    for (const { table, where } of sources.filter(x => existing.has(x.table))) {
      const { rows } = await db.pool.query(`select count(*)::int as n from public."${table}" where workspace_id = $1${where ? ` and ${where}` : ''}`, [workspaceId]);
      n += rows[0]?.n || 0;
    }
    counts[id] = n;
  }
  return counts;
}
