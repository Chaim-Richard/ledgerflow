/**
 * Groups of books (DA-01, src/lib/workspaceGroups.ts): each person keeps their own groups of the
 * workspaces they can open. Only the server writes them (supabase/migrations/20261013070000_workspace_groups.sql):
 * a workspace is added only if the person can open it (its owner or a member), and when a group is
 * read, members the person can no longer open are left out, so they stay invisible. Nothing in a
 * workspace changes when it joins or leaves a group. Platform admins get no wider view here.
 */
import crypto from 'crypto';
import type { Firestore } from '../db/firestore';
import { lineMergesProblem } from '../reports/groupAccounts';
import { GROUP_ID, groupProblem, keptRatesProblem, MAX_GROUP_SHARES, MAX_GROUPS, MAX_KEPT_RATES, ratesKey, structureProblem, type WorkspaceGroup } from '../../lib/workspaceGroups';

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

const sharedList = (data: Record<string, unknown>) => (Array.isArray(data.sharedWith) ? data.sharedWith as string[] : []);

const shown = (id: string, data: Record<string, unknown>, open: Set<string>, uid?: string): WorkspaceGroup => ({
  id,
  name: String(data.name || ''),
  // DA-01: the owner sees whom it is shared with; the others see who shared it
  ...(uid && data.ownerUid !== uid
    ? { mine: false, sharedBy: String(data.ownerEmail || 'its owner') }
    : { mine: true, sharedWith: sharedList(data).map(u => ({ uid: u, email: String((data.sharedEmails as Record<string, string> | undefined)?.[u] || u) })) }),
  workspaceIds: (Array.isArray(data.workspaceIds) ? data.workspaceIds as string[] : []).filter(w => open.has(w)),
  // Z-16: the parent and the shares, of the members the person can open
  ...(typeof data.parentId === 'string' && open.has(data.parentId) ? { parentId: data.parentId } : {}),
  ...(data.ownership && typeof data.ownership === 'object'
    ? { ownership: Object.fromEntries(Object.entries(data.ownership as Record<string, number>).filter(([w]) => open.has(w))) }
    : {}),
  ...(data.investments && typeof data.investments === 'object'
    ? { investments: Object.fromEntries(Object.entries(data.investments as Record<string, string>).filter(([w]) => open.has(w))) }
    : {}),
  ...(data.acquired && typeof data.acquired === 'object'
    ? { acquired: Object.fromEntries(Object.entries(data.acquired as Record<string, string>).filter(([w]) => open.has(w))) }
    : {}),
  ...(data.rates && typeof data.rates === 'object' ? { rates: data.rates as WorkspaceGroup['rates'] } : {}),
  ...(data.createdAt ? { createdAt: String(data.createdAt) } : {}),
  ...(data.updatedAt ? { updatedAt: String(data.updatedAt) } : {}),
});

export async function listGroups(db: Firestore, uid: string): Promise<WorkspaceGroup[]> {
  const open = await openable(db, uid);
  const own = await db.collection('workspaceGroups').where('ownerUid', '==', uid).get();
  // DA-01: groups shared with this person: read under their own access (members they can't open stay unseen)
  const shared = await db.collection('workspaceGroups').where('sharedWith', 'array-contains', uid).get();
  return [...own.docs, ...shared.docs].map(d => shown(d.id, d.data() || {}, open, uid))
    .sort((a, b) => Number(b.mine !== false) - Number(a.mine !== false) || a.name.localeCompare(b.name));
}

/** The owner, or someone the owner shared the group with, may read it. */
export const canReadGroup = (data: Record<string, unknown> | undefined, uid: string) => Boolean(data && (data.ownerUid === uid || sharedList(data).includes(uid)));

/**
 * DA-01: the owner shares a group with someone by their sign-in email. They read it (the group
 * summary too), each member under their own access; only the owner changes or removes it. Sharing
 * gives no access to any workspace.
 */
export async function shareGroup(db: Firestore, input: { uid: string; email?: string; groupId: string; withUid: string; withEmail: string }): Promise<WorkspaceGroup> {
  if (!GROUP_ID.test(input.groupId)) throw new WorkspaceGroupError(404, 'Group not found');
  if (input.withUid === input.uid) throw new WorkspaceGroupError(400, 'The group is already yours');
  const open = await openable(db, input.uid);
  return db.runTransaction(async t => {
    const ref = db.collection('workspaceGroups').doc(input.groupId);
    const data = (await t.get(ref)).data();
    if (!data || data.ownerUid !== input.uid) throw new WorkspaceGroupError(404, 'Group not found');
    const list = sharedList(data);
    if (list.includes(input.withUid)) return shown(input.groupId, data, open, input.uid);
    if (list.length >= MAX_GROUP_SHARES) throw new WorkspaceGroupError(400, `A group is shared with ${MAX_GROUP_SHARES} people at most`);
    const next = {
      ...data, sharedWith: [...list, input.withUid], sharedEmails: { ...((data.sharedEmails as Record<string, string>) || {}), [input.withUid]: input.withEmail },
      ...(input.email ? { ownerEmail: input.email } : {}), updatedAt: new Date().toISOString(),
    };
    t.set(ref, next);
    return shown(input.groupId, next, open, input.uid);
  });
}

