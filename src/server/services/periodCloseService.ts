import type { DocumentData, Firestore, Transaction } from '../db/firestore';
import { CLOSE_ROLES, dayBefore, monthCloseState, monthEnd, workspaceRole } from '../../lib/periodLock';
import type { PeriodLockSettings } from '../../lib/periodLock';
import { CLOSE_ITEM_IDS } from '../../lib/closeChecklist';
import { formatTzDate } from '../../lib/utils';
import { dayNumber } from '../../lib/fiscalCalendar';
import { writeServerAuditLog } from './auditLogService';

/**
 * Closing the books (R-02 sign-offs, R-03 soft/hard close, R-08 drafts, R-10 roles, BA-15 partial
 * unlock). All changes to the lock dates go through here: role-checked, one database
 * transaction each, and written to the audit log. The rule itself is src/lib/periodLock.ts.
 *
 * - Close (owner/accountant): soft = only owners and accountants post in the month from now on;
 *   hard = nobody does. Lock dates are cumulative, so closing March also closes what is before.
 *   Refused while drafts are dated in the months being closed (they could never be changed).
 * - Reopen: moves the lock back to before the month (so later months reopen too). A hard-closed
 *   month needs the owner; a soft-closed one owner or accountant. A reason is required.
 * - Partial unlock: opens a date range inside the closed period until it is closed again.
 * - Sign-off: a writer records that a checklist item was reviewed (not in a hard-closed month).
 */

export class PeriodCloseError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) {
    super(message);
    this.name = 'PeriodCloseError';
  }
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DRAFT_COLLECTIONS = ['transactions', 'journalEntries', 'invoices', 'bills', 'payments', 'creditNotes', 'vendorCredits'];
const WRITER_ROLES = ['owner', 'accountant', 'bookkeeper'];

interface Actor {
  workspaceId: string;
  uid: string;
  email?: string;
}

const periodRef = (db: Firestore, workspaceId: string, month: string) => db.collection('periods').doc(`${workspaceId}_${month}`);

async function loadWorkspace(db: Firestore, t: Transaction, actor: Actor, roles: readonly string[], action: string) {
  const ref = db.collection('workspaces').doc(actor.workspaceId);
  const ws = (await t.get(ref)).data() as (DocumentData & PeriodLockSettings) | undefined;
  if (!ws) throw new PeriodCloseError(404, 'Workspace not found');
  const role = workspaceRole(ws, actor.uid);
  if (!roles.includes(role)) throw new PeriodCloseError(403, `Only ${roles.join(' or ')} can ${action}`);
  return { ref, ws, role };
}

const later = (a?: string | null, b?: string | null) => ((a || '') > (b || '') ? a || '' : b || '');

function audit(db: Firestore, t: Transaction, actor: Actor, action: string, description: string, details: Record<string, unknown>) {
  return writeServerAuditLog({
    workspaceId: actor.workspaceId, uid: actor.uid, email: actor.email, action,
    entityType: 'period', entityId: actor.workspaceId, details: { description, ...details },
  }, { db, tx: t });
}

