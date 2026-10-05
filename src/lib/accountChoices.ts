import type { ChartAccount, Transaction } from '../types';
import { resolveAccountRole } from './accountUtils';

export interface AccountChoice { value: string; label: string }

const cache = new WeakMap<ChartAccount[], WeakMap<Transaction[], AccountChoice[]>>();

/**
 * Accounts to pick a category from (I-23): active, not bank/cash, the ones used most first (then
 * by code). Cached per accounts/transactions list, so every row of a long list shares one sort.
 */
export function categoryChoices(accounts: ChartAccount[], transactions: Transaction[]): AccountChoice[] {
  let byTx = cache.get(accounts);
  if (!byTx) { byTx = new WeakMap(); cache.set(accounts, byTx); }
  const hit = byTx.get(transactions);
  if (hit) return hit;
  const uses = new Map<string, number>();
  for (const tx of transactions) for (const line of tx.lines || []) uses.set(line.accountId, (uses.get(line.accountId) || 0) + 1);
  const choices = accounts
    .filter(a => !a.isArchived && a.isActive !== false && resolveAccountRole(a) !== 'cash')
    .sort((a, b) => (uses.get(b.id) || 0) - (uses.get(a.id) || 0) || String(a.code || '').localeCompare(String(b.code || '')) || a.name.localeCompare(b.name))
    .map(a => ({ value: a.id, label: a.code ? `${a.code} · ${a.name}` : a.name }));
  byTx.set(transactions, choices);
  return choices;
}

/** The one category line of a plain entry (one bank/cash line and one other line), else undefined. */
export function soleCategoryLine(tx: Transaction, accounts: ChartAccount[]) {
  const lines = tx.lines || [];
  if (lines.length !== 2) return undefined;
  const isCash = (accountId: string) => resolveAccountRole(accounts.find(a => a.id === accountId)) === 'cash';
  const cash = lines.filter(l => isCash(l.accountId));
  return cash.length === 1 ? lines.find(l => !isCash(l.accountId)) : undefined;
}

/**
 * Bulk categorize (K-06): the lines of an entry with a new category account and/or project.
 * Bank and cash lines never change account. Only plain entries (exactly one bank/cash line) get a
 * new account, on every other line; transfers and journal entries return null (skip them: which
 * line is "the category" is unknown). A project alone is set on every line.
 */
export function recategorizeLines<L extends { accountId: string; accountName?: string; project?: string }>(
  lines: L[], accounts: ChartAccount[], change: { accountId?: string; accountName?: string; project?: string },
): L[] | null {
  const wantsAccount = change.accountId !== undefined || change.accountName !== undefined;
  const isCash = (accountId: string) => resolveAccountRole(accounts.find(a => a.id === accountId)) === 'cash';
  if (wantsAccount && lines.filter(l => isCash(l.accountId)).length !== 1) return null;
  return lines.map(l => {
    const next = { ...l };
    if (wantsAccount && !isCash(l.accountId)) {
      if (change.accountId !== undefined) next.accountId = change.accountId;
      if (change.accountName !== undefined) next.accountName = change.accountName;
    }
    if (change.project !== undefined) next.project = change.project || undefined;
    return next;
  });
}