/** DA-01: the owner stops sharing with someone, or someone leaves a group shared with them. */
export async function unshareGroup(db: Firestore, input: { uid: string; groupId: string; withUid: string }): Promise<void> {
  if (!GROUP_ID.test(input.groupId)) throw new WorkspaceGroupError(404, 'Group not found');
  await db.runTransaction(async t => {
    const ref = db.collection('workspaceGroups').doc(input.groupId);
    const data = (await t.get(ref)).data();
    const leaving = input.withUid === input.uid && sharedList(data || {}).includes(input.uid);
    if (!data || (data.ownerUid !== input.uid && !leaving)) throw new WorkspaceGroupError(404, 'Group not found');
    const emails = { ...((data.sharedEmails as Record<string, string>) || {}) };
    delete emails[input.withUid];
    t.set(ref, { ...data, sharedWith: sharedList(data).filter(u => u !== input.withUid), sharedEmails: emails, updatedAt: new Date().toISOString() });
  });
}

function refuseUnopenable(workspaceIds: string[], open: Set<string>) {
  // one the person can't open answers like one that does not exist
  const unknown = workspaceIds.find(id => !open.has(id));
  if (unknown) throw new WorkspaceGroupError(404, `Workspace ${unknown} not found`);
}

export async function createGroup(db: Firestore, input: { uid: string; name: string; workspaceIds: string[]; parentId?: string | null; ownership?: Record<string, number>; investments?: Record<string, string>; acquired?: Record<string, string> }): Promise<WorkspaceGroup> {
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
    ...(input.parentId ? { parentId: input.parentId, ownership: input.ownership || {}, investments: input.investments || {}, acquired: input.acquired || {} } : {}),
    createdAt: now, updatedAt: now,
  };
  await db.collection('workspaceGroups').doc(id).create(data);
  return shown(id, data, open);
}

export async function updateGroup(db: Firestore, input: { uid: string; groupId: string; name?: string; workspaceIds?: string[]; parentId?: string | null; ownership?: Record<string, number>; investments?: Record<string, string>; acquired?: Record<string, string> }): Promise<WorkspaceGroup> {
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
    // the investment accounts likewise (a new parent's accounts are another chart: they start empty)
    const storedInv = data.parentId === parentId ? Object.entries((data.investments as Record<string, string>) || {}).filter(([w]) => workspaceIds.includes(w) && w !== parentId) : [];
    const investments = parentId
      ? (input.investments ? { ...Object.fromEntries(storedInv.filter(([w]) => !open.has(w))), ...input.investments } : Object.fromEntries(storedInv))
      : input.investments;
    const storedDays = data.parentId === parentId ? Object.entries((data.acquired as Record<string, string>) || {}).filter(([w]) => workspaceIds.includes(w) && w !== parentId) : [];
    const acquired = parentId
      ? (input.acquired ? { ...Object.fromEntries(storedDays.filter(([w]) => !open.has(w))), ...input.acquired } : Object.fromEntries(storedDays))
      : input.acquired;
    const structure = structureProblem({ workspaceIds, parentId, ownership, investments, acquired });
    if (structure) throw new WorkspaceGroupError(400, structure);
    const { parentId: _p, ownership: _o, investments: _i, acquired: _a, ...rest } = data;
    const next = {
      ...rest, ...(input.name !== undefined ? { name: input.name.trim() } : {}), workspaceIds,
      ...(parentId ? { parentId, ownership, investments, acquired } : {}), updatedAt: new Date().toISOString(),
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

/**
 * Z-17: keep the translation rates used for a reporting currency and period on the group, so the
 * same period opens with them next time. The newest periods are kept (at most MAX_KEPT_RATES).
 */
export async function keepRates(db: Firestore, input: { uid: string; groupId: string; reportCurrency: string; startDate: string; endDate: string; rates: Record<string, { closing: number; average: number; historical: number }> }): Promise<WorkspaceGroup> {
  if (!GROUP_ID.test(input.groupId)) throw new WorkspaceGroupError(404, 'Group not found');
  const problem = keptRatesProblem(input);
  if (problem) throw new WorkspaceGroupError(400, problem);
  const open = await openable(db, input.uid);
  return db.runTransaction(async t => {
    const ref = db.collection('workspaceGroups').doc(input.groupId);
    const data = (await t.get(ref)).data();
    if (!data || data.ownerUid !== input.uid) throw new WorkspaceGroupError(404, 'Group not found');
    const key = ratesKey(input.reportCurrency, input.startDate, input.endDate);
    const all = { ...((data.rates as WorkspaceGroup['rates']) || {}), [key]: input.rates };
    // the newest periods by end date, then start
    const byEnd = (k: string) => `${k.split(':')[2]}:${k.split(':')[1]}`;
    const kept = Object.fromEntries(Object.entries(all).sort(([a], [b]) => byEnd(b).localeCompare(byEnd(a))).slice(0, MAX_KEPT_RATES));
    const next = { ...data, rates: kept, updatedAt: new Date().toISOString() };
    t.set(ref, next);
    return shown(input.groupId, next, open);
  });
}

/**
 * Z-20: the group's own chart mapping: which lines of the account-by-account view add to another
 * (`lineMerges`, line key → line key; src/server/reports/groupAccounts.ts). Only the owner sets it.
 */
export async function setLineMerges(db: Firestore, input: { uid: string; groupId: string; merges: unknown }): Promise<Record<string, string>> {
  if (!GROUP_ID.test(input.groupId)) throw new WorkspaceGroupError(404, 'Group not found');
  const problem = lineMergesProblem(input.merges);
  if (problem) throw new WorkspaceGroupError(400, problem);
  const merges = input.merges as Record<string, string>;
  await db.runTransaction(async t => {
    const ref = db.collection('workspaceGroups').doc(input.groupId);
    const data = (await t.get(ref)).data();
    if (!data || data.ownerUid !== input.uid) throw new WorkspaceGroupError(404, 'Group not found');
    t.set(ref, { ...data, lineMerges: merges, updatedAt: new Date().toISOString() });
  });
  return merges;
}
