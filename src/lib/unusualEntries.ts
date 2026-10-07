/**
 * Unusual entries (S-17): an entry from the last two weeks that is far bigger than what its account
 * usually sees, told to owners and accountants by the nightly check (once per entry). "Far bigger":
 * at least 3 times the account's usual (median) amount and bigger than any amount on it before, with
 * at least 5 earlier amounts to compare and at least 100.00. Bank and cash accounts are left out
 * (every entry passes through them); amounts are compared in the books' currency.
 */
import type { ChartAccount, Transaction } from '../types';
import { isCashAccount, isPostable, lineAmount } from './txFilters';
import { addDaysYMD } from './fiscalCalendar';

export const UNUSUAL_FACTOR = 3;
export const UNUSUAL_MIN_HISTORY = 5;
export const UNUSUAL_MIN_CENTS = 10_000;
export const UNUSUAL_RECENT_DAYS = 14;

export interface UnusualEntry { transaction: Transaction; account: ChartAccount; amountCents: number; usualCents: number }

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export function unusualEntries(transactions: Transaction[], accounts: ChartAccount[], today: string): UnusualEntry[] {
  const watched = new Map(accounts.filter(a => !isCashAccount(a)).map(a => [a.id, a]));
  const since = addDaysYMD(today, -UNUSUAL_RECENT_DAYS);
  // each account's amounts, oldest first (by date, then id for a stable order)
  const entries = transactions.filter(isPostable).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));
  const history = new Map<string, number[]>();
  const found: UnusualEntry[] = [];
  for (const tx of entries) {
    const date = String(tx.date || '').slice(0, 10);
    const perAccount = new Map<string, number>();
    for (const l of tx.lines || []) {
      if (l?.accountId && watched.has(l.accountId)) perAccount.set(l.accountId, (perAccount.get(l.accountId) || 0) + Math.abs(lineAmount(l, tx)));
    }
    let worst: UnusualEntry | null = null;
    for (const [accountId, amount] of perAccount) {
      const before = history.get(accountId) || [];
      if (date >= since && date <= today && before.length >= UNUSUAL_MIN_HISTORY && amount >= UNUSUAL_MIN_CENTS) {
        const usual = median(before);
        if (amount >= UNUSUAL_FACTOR * usual && amount > Math.max(...before) && (!worst || amount / Math.max(usual, 1) > worst.amountCents / Math.max(worst.usualCents, 1))) {
          worst = { transaction: tx, account: watched.get(accountId)!, amountCents: amount, usualCents: usual };
        }
      }
      history.set(accountId, [...before, amount]);
    }
    if (worst) found.push(worst);
  }
  return found;
}