export async function closePeriod(db: Firestore, input: Actor & { month: string; mode: 'soft' | 'hard' }) {
  if (!MONTH.test(input.month)) throw new PeriodCloseError(400, 'Month must be YYYY-MM');
  if (input.mode !== 'soft' && input.mode !== 'hard') throw new PeriodCloseError(400, 'Choose a soft or hard close');
  const end = monthEnd(input.month);

  return db.runTransaction(async (t) => {
    const { ref, ws } = await loadWorkspace(db, t, input, CLOSE_ROLES, 'close a period');
    const today = formatTzDate(new Date(), typeof ws.timezone === 'string' ? ws.timezone : 'UTC');
    if (end > today) throw new PeriodCloseError(400, `${input.month} hasn't ended yet (today is ${today})`);
    const hard = ws.lockDate || '';
    const closedThrough = input.mode === 'hard' ? hard : later(hard, ws.softLockDate);
    if (closedThrough >= end) throw new PeriodCloseError(409, `${input.month} is already ${input.mode === 'hard' ? 'hard-' : ''}closed (through ${closedThrough})`);

    // Drafts dated in the months this close covers would be stuck: refuse, and list them.
    const drafts: Array<{ collection: string; id: string; date: string; label: string }> = [];
    for (const collection of DRAFT_COLLECTIONS) {
      let q = db.collection(collection).where('workspaceId', '==', input.workspaceId).where('status', '==', 'draft').where('date', '<=', end);
      if (closedThrough) q = q.where('date', '>', closedThrough);
      const snap = await t.get(q.limit(25));
      snap.docs.forEach(d => drafts.push({ collection, id: d.id, date: String(d.get('date') || ''), label: String(d.get('number') || d.get('description') || d.get('reference') || d.id) }));
    }
    if (drafts.length) {
      throw new PeriodCloseError(409, `${drafts.length} draft${drafts.length === 1 ? ' is' : 's are'} dated in the period being closed. Post, re-date or delete ${drafts.length === 1 ? 'it' : 'them'} first.`, drafts);
    }

    const now = new Date().toISOString();
    const update: DocumentData = { softLockDate: later(ws.softLockDate, end), updatedAt: now };
    if (input.mode === 'hard') update.lockDate = end;
    const ex = ws.lockException;
    if (ex?.fromDate && ex.fromDate <= end) update.lockException = null;
    t.update(ref, update);
    t.set(periodRef(db, input.workspaceId, input.month), {
      workspaceId: input.workspaceId, periodId: input.month, startDate: `${input.month}-01`, endDate: end,
      status: input.mode === 'hard' ? 'closed' : 'soft_closed', closeMode: input.mode,
      closedAt: now, closedBy: input.email || input.uid, closedByUid: input.uid, updatedAt: now,
    }, { merge: true });
    await audit(db, t, input, 'PERIOD_CLOSED', `${input.mode === 'hard' ? 'Hard' : 'Soft'}-closed ${input.month} (through ${end})`, { month: input.month, mode: input.mode });
    return { month: input.month, mode: input.mode, lockDate: update.lockDate ?? (hard || null), softLockDate: update.softLockDate as string };
  });
}

export async function reopenPeriod(db: Firestore, input: Actor & { month: string; reason: string }) {
  if (!MONTH.test(input.month)) throw new PeriodCloseError(400, 'Month must be YYYY-MM');
  const reason = String(input.reason || '').trim();
  if (reason.length < 5) throw new PeriodCloseError(400, 'Say why the period is reopened (at least 5 characters)');

  return db.runTransaction(async (t) => {
    const { ref, ws, role } = await loadWorkspace(db, t, input, CLOSE_ROLES, 'reopen a period');
    const state = monthCloseState(input.month, { ...ws, lockException: null });
    if (state === 'open') throw new PeriodCloseError(409, `${input.month} is not closed`);
    if (state === 'hard' && role !== 'owner') throw new PeriodCloseError(403, 'Only the owner can reopen a hard-closed period');

    const before = dayBefore(`${input.month}-01`);
    const now = new Date().toISOString();
    const update: DocumentData = { updatedAt: now };
    if (ws.lockDate && ws.lockDate > before) update.lockDate = before;
    if (ws.softLockDate && ws.softLockDate > before) update.softLockDate = before;
    t.update(ref, update);
    t.set(periodRef(db, input.workspaceId, input.month), {
      workspaceId: input.workspaceId, periodId: input.month, status: 'open',
      reopenedAt: now, reopenedBy: input.email || input.uid, reopenedByUid: input.uid, reopenReason: reason, updatedAt: now,
    }, { merge: true });
    const reopenedThrough = later(ws.lockDate, ws.softLockDate);
    await audit(db, t, input, 'PERIOD_REOPENED', `Reopened ${input.month}${reopenedThrough > monthEnd(input.month) ? ` and the months after it (through ${reopenedThrough})` : ''}: ${reason}`, { month: input.month, reason, previousLockDate: ws.lockDate || null, previousSoftLockDate: ws.softLockDate || null });
    return { month: input.month, lockDate: (update.lockDate ?? ws.lockDate) || null, softLockDate: (update.softLockDate ?? ws.softLockDate) || null };
  });
}

