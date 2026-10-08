/**
 * Groups of books (DA-01, src/lib/workspaceGroups.ts): each person keeps their own groups of the
 * workspaces they can open. Only the server writes them (supabase/migrations/20261013070000_workspace_groups.sql):
 * a workspace is added only if the person can open it (its owner or a member), and when a group is
 * read, members the person can no longer open are left out, so they stay invisible. Nothing in a
 * workspace changes when it joins or leaves a group. Platform admins get no wider view here.
 */
import crypto from 'crypto';
import type { Firestore } from '../db/firestore';
import { GROUP_ID, groupProblem, MAX_GROUPS, structureProblem, type WorkspaceGroup } from '../../lib/workspaceGroups';

export class WorkspaceGroupError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'WorkspaceGroupError';
  }
}

/** The workspaces this person can open (owner or member, not being deleted). */
export async function openable(db: Firestore, uid: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const snap of [
    await db.collection('workspaces').where('uid', '==', uid).get(),
    await db.collection('workspaces').where('members', 'array-contains', uid).get(),
  ]) {
    snap.docs.forEach(d => { if (!d.data()?.deletedAt) ids.add(d.id); });
  }
  return ids;
}

const shown = (id: string, data: Record<string, unknown>, open: Set<string>): WorkspaceGroup => ({
  id,
  name: String(data.name || ''),
  workspaceIds: (Array.isArray(data.workspaceIds) ? data.workspaceIds as string[] : []).filter(w => open.has(w)),
  // Z-16: the parent and the shares, of the members the person can open
  ...(typeof data.parentId === 'string' && open.has(data.parentId) ? { parentId: data.parentId } : {}),
  ...(data.ownership && typeof data.ownership === 'object'
    ? { ownership: Object.fromEntries(Object.entries(data.ownership as Record<string, number>).filter(([w]) => open.has(w))) }
    : {}),
  ...(data.createdAt ? { createdAt: String(data.createdAt) } : {}),
  ...(data.updatedAt ? { updatedAt: String(data.updatedAt) } : {}),
});

export async function listGroups(db: Firestore, uid: string): Promise<WorkspaceGroup[]> {
  const open = await openable(db, uid);
  const snap = await db.collection('workspaceGroups').where('ownerUid', '==', uid).get();
  return snap.docs.map(d => shown(d.id, d.data() || {}, open)).sort((a, b) => a.name.localeCompare(b.name));
}

function refuseUnopenable(workspaceIds: string[], open: Set<string>) {
  // one the person can't open answers like one that does not exist
  const unknown = workspaceIds.find(id => !open.has(id));
  if (unknown) throw new WorkspaceGroupError(404, `Workspace ${unknown} not found`);
}

export async function createGroup(db: Firestore, input: { uid: string; name: string; workspaceIds: string[]; parentId?: string | null; ownership?: Record<string, number> }): Promise<WorkspaceGroup> {
  const problem = groupProblem(input) || structureProblem(input);
  if (problem) throw new WorkspaceGroupError(400, problem);
  const open = await openable(db, input.uid);
  refuseUnopenable(input.workspaceIds, open);
  const existing = await db.collection('workspaceGroups').where('ownerUid', '==', input.uid).get();
  if (existing.size >= MAX_GROUPS) throw new WorkspaceGroupError(400, `${MAX_GROUPS} groups at most: remove one first`);
  const id = `grp_${crypto.randomBytes(10).toString('hex')}`;
  const now = new Date().toISOString();
  const data = {
    ownerUid: input.uid, name: input.name.trim(), workspaceIds: input.workspaceIds,
    ...(input.parentId ? { parentId: input.parentId, ownership: input.ownership || {} } : {}),
    createdAt: now, updatedAt: now,
  };
  await db.collection('workspaceGroups').doc(id).create(data);
  return shown(id, data, open);
}

export async function updateGroup(db: Firestore, input: { uid: string; groupId: string; name?: string; workspaceIds?: string[]; parentId?: string | null; ownership?: Record<string, number> }): Promise<WorkspaceGroup> {
  if (!GROUP_ID.test(input.groupId)) throw new WorkspaceGroupError(404, 'Group not found');
  const problem = groupProblem(input);
  if (problem) throw new WorkspaceGroupError(400, problem);
  const open = await openable(db, input.uid);
  return db.runTransaction(async t => {
    const ref = db.collection('workspaceGroups').doc(input.groupId);
    const data = (await t.get(ref)).data();
    // someone else's group answers like a missing one
    if (!data || data.ownerUid !== input.uid) throw new WorkspaceGroupError(404, 'Group not found');
    const before = Array.isArray(data.workspaceIds) ? data.workspaceIds as string[] : [];
    let workspaceIds = before;
    if (input.workspaceIds) {
      // added ones must be openable; members the person can no longer open stay as they were, unseen
      refuseUnopenable(input.workspaceIds.filter(id => !before.includes(id)), open);
      const hidden = before.filter(id => !open.has(id));
      workspaceIds = [...input.workspaceIds, ...hidden.filter(id => !input.workspaceIds!.includes(id))];
    }
    // Z-16: a parent or shares left out stay as they were; shares of members that left go with them
    const parentId = input.parentId !== undefined ? input.parentId : (typeof data.parentId === 'string' ? data.parentId : null);
    if (input.parentId !== undefined && input.parentId !== null && input.parentId !== data.parentId) refuseUnopenable([input.parentId], open);
    const stored = Object.entries((data.ownership as Record<string, number>) || {}).filter(([w]) => workspaceIds.includes(w) && w !== parentId);
    // shares given are checked as given; those of members the person can no longer open stay, unseen
    const ownership = parentId
      ? (input.ownership ? { ...Object.fromEntries(stored.filter(([w]) => !open.has(w))), ...input.ownership } : Object.fromEntries(stored))
      : input.ownership;
    const structure = structureProblem({ workspaceIds, parentId, ownership });
    if (structure) throw new WorkspaceGroupError(400, structure);
    const { parentId: _p, ownership: _o, ...rest } = data;
    const next = {
      ...rest, ...(input.name !== undefined ? { name: input.name.trim() } : {}), workspaceIds,
      ...(parentId ? { parentId, ownership } : {}), updatedAt: new Date().toISOString(),
    };
    t.set(ref, next);
    return shown(input.groupId, next, open);
  });
}

export async function deleteGroup(db: Firestore, input: { uid: string; groupId: string }): Promise<void> {
  if (!GROUP_ID.test(input.groupId)) throw new WorkspaceGroupError(404, 'Group not found');
  await db.runTransaction(async t => {
    const ref = db.collection('workspaceGroups').doc(input.groupId);
    const data = (await t.get(ref)).data();
    if (!data || data.ownerUid !== input.uid) throw new WorkspaceGroupError(404, 'Group not found');
    t.delete(ref);
  });
}
