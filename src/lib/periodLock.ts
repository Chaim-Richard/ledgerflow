/**
 * Closed periods (R-03 soft vs hard close, R-10 lock by role, BA-15 partial unlock): which dates
 * are closed for whom. Used by the server posting checks and the screens; the database has the
 * same rule in lf_period_open (supabase/migrations), so keep the two in step.
 *
 * - lockDate: hard close. Nobody posts on or before it.
 * - softLockDate: soft close. Owners and accountants may still post (adjusting entries) on or
 *   before it; bookkeepers may not.
 * - lockException: a partial unlock, a date range inside the closed period that is open again
 *   until it is closed again.
 */

export interface LockException {
  fromDate: string;
  toDate: string;
  reason?: string;
  by?: string;
  at?: string;
}

export interface PeriodLockSettings {
  uid?: unknown;
  roles?: unknown;
  lockDate?: string | null;
  softLockDate?: string | null;
  lockException?: LockException | null;
}

/** Roles that close and reopen periods and may post into a soft-closed period. */
export const CLOSE_ROLES: readonly string[] = ['owner', 'accountant'];

export function workspaceRole(ws: Pick<PeriodLockSettings, 'uid' | 'roles'> | null | undefined, uid: string): string {
  if (!ws) return 'viewer';
  if (ws.uid === uid) return 'owner';
  const role = (ws.roles as Record<string, unknown> | undefined)?.[uid];
  return typeof role === 'string' ? role : 'viewer';
}

/** The last closed date for this user (hard close, or the soft close when they may not post past it). */
export function effectiveLockDate(ws: PeriodLockSettings | null | undefined, uid: string): string | null {
  if (!ws) return null;
  const hard = ws.lockDate || '';
  const soft = CLOSE_ROLES.includes(workspaceRole(ws, uid)) ? '' : (ws.softLockDate || '');
  const latest = hard > soft ? hard : soft;
  return latest || null;
}

/** Whether a date is closed, given the user's lock date and the partial unlock (if any). */
export function isLockedDate(date: string | null | undefined, lockDate: string | null | undefined, exception?: LockException | null): boolean {
  if (!lockDate) return false;
  const day = date ? date.slice(0, 10) : '';
  if (day && exception?.fromDate && exception?.toDate && day >= exception.fromDate && day <= exception.toDate) return false;
  return !day || day <= lockDate;
}

export interface PostingLock {
  kind: 'hard' | 'soft';
  through: string;
}

/** Why this user may not post on this date, or null when the date is open for them. */
export function postingLock(date: string | null | undefined, ws: PeriodLockSettings | null | undefined, uid: string): PostingLock | null {
  if (!ws) return null;
  const exception = ws.lockException;
  if (ws.lockDate && isLockedDate(date, ws.lockDate, exception)) return { kind: 'hard', through: ws.lockDate };
  const lockDate = effectiveLockDate(ws, uid);
  if (lockDate && isLockedDate(date, lockDate, exception)) return { kind: 'soft', through: lockDate };
  return null;
}

export function lockMessage(date: string | null | undefined, lock: PostingLock): string {
  const when = date ? `${date.slice(0, 10)} is` : 'The date is';
  return lock.kind === 'hard'
    ? `Period Locked: ${when} in a closed period (closed through ${lock.through}).`
    : `Period Locked: ${when} in a soft-closed period (through ${lock.through}); only owners and accountants can post there.`;
}

/** Throws the "Period Locked" error when the date is closed for this user. */
export function assertPostingOpen(date: string | null | undefined, ws: PeriodLockSettings | null | undefined, uid: string): void {
  const lock = postingLock(date, ws, uid);
  if (lock) throw new Error(lockMessage(date, lock));
}

/** Last day of a YYYY-MM month (integer maths, no time zones). */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return `${month}-${String(days).padStart(2, '0')}`;
}

/** The day before a YYYY-MM-DD date (integer maths). */
export function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (d > 1) return `${y}-${String(m).padStart(2, '0')}-${String(d - 1).padStart(2, '0')}`;
  if (m > 1) return monthEnd(`${y}-${String(m - 1).padStart(2, '0')}`);
  return `${y - 1}-12-31`;
}

export type MonthCloseState = 'open' | 'soft' | 'hard' | 'partly-open';

/** How a month looks under the current lock settings (the lock dates are cumulative). */
export function monthCloseState(month: string, ws: PeriodLockSettings | null | undefined): MonthCloseState {
  if (!ws) return 'open';
  const end = monthEnd(month);
  const state: MonthCloseState = ws.lockDate && ws.lockDate >= end ? 'hard' : ws.softLockDate && ws.softLockDate >= end ? 'soft' : 'open';
  const ex = ws.lockException;
  if (state !== 'open' && ex?.fromDate && ex?.toDate && ex.fromDate <= end && ex.toDate >= `${month}-01`) return 'partly-open';
  return state;
}
