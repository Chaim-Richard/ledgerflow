/**
 * Balances on the server (L-123 step 1, docs/design/L-123-server-balances.md).
 *
 * A snapshot per closed year end (`periodBalances`, supabase/migrations/20261023000000_period_balances.sql) holds,
 * over every postable entry dated on or before `asOf`:
 * - `accounts`: base-currency cents per account id, debit positive (the accounts' own opening balances are not in
 *   it: the reports add them, as today);
 * - `byLabel`: label kind → value → account → cents, for every kind present at build time ("Unassigned" included,
 *   so each kind adds back to `accounts`);
 * - `retainedEarnings`: the cumulative profit (income − cost of goods − expenses, profit positive, the balance
 *   sheet's `netIncome`);
 * - `entryCount` and `checksum` (sha256 over the ids and update times of the entries it sums).
 *
 * The rule: balance at D = the newest fresh snapshot with `asOf` ≤ D, plus the postable entries dated after `asOf`
 * and on or before D. (The design says `asOf` < D; at D = `asOf` both give the same figures, and ≤ spares the
 * year-end balance sheet from reading the whole year.) A snapshot the database trigger marked stale is never read.
 * Dates are book dates: an entry stored with a clock time counts on its calendar day (`transactionDate`).
 */
import crypto from 'crypto';
import type { ChartAccount, Transaction } from '../../types';
import type { Firestore, Transaction as DbTransaction } from '../db/firestore';
import { calculateNetIncome, isPostable, lineAmount, transactionDate } from '../../lib/txFilters';
import { getLineDimension } from '../../lib/dimensionUtils';

export const UNASSIGNED = 'Unassigned';
export type Cents = Record<string, number>;
export type LabelCents = Record<string, Record<string, Cents>>;

export interface PeriodBalances {
  workspaceId: string;
  asOf: string;
  accounts: Cents;
  byLabel: LabelCents;
  retainedEarnings: number;
  entryCount: number;
  checksum: string;
  builtAt: string;
  builtBy: string;
  stale?: boolean;
  staleSince?: string;
}

export interface BalancesAsOf {
  workspaceId: string;
  date: string;
  accounts: Cents;
  retainedEarnings: number;
  byLabel?: LabelCents;
  /** the snapshot read, or null when every entry was summed */
  snapshot: { asOf: string; checksum: string } | null;
  /** how many entries were read besides the snapshot */
  entriesRead: number;
}

