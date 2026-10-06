import type { Firestore } from '../db/firestore';
import { runDataChecks, type CheckContext } from '../../lib/dataChecks';
import { healthSummary, newSeriousProblems, problemNotice, type LedgerHealth } from '../../lib/ledgerHealth';
import { formatTzDate } from '../../lib/utils';
import { logger } from '../utils/logger';
import { notify } from './notificationService';

/**
 * Ledger health monitor (CA-32), part of the daily job: runs the Data Health checks on each
 * workspace whose books changed since its last check (anything added, changed or deleted; or not
 * checked for a week), keeps the
 * result on the workspace (`ledgerHealth`, server-only), and notifies the owner and accountants of
 * serious problems that are new since the last check. Bounded by time so the daily job always
 * finishes; workspaces checked longest ago go first, the rest the next night.
 */
const SOURCES = {
  transactions: { table: 'transactions', cap: 20000 },
  accounts: { table: 'chartAccounts', cap: 2000 },
  invoices: { table: 'invoices', cap: 10000 },
  bills: { table: 'bills', cap: 10000 },
  recurring: { table: 'recurring', cap: 1000 },
  inventory: { table: 'inventory', cap: 5000 },
  bankLines: { table: 'bankLines', cap: 10000 },
} as const;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What the checks read, in one string that changes when anything is added, changed or deleted: how
 * many rows and when the newest change was. Equal to the last check's: nothing to check again.
 */
async function booksFingerprint(db: Firestore, workspaceId: string): Promise<string> {
  const parts = Object.values(SOURCES).map(s => `select count(*) as n, max(updated_at) as at from public."${s.table}" where workspace_id = $1`);
  const { rows } = await db.pool.query(`select sum(n)::bigint as n, max(at) as at from (${parts.join(' union all ')}) changes`, [workspaceId]);
  const at = rows[0]?.at as Date | null;
  return `${rows[0]?.n || 0}:${at ? new Date(at).toISOString() : ''}`;
}

/** Runs the checks on one workspace, keeps the result and tells about new serious problems. */
export async function checkLedgerHealth(db: Firestore, workspaceId: string, now = new Date()): Promise<{ problems: number; newProblems: number } | null> {
  const wsRef = db.collection('workspaces').doc(workspaceId);
  const ws = (await wsRef.get()).data();
  if (!ws || ws.deletedAt) return null;
  const fingerprint = await booksFingerprint(db, workspaceId);
  const loaded = await Promise.all(Object.entries(SOURCES).map(async ([key, s]) => {
    const snap = await db.collection(s.table).where('workspaceId', '==', workspaceId).limit(s.cap).get();
    return [key, snap.docs.map(d => ({ ...d.data(), id: d.id }))] as const;
  }));
  const data = Object.fromEntries(loaded) as unknown as Omit<CheckContext, 'today' | 'baseCurrency'>;
  const today = formatTzDate(now, typeof ws.timezone === 'string' ? ws.timezone : 'UTC');
  const findings = runDataChecks({ ...data, today, baseCurrency: String(ws.currency || 'USD') });
  const fresh = newSeriousProblems(findings, ws.ledgerHealth as LedgerHealth | undefined);
  const summary = healthSummary(findings, now.toISOString(), fingerprint);
  await wsRef.update({ ledgerHealth: summary });
  if (fresh.length) {
    const notice = problemNotice(fresh);
    await notify(db, {
      workspaceId, kind: 'health.problem', title: notice.title, message: notice.message,
      eventKey: `health:${today}:${fresh.map(f => f.id).sort().join(',').slice(0, 150)}`, workspace: ws,
    });
  }
  return { problems: findings.length, newProblems: fresh.length };
}

/** The nightly run: workspaces whose books changed since their last check, oldest check first. */
export async function runLedgerHealthMonitor(
  db: Firestore,
  opts: { now?: Date; budgetMs?: number; workspaceIds?: string[] } = {},
): Promise<{ checked: number; notified: number; left: number }> {
  const { now = new Date(), budgetMs = 60_000 } = opts;
  const started = Date.now();
  const workspaces = opts.workspaceIds
    ? { docs: (await Promise.all(opts.workspaceIds.map(id => db.collection('workspaces').doc(id).get()))).filter(d => d.exists) }
    : await db.collection('workspaces').get();
  const due: Array<{ id: string; checkedAt: string }> = [];
  for (const doc of workspaces.docs) {
    const ws = doc.data();
    if (!ws || ws.deletedAt) continue;
    const last = ws.ledgerHealth as LedgerHealth | undefined;
    const checkedAt = String(last?.checkedAt || '');
    // checked within the week and nothing added, changed or deleted since: nothing to do
    if (checkedAt && now.getTime() - new Date(checkedAt).getTime() < WEEK_MS && last?.fingerprint === await booksFingerprint(db, doc.id)) continue;
    due.push({ id: doc.id, checkedAt });
  }
  due.sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  let checked = 0;
  let notified = 0;
  for (const { id } of due) {
    if (Date.now() - started > budgetMs) break;
    try {
      const result = await checkLedgerHealth(db, id, now);
      if (result) { checked++; if (result.newProblems) notified++; }
    } catch (err) {
      logger.warn('ledger health check failed', { workspaceId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { checked, notified, left: due.length - checked };
}

export async function runDailyLedgerHealth() {
  const { getDb } = await import('../db/firestore');
  return runLedgerHealthMonitor(getDb());
}
