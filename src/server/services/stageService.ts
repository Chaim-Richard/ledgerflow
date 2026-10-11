import type { Firestore } from '../db/firestore';
import { workspaceRole } from '../../lib/periodLock';
import { STAGE_KINDS, stagesProblem, type StageKind, type StageSets } from '../../lib/stages';
import { writeServerAuditLog } from './auditLogService';

/**
 * Custom status workflows (BG-06, src/lib/stages.ts). Every member reads the stages; owners and
 * accountants define them; owners, accountants and bookkeepers move a record to a stage.
 */
export class StageError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

interface Actor { workspaceId: string; uid: string; email?: string }
const TABLE: Record<StageKind, string> = { invoice: 'invoices', bill: 'bills' };
const setsRef = (db: Firestore, workspaceId: string) => db.collection('documents').doc(`${workspaceId}_stageSets`);
const stageId = (workspaceId: string, kind: StageKind, id: string) => `${workspaceId}_stage_${kind}_${id}`.slice(0, 127);

async function role(db: Firestore, input: Actor) {
  const ws = (await db.collection('workspaces').doc(input.workspaceId).get()).data();
  if (!ws) throw new StageError(404, 'Workspace not found');
  return workspaceRole(ws as never, input.uid);
}

export async function readStages(db: Firestore, input: Actor & { kind: unknown }) {
  if (!STAGE_KINDS.includes(input.kind as StageKind)) throw new StageError(400, 'Stages are for invoices and bills');
  const kind = input.kind as StageKind;
  const sets = ((await setsRef(db, input.workspaceId).get()).data()?.sets || {}) as StageSets;
  const { rows } = await db.pool.query<{ rid: string; stage: string }>(
    `select data->'record'->>'id' as rid, data->>'stage' as stage from public.documents where workspace_id = $1 and data->>'kind' = 'recordStage' and data->'record'->>'type' = $2`,
    [input.workspaceId, kind]);
  return { stages: sets[kind] || [], current: Object.fromEntries(rows.map(r => [r.rid, r.stage])), sets };
}

export async function defineStages(db: Firestore, input: Actor & { sets: unknown }) {
  const problem = stagesProblem(input.sets);
  if (problem) throw new StageError(400, problem);
  if (!['owner', 'accountant'].includes(await role(db, input))) throw new StageError(403, 'Only owners and accountants define the stages');
  const sets = Object.fromEntries(Object.entries(input.sets as Record<string, string[]>).map(([k, list]) => [k, list.map(s => s.trim())])) as StageSets;
  await setsRef(db, input.workspaceId).set({ kind: 'stageSets', workspaceId: input.workspaceId, sets, updatedAt: new Date().toISOString() });
  await writeServerAuditLog({ workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'STAGES_DEFINED', entityType: 'documents', entityId: `${input.workspaceId}_stageSets`, details: { description: Object.entries(sets).map(([k, l]) => `${k}: ${(l || []).join(' → ') || 'none'}`).join('; ') } }, { db });
  return { sets };
}

export async function moveToStage(db: Firestore, input: Actor & { kind: unknown; id: unknown; stage: unknown }) {
  if (!STAGE_KINDS.includes(input.kind as StageKind) || typeof input.id !== 'string' || !input.id) throw new StageError(400, 'Choose the invoice or bill');
  const kind = input.kind as StageKind;
  if (!['owner', 'accountant', 'bookkeeper'].includes(await role(db, input))) throw new StageError(403, 'Only owners, accountants and bookkeepers change a stage');
  const record = (await db.collection(TABLE[kind]).doc(input.id).get()).data();
  if (!record || record.workspaceId !== input.workspaceId) throw new StageError(404, `That ${kind} is not in this workspace`);
  const stages = (((await setsRef(db, input.workspaceId).get()).data()?.sets || {}) as StageSets)[kind] || [];
  const ref = db.collection('documents').doc(stageId(input.workspaceId, kind, input.id));
  if (input.stage === '' || input.stage === null) {
    await ref.delete();
  } else {
    if (typeof input.stage !== 'string' || !stages.includes(input.stage)) throw new StageError(400, 'Choose one of the stages');
    await ref.set({ kind: 'recordStage', workspaceId: input.workspaceId, record: { type: kind, id: input.id }, stage: input.stage, by: input.uid, at: new Date().toISOString() });
  }
  await writeServerAuditLog({ workspaceId: input.workspaceId, uid: input.uid, email: input.email, action: 'STAGE_CHANGED', entityType: TABLE[kind], entityId: input.id, details: { description: `${kind === 'invoice' ? 'Invoice' : 'Bill'} ${String(record.number || input.id)}: ${input.stage || 'no stage'}` } }, { db });
  return { stage: input.stage || '' };
}