type Entry = Transaction & { _updated?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
export const snapshotId = (workspaceId: string, asOf: string) => `${workspaceId}_${asOf}`;

let known: { exists: boolean; at: number } | null = null;
let warned = false;

/** Whether the periodBalances table exists (cached; looked for again after a minute when missing). */
export async function periodBalancesReady(db: Firestore): Promise<boolean> {
  if (known && (known.exists || Date.now() - known.at < 60_000)) return known.exists;
  try {
    const result = await db.pool.query(`select to_regclass('public."periodBalances"') is not null as ok`);
    known = { exists: Boolean(result.rows[0]?.ok), at: Date.now() };
  } catch {
    known = { exists: false, at: Date.now() };
  }
  if (!known.exists && !warned) {
    warned = true;
    console.warn('[balances] the periodBalances table is missing: apply supabase/migrations/20261023000000_period_balances.sql. Balances are summed from every entry until then.');
  }
  return known.exists;
}

const add = (map: Cents, key: string, cents: number) => { map[key] = (map[key] || 0) + cents; };
const prune = (map: Cents): Cents => Object.fromEntries(Object.entries(map).filter(([, v]) => v !== 0));
const norm = (kind: string) => kind.normalize('NFC').toLowerCase().trim();

/** The label kinds an entry's lines can carry a value for (what getLineDimension reads), plus "category". */
export function labelKinds(entries: Transaction[]): Set<string> {
  const kinds = new Set<string>(['category']);
  for (const tx of entries) {
    Object.keys(tx.dimensions || {}).forEach(k => kinds.add(norm(k)));
    if (tx.projectId) kinds.add('project');
    if (tx.classId) kinds.add('class');
    if (tx.locationId) kinds.add('location');
    const tags = [...(tx.tags || [])];
    for (const line of tx.lines || []) {
      if (!line) continue;
      Object.keys(line.dimensions || {}).forEach(k => kinds.add(norm(k)));
      for (const k of ['class', 'location', 'project', 'department'] as const) if (line[k]) kinds.add(k);
      tags.push(...(line.tags || []));
    }
    for (const tag of tags) if (typeof tag === 'string' && tag.includes(':')) kinds.add(norm(tag.split(':')[0]));
  }
  kinds.delete('');
  return kinds;
}

/** Sums postable entries (already chosen by date) into accounts and, for the given kinds, by label. */
export function sumEntries(entries: Transaction[], kinds: Iterable<string> = []): { accounts: Cents; byLabel: LabelCents; count: number } {
  const accounts: Cents = {};
  const byLabel: LabelCents = {};
  const kindList = [...kinds];
  kindList.forEach(k => { byLabel[k] = {}; });
  let count = 0;
  for (const tx of entries) {
    if (!isPostable(tx)) continue;
    count++;
    for (const line of tx.lines || []) {
      if (!line || typeof line.accountId !== 'string') continue;
      const cents = lineAmount(line, tx);
      add(accounts, line.accountId, cents);
      for (const kind of kindList) {
        const value = getLineDimension(line, tx, kind) || UNASSIGNED;
        add(byLabel[kind][value] ||= {}, line.accountId, cents);
      }
    }
  }
  return { accounts, byLabel, count };
}

function checksumOf(entries: Entry[]): string {
  const keys = entries.filter(isPostable).map(e => `${e.id}@${e._updated || ''}`).sort();
  return crypto.createHash('sha256').update(keys.join('\n')).digest('hex');
}

/** The snapshot of the entries given (all of the workspace's, any date: those after `asOf` are left out). */
export function snapshotFromEntries(workspaceId: string, asOf: string, accounts: ChartAccount[], entries: Entry[], builtBy: string): PeriodBalances {
  const mine = entries.filter(e => { const d = transactionDate(e); return d !== '' && d <= asOf; });
  const sums = sumEntries(mine, labelKinds(mine.filter(isPostable)));
  const byLabel: LabelCents = {};
  for (const [kind, values] of Object.entries(sums.byLabel)) {
    byLabel[kind] = Object.fromEntries(Object.entries(values).map(([v, c]) => [v, prune(c)]).filter(([, c]) => Object.keys(c).length > 0));
  }
  return {
    workspaceId, asOf, accounts: prune(sums.accounts), byLabel,
    retainedEarnings: calculateNetIncome(mine, accounts, '1970-01-01', asOf).netIncome,
    entryCount: sums.count, checksum: checksumOf(mine), builtAt: new Date().toISOString(), builtBy, stale: false,
  };
}

const entryOf = (d: { id: string; data: () => unknown; updateTime?: { toDate: () => Date } }): Entry =>
  ({ ...(d.data() as Transaction), id: d.id, _updated: d.updateTime?.toDate().toISOString() });

/** Reads, inside a database transaction, what a snapshot at `asOf` needs. Reads only: write it with writeSnapshot. */
export async function readSnapshotInputs(db: Firestore, t: DbTransaction, workspaceId: string, asOf: string) {
  const [accountsSnap, entriesSnap] = await Promise.all([
    t.get(db.collection('chartAccounts').where('workspaceId', '==', workspaceId)),
    t.get(db.collection('transactions').where('workspaceId', '==', workspaceId).where('date', '<', nextDay(asOf))),
  ]);
  return {
    accounts: accountsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount),
    entries: entriesSnap.docs.map(entryOf),
  };
}

export function writeSnapshot(db: Firestore, t: DbTransaction, snapshot: PeriodBalances): void {
  t.set(db.collection('periodBalances').doc(snapshotId(snapshot.workspaceId, snapshot.asOf)), { ...snapshot });
}

/** Builds (or rebuilds) the snapshot at `asOf` in one serializable transaction, so no entry can change between the read and the write. */
export async function buildSnapshot(db: Firestore, workspaceId: string, asOf: string, builtBy = 'server'): Promise<PeriodBalances> {
  if (!DATE.test(asOf)) throw new Error(`A snapshot date is YYYY-MM-DD (got "${asOf}")`);
  return db.runTransaction(async t => {
    const { accounts, entries } = await readSnapshotInputs(db, t, workspaceId, asOf);
    const snapshot = snapshotFromEntries(workspaceId, asOf, accounts, entries, builtBy);
    writeSnapshot(db, t, snapshot);
    return snapshot;
  });
}

async function snapshotsOf(db: Firestore, workspaceId: string): Promise<PeriodBalances[]> {
  if (!(await periodBalancesReady(db))) return [];
  const snap = await db.collection('periodBalances').where('workspaceId', '==', workspaceId).get();
  return snap.docs.map(d => d.data() as PeriodBalances);
}

