/**
 * The Practice view (BD-01, src/lib/practice.ts): for each workspace the person can open (owner or
 * member), what is waiting there. Each count is one query over only those workspaces' own rows,
 * grouped by workspace; a table the database doesn't have yet counts nothing.
 */
import type { Firestore } from '../db/firestore';
import { openable } from './workspaceGroupService';
import { monthCloseState, workspaceRole, type PeriodLockSettings } from '../../lib/periodLock';
import { monthBefore, sortPractice, type PracticeRow } from '../../lib/practice';
import type { LedgerHealth } from '../../lib/ledgerHealth';

export async function practiceRows(db: Firestore, uid: string, today: string): Promise<PracticeRow[]> {
  const ids = [...(await openable(db, uid))];
  if (ids.length === 0) return [];
  const existing = await db.tables();
  const counts = async (table: string, where: string): Promise<Map<string, number>> => {
    if (!existing.has(table)) return new Map();
    const { rows } = await db.pool.query(`select workspace_id as id, count(*)::int as n from public."${table}" where workspace_id = any($1) and ${where} group by 1`, [ids]);
    return new Map(rows.map(r => [String(r.id), Number(r.n)]));
  };
  const bankLines = await counts('bankLines', `data->>'status' = 'pending'`);
  const bankLogins = await counts('banks', `data->>'status' = 'login_required'`);
  const questions = await counts('clientQueries', `data->>'status' = 'open'`);
  const drafts = [await counts('transactions', `data->>'status' = 'draft'`), await counts('invoices', `data->>'status' = 'draft'`), await counts('bills', `data->>'status' = 'draft'`)];
  const next = new Map<string, { date: string; description: string }>();
  if (existing.has('recurring')) {
    const { rows } = await db.pool.query(
      `select distinct on (workspace_id) workspace_id as id, data->>'nextOccurrence' as date, data->>'description' as description from public.recurring
       where workspace_id = any($1) and coalesce(data->>'isActive', 'true') <> 'false' and coalesce(data->>'status', 'active') = 'active' and data->>'nextOccurrence' is not null
       order by workspace_id, data->>'nextOccurrence'`, [ids]);
    for (const r of rows) next.set(String(r.id), { date: String(r.date).slice(0, 10), description: String(r.description || '') });
  }
  const groups = new Map<string, string[]>();
  for (const d of (await db.collection('workspaceGroups').where('ownerUid', '==', uid).get()).docs) {
    const g = d.data() || {};
    for (const id of (Array.isArray(g.workspaceIds) ? g.workspaceIds as string[] : [])) groups.set(id, [...(groups.get(id) || []), String(g.name || '')]);
  }
  const lastMonth = monthBefore(today);
  const snaps = await db.getAll(...ids.map(id => db.collection('workspaces').doc(id)));
  return sortPractice(snaps.filter(s => s.exists).map(s => {
    const ws = (s.data() || {}) as PeriodLockSettings & { name?: string; currency?: string; ledgerHealth?: LedgerHealth };
    const health = ws.ledgerHealth?.checkedAt ? { serious: Number(ws.ledgerHealth.counts?.high) || 0, warnings: Number(ws.ledgerHealth.counts?.medium) || 0, checkedAt: String(ws.ledgerHealth.checkedAt) } : null;
    const id = s.id;
    return {
      workspaceId: id, name: String(ws.name || id), role: workspaceRole(ws, uid), currency: String(ws.currency || 'USD'), groups: groups.get(id) || [],
      bankLines: bankLines.get(id) || 0, bankLogins: bankLogins.get(id) || 0, questions: questions.get(id) || 0,
      drafts: drafts.reduce((sum, m) => sum + (m.get(id) || 0), 0),
      lastMonth, lastMonthClosed: ['hard', 'soft'].includes(monthCloseState(lastMonth, ws)),
      nextRecurring: next.get(id) || null,
      health,
    };
  }));
}
