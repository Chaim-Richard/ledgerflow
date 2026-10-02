/**
 * Opening balances (L-19): the balances a business brings in when it starts using LedgerFlow,
 * posted as one journal entry on the start date. Each balance is entered on its account's normal
 * side (assets as debits; liabilities and equity as credits; contra accounts the other way), and
 * whatever doesn't balance goes to Opening Balance Equity, so the trial balance balances by
 * construction. Receivables and payables are left out: their opening amounts come from the unpaid
 * invoices and bills themselves, so customers' and vendors' balances stay right.
 * Shared by the server (posting) and the setup wizard (the live difference).
 */
import type { ChartAccount, TransactionLine } from '../types';
import { resolveAccountRole } from './accountUtils';

export const OPENING_BALANCE_TYPE = 'opening-balance';
export const MAX_OPENING_CENTS = 1e13;

export const isOpeningBalanceEquity = (a: ChartAccount) => resolveAccountRole(a) === 'equity' && /opening balance/i.test(a.name || '');

/** Accounts that take an opening balance in the wizard: the balance sheet, less receivables/payables. */
export function openingBalanceAccounts(accounts: ChartAccount[]): ChartAccount[] {
  return accounts.filter(a => {
    if (a.isArchived || isOpeningBalanceEquity(a)) return false;
    const role = resolveAccountRole(a);
    return role === 'cash' || role === 'asset' || role === 'inventory' || role === 'liability' || role === 'equity';
  });
}

/** +1 when the account's balance is a debit, −1 when it is a credit. */
export function normalSign(account: ChartAccount): 1 | -1 {
  const role = resolveAccountRole(account);
  const debit = role === 'cash' || role === 'asset' || role === 'inventory' || role === 'ar';
  const contra = Boolean((account as ChartAccount & { isContra?: boolean }).isContra);
  return debit !== contra ? 1 : -1;
}

export interface OpeningEntry {
  lines: TransactionLine[];
  /** What goes to Opening Balance Equity: positive = credit (the business's net worth). */
  equityCents: number;
  debitsCents: number;
  creditsCents: number;
}

/**
 * The entry for `balances` (accountId → cents on the account's normal side; a negative amount is
 * the unusual side, e.g. an overdrawn bank). Throws on an account that can't take one.
 */
export function openingEntry(accounts: ChartAccount[], balances: Array<{ accountId: string; amountCents: number }>, equity: ChartAccount): OpeningEntry {
  const eligible = new Map(openingBalanceAccounts(accounts).map(a => [a.id, a]));
  const lines: TransactionLine[] = [];
  const seen = new Set<string>();
  for (const b of balances) {
    if (!Number.isSafeInteger(b.amountCents) || Math.abs(b.amountCents) > MAX_OPENING_CENTS) throw new Error('Opening balances must be whole cents');
    if (b.amountCents === 0) continue;
    if (seen.has(b.accountId)) throw new Error('Each account can have one opening balance');
    seen.add(b.accountId);
    const account = eligible.get(b.accountId);
    if (!account) throw new Error('This account cannot take an opening balance here (receivables and payables come from unpaid invoices and bills)');
    lines.push({ accountId: account.id, accountName: account.name, amountCents: normalSign(account) * b.amountCents, description: 'Opening balance' });
  }
  const net = lines.reduce((s, l) => s + l.amountCents, 0);
  if (net !== 0) lines.push({ accountId: equity.id, accountName: equity.name, amountCents: -net, description: 'Opening balance difference' });
  const debitsCents = lines.reduce((s, l) => s + Math.max(0, l.amountCents), 0);
  const creditsCents = lines.reduce((s, l) => s + Math.max(0, -l.amountCents), 0);
  return { lines, equityCents: net, debitsCents, creditsCents };
}
