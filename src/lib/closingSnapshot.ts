/**
 * Closing balance snapshots (CA-06): when a month is closed, every account's balance on its last
 * day is kept with the period. Later the close page compares them with the balances worked out
 * again from the ledger, so an entry that changed a closed month afterwards (during a partial
 * unlock, a reopen, or anything around the app) shows up account by account.
 *
 * A balance is the account's opening balance plus every counted line up to the date, debits
 * positive, the same rule as the trial balance (`isPostable`, `lineAmount`). Lines on an account
 * that no longer exists are kept under its id, so they are not lost from the comparison.
 */
import type { ChartAccount, Transaction } from '../types';
import { isPostable, lineAmount } from './txFilters';

export interface ClosingSnapshot {
  /** the last day of the closed month */
  asOfDate: string;
  /** when the snapshot was taken (ISO time) */
  takenAt: string;
  /**
   * each account's balance in whole cents, debits positive; accounts at zero are left out. A list,
   * not a map: closing the month again replaces it whole (a saved map would be merged key by key).
   */
  accounts: Array<{ accountId: string; cents: number }>;
  /** how many counted entries were dated up to the date */
  entries: number;
}

/** Account id → balance on the date (zeros left out), and how many entries counted. */
export function balancesAsOf(accounts: Pick<ChartAccount, 'id' | 'openingBalanceCents'>[], transactions: Transaction[], asOfDate: string): { balances: Record<string, number>; entries: number } {
  const sums = new Map<string, number>();
  for (const a of accounts) if (a.openingBalanceCents) sums.set(a.id, a.openingBalanceCents);
  let entries = 0;
  for (const tx of transactions) {
    if (!isPostable(tx) || (tx.date || '').slice(0, 10) > asOfDate) continue;
    entries++;
    for (const l of tx.lines || []) {
      if (!l?.accountId) continue;
      sums.set(l.accountId, (sums.get(l.accountId) || 0) + lineAmount(l, tx));
    }
  }
  const balances: Record<string, number> = {};
  for (const [id, cents] of sums) if (cents !== 0) balances[id] = cents;
  return { balances, entries };
}

export function takeClosingSnapshot(accounts: Pick<ChartAccount, 'id' | 'openingBalanceCents'>[], transactions: Transaction[], asOfDate: string, takenAt = new Date().toISOString()): ClosingSnapshot {
  const { balances, entries } = balancesAsOf(accounts, transactions, asOfDate);
  return {
    asOfDate, takenAt, entries,
    accounts: Object.entries(balances).map(([accountId, cents]) => ({ accountId, cents })).sort((a, b) => a.accountId.localeCompare(b.accountId)),
  };
}

export interface SnapshotChange { accountId: string; code: string; name: string; atCloseCents: number; nowCents: number; differenceCents: number }

/** The accounts whose balance on the closing date is not what it was when the month was closed. */
export function snapshotChanges(snapshot: Pick<ClosingSnapshot, 'accounts'>, now: { balances: Record<string, number> }, accounts: Pick<ChartAccount, 'id' | 'code' | 'name'>[]): SnapshotChange[] {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const atClose = new Map((snapshot.accounts || []).map(a => [a.accountId, a.cents]));
  const ids = new Set([...atClose.keys(), ...Object.keys(now.balances || {})]);
  const changes: SnapshotChange[] = [];
  for (const id of ids) {
    const atCloseCents = atClose.get(id) || 0;
    const nowCents = now.balances?.[id] || 0;
    if (atCloseCents === nowCents) continue;
    const account = byId.get(id);
    changes.push({ accountId: id, code: account?.code || '', name: account?.name || `Removed account (${id})`, atCloseCents, nowCents, differenceCents: nowCents - atCloseCents });
  }
  return changes.sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
}