export async function partialUnlock(db: Firestore, input: Actor & { fromDate: string; toDate: string; reason: string }) {
  if (!DAY.test(input.fromDate) || !DAY.test(input.toDate) || input.fromDate > input.toDate) throw new PeriodCloseError(400, 'Choose a date range (from ≤ to)');
  const reason = String(input.reason || '').trim();
  if (reason.length < 5) throw new PeriodCloseError(400, 'Say why the dates are unlocked (at least 5 characters)');

  return db.runTransaction(async (t) => {
    const { ref, ws, role } = await loadWorkspace(db, t, input, CLOSE_ROLES, 'unlock a closed period');
    const closedThrough = later(ws.lockDate, ws.softLockDate);
    if (!closedThrough || input.fromDate > closedThrough) throw new PeriodCloseError(400, 'Those dates are not closed');
    const toDate = input.toDate > closedThrough ? closedThrough : input.toDate;
    if (ws.lockDate && input.fromDate <= ws.lockDate && role !== 'owner') throw new PeriodCloseError(403, 'Only the owner can unlock hard-closed dates');
    if (dayNumber(toDate) - dayNumber(input.fromDate) > 92) throw new PeriodCloseError(400, 'Unlock at most three months at a time');

    const now = new Date().toISOString();
    const lockException = { fromDate: input.fromDate, toDate, reason, by: input.email || input.uid, byUid: input.uid, at: now };
    t.update(ref, { lockException, updatedAt: now });
    await audit(db, t, input, 'PERIOD_PARTIAL_UNLOCK', `Unlocked ${input.fromDate} to ${toDate}: ${reason}`, { fromDate: input.fromDate, toDate, reason });
    return { lockException };
  });
}

export async function relock(db: Firestore, input: Actor) {
  return db.runTransaction(async (t) => {
    const { ref, ws } = await loadWorkspace(db, t, input, CLOSE_ROLES, 'lock the period again');
    if (!ws.lockException) throw new PeriodCloseError(409, 'Nothing is unlocked');
    t.update(ref, { lockException: null, updatedAt: new Date().toISOString() });
    await audit(db, t, input, 'PERIOD_RELOCKED', `Closed ${ws.lockException.fromDate} to ${ws.lockException.toDate} again`, { fromDate: ws.lockException.fromDate, toDate: ws.lockException.toDate });
    return { lockException: null };
  });
}

export async function signOff(db: Firestore, input: Actor & { month: string; itemId: string; note?: string; remove?: boolean }) {
  if (!MONTH.test(input.month)) throw new PeriodCloseError(400, 'Month must be YYYY-MM');
  if (!CLOSE_ITEM_IDS.includes(input.itemId)) throw new PeriodCloseError(400, 'Unknown checklist item');
  const note = String(input.note || '').trim().slice(0, 500);

  return db.runTransaction(async (t) => {
    const { ws } = await loadWorkspace(db, t, input, WRITER_ROLES, 'sign off checklist items');
    if (monthCloseState(input.month, { ...ws, lockException: null }) === 'hard') throw new PeriodCloseError(409, `${input.month} is hard-closed; its sign-offs are final`);
    const ref = periodRef(db, input.workspaceId, input.month);
    const existing = (await t.get(ref)).data();
    const signOffs = { ...((existing?.signOffs as Record<string, unknown>) || {}) };
    const now = new Date().toISOString();
    if (input.remove) delete signOffs[input.itemId];
    else signOffs[input.itemId] = { by: input.email || input.uid, byUid: input.uid, at: now, ...(note ? { note } : {}) };
    t.set(ref, {
      workspaceId: input.workspaceId, periodId: input.month, startDate: `${input.month}-01`, endDate: monthEnd(input.month),
      ...(existing?.status ? {} : { status: 'open' }), signOffs, updatedAt: now,
    }, { merge: true });
    await audit(db, t, input, 'PERIOD_SIGN_OFF', `${input.remove ? 'Removed the sign-off of' : 'Signed off'} "${input.itemId}" for ${input.month}${note ? `: ${note}` : ''}`, { month: input.month, itemId: input.itemId });
    return { signOffs };
  });
}