/** Every account's balance (and, on request, by label) at the end of `date`. */
export async function balancesAsOf(db: Firestore, workspaceId: string, date: string, options: { byLabel?: boolean } = {}): Promise<BalancesAsOf> {
  if (!DATE.test(date)) throw new Error(`A balance date is YYYY-MM-DD (got "${date}")`);
  const fresh = (await snapshotsOf(db, workspaceId))
    .filter(s => s.stale !== true && DATE.test(s.asOf) && s.asOf <= date)
    .sort((a, b) => b.asOf.localeCompare(a.asOf));
  const snapshot = fresh[0] || null;
  let query = db.collection('transactions').where('workspaceId', '==', workspaceId).where('date', '<', nextDay(date));
  if (snapshot) query = query.where('date', '>=', nextDay(snapshot.asOf));
  const [accountsSnap, entriesSnap] = await Promise.all([
    db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get(),
    query.get(),
  ]);
  const accounts = accountsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount);
  const entries = entriesSnap.docs.map(entryOf).filter(e => {
    const d = transactionDate(e);
    return d !== '' && d <= date && (!snapshot || d > snapshot.asOf);
  });
  const kinds = options.byLabel ? new Set([...labelKinds(entries.filter(isPostable)), ...Object.keys(snapshot?.byLabel || {})]) : [];
  const sums = sumEntries(entries, kinds);
  const total: Cents = { ...(snapshot?.accounts || {}) };
  Object.entries(sums.accounts).forEach(([id, c]) => add(total, id, c));
  const result: BalancesAsOf = {
    workspaceId, date, accounts: prune(total),
    retainedEarnings: (snapshot?.retainedEarnings || 0) + calculateNetIncome(entries, accounts, '1970-01-01', date).netIncome,
    snapshot: snapshot ? { asOf: snapshot.asOf, checksum: snapshot.checksum } : null,
    entriesRead: entries.length,
  };
  if (options.byLabel) {
    const byLabel: LabelCents = {};
    for (const kind of kinds) {
      // a kind no entry of the snapshot carried: every one of its lines was "Unassigned"
      const base = snapshot ? (snapshot.byLabel?.[kind] || { [UNASSIGNED]: snapshot.accounts }) : {};
      const merged: Record<string, Cents> = {};
      for (const [value, cents] of [...Object.entries(base), ...Object.entries(sums.byLabel[kind] || {})]) {
        const into = merged[value] ||= {};
        Object.entries(cents).forEach(([id, c]) => add(into, id, c));
      }
      byLabel[kind] = Object.fromEntries(Object.entries(merged).map(([v, c]) => [v, prune(c)]).filter(([, c]) => Object.keys(c).length > 0));
    }
    result.byLabel = byLabel;
  }
  return result;
}

/** The year ends a workspace closed and still has locked: each FISCAL_YEAR_CLOSE that locked the year, up to today's lock date. */
async function closedYearEnds(db: Firestore, workspaceId: string): Promise<string[]> {
  const ws = (await db.collection('workspaces').doc(workspaceId).get()).data() || {};
  const lockDate = typeof ws.lockDate === 'string' ? ws.lockDate : '';
  if (!lockDate) return [];
  const logs = await db.collection('auditLogs').where('workspaceId', '==', workspaceId).where('action', '==', 'FISCAL_YEAR_CLOSE').get();
  const ends = new Set<string>();
  for (const d of logs.docs) {
    const details = (d.data().details || {}) as { closingDate?: unknown; lockPeriod?: unknown };
    if (details.lockPeriod === true && typeof details.closingDate === 'string' && DATE.test(details.closingDate) && details.closingDate <= lockDate) ends.add(details.closingDate);
  }
  return [...ends].sort();
}

/**
 * The rebuild path: the snapshots of years closed before L-123 (none yet), and every stale one. Run by the server
 * only (open question 3): on request of an owner, after a reopened range is closed again, and by a job.
 */
export async function rebuildSnapshots(db: Firestore, workspaceId: string, builtBy = 'server'): Promise<{ built: string[] }> {
  if (!(await periodBalancesReady(db))) return { built: [] };
  const existing = await snapshotsOf(db, workspaceId);
  const have = new Map(existing.map(s => [s.asOf, s]));
  const wanted = new Set([...await closedYearEnds(db, workspaceId), ...existing.filter(s => s.stale === true).map(s => s.asOf)]);
  const built: string[] = [];
  for (const asOf of [...wanted].sort()) {
    const current = have.get(asOf);
    if (current && current.stale !== true) continue;
    await buildSnapshot(db, workspaceId, asOf, builtBy);
    built.push(asOf);
  }
  return { built };
}
