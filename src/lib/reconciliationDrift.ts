/**
 * Reconciliation discrepancies (S-07): after a bank account is reconciled to a statement, the books
 * on the statement date should not move. The nightly check (src/server/services/ledgerHealthService.ts)
 * keeps, for each account's latest reconciliation, the difference between the books on the
 * statement date and the statement balance as first seen (outstanding cheques and deposits make it
 * non-zero, and that is fine); when that difference changes, an entry in the reconciled period was
 * added, changed, voided or deleted, and owners and accountants are told.
 */
import type { ChartAccount, Transaction } from '../types';
import { balancesAsOf } from './closingSnapshot';

export interface ReconciliationRecord {
  id: string;
  accountId?: string;
  accountName?: string;
  statementDate?: string;
  statementBalanceCents?: number;
}

export interface Drift {
  reconciliationId: string;
  account: ChartAccount;
  statementDate: string;
  thenCents: number;
  nowCents: number;
}

/** Each account's latest reconciliation (by statement date). */
export function latestReconciliations(reconciliations: ReconciliationRecord[], accounts: ChartAccount[]): Array<{ rec: ReconciliationRecord; account: ChartAccount }> {
  const latest = new Map<string, { rec: ReconciliationRecord; account: ChartAccount }>();
  for (const rec of reconciliations) {
    const account = accounts.find(a => a.id === rec.accountId) || accounts.find(a => !rec.accountId && a.name === rec.accountName);
    if (!account || !rec.statementDate || typeof rec.statementBalanceCents !== 'number') continue;
    const seen = latest.get(account.id);
    if (!seen || String(rec.statementDate) > String(seen.rec.statementDate)) latest.set(account.id, { rec, account });
  }
  return [...latest.values()];
}

/**
 * The books minus the statement on each latest statement date, against what was kept: the new
 * baselines to keep, and the reconciliations whose difference moved since.
 */
export function reconciliationDrift(
  accounts: ChartAccount[], transactions: Transaction[], reconciliations: ReconciliationRecord[], kept: Record<string, number> = {},
): { baselines: Record<string, number>; drifted: Drift[] } {
  const baselines: Record<string, number> = {};
  const drifted: Drift[] = [];
  for (const { rec, account } of latestReconciliations(reconciliations, accounts)) {
    const date = String(rec.statementDate).slice(0, 10);
    const books = balancesAsOf([account], transactions, date).balances[account.id] || 0;
    const now = books - (rec.statementBalanceCents as number);
    baselines[rec.id] = now;
    if (rec.id in kept && kept[rec.id] !== now) drifted.push({ reconciliationId: rec.id, account, statementDate: date, thenCents: kept[rec.id], nowCents: now });
  }
  return { baselines, drifted };
}
