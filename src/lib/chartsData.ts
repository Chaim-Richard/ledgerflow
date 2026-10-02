import type { ChartAccount, Transaction } from '../types';
import { isCashAccount, isExpenseAccount, isPostable, isRevenueAccount, lineAmount } from './txFilters';

/**
 * Numbers for the Charts screen (FinancialChartsDashboard), all in cents of the base currency.
 * Posted entries only (isPostable); each line counts with its sign (lineAmount: debit +, credit −),
 * so a reversal cancels what it reverses. Revenue grows with credits to income accounts, expenses
 * with debits to expense accounts. Nothing is made up when there is no data (L-155).
 */
export interface ChartsMonth { month: string; revenueCents: number; expenseCents: number; profitCents: number }
export interface ChartsData {
  months: ChartsMonth[];
  cash: Array<{ id: string; name: string; cents: number }>;
  expenses: Array<{ name: string; cents: number }>;
  totalCashCents: number;
  avgBurnCents: number;
  /** months of cash at the average burn; null when there is no cash or no spending */
  runwayMonths: number | null;
}

export function computeChartsData(transactions: Transaction[], accounts: ChartAccount[], monthCount: 6 | 12): ChartsData {
  const byId = new Map(accounts.map(a => [a.id, a]));
  const months = new Map<string, ChartsMonth>();
  const balance = new Map<string, number>();

  for (const tx of transactions) {
    if (!isPostable(tx)) continue;
    const month = (tx.date || '').slice(0, 7);
    for (const line of tx.lines || []) {
      const cents = lineAmount(line, tx);
      if (line.accountId) balance.set(line.accountId, (balance.get(line.accountId) || 0) + cents);
      const account = line.accountId ? byId.get(line.accountId) : undefined;
      if (!month || !account) continue;
      const revenue = isRevenueAccount(account);
      const expense = isExpenseAccount(account);
      if (!revenue && !expense) continue;
      const m = months.get(month) || { month, revenueCents: 0, expenseCents: 0, profitCents: 0 };
      if (revenue) m.revenueCents -= cents;
      else m.expenseCents += cents;
      months.set(month, m);
    }
  }

  const shown = [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-monthCount)
    .map(m => ({ ...m, profitCents: m.revenueCents - m.expenseCents }));
  const shownMonths = new Set(shown.map(m => m.month));

  const cashAccounts = accounts.filter(a => isCashAccount(a));
  const totalCashCents = cashAccounts.reduce((sum, a) => sum + (balance.get(a.id) || 0), 0);
  const cash = cashAccounts
    .map(a => ({ id: a.id, name: a.name, cents: balance.get(a.id) || 0 }))
    .filter(c => c.cents > 0);

  // expense mix over the months shown
  const inShown = new Map<string, number>();
  for (const tx of transactions) {
    if (!isPostable(tx) || !shownMonths.has((tx.date || '').slice(0, 7))) continue;
    for (const line of tx.lines || []) {
      const account = line.accountId ? byId.get(line.accountId) : undefined;
      if (account && isExpenseAccount(account)) inShown.set(account.name, (inShown.get(account.name) || 0) + lineAmount(line, tx));
    }
  }
  const expenses = [...inShown.entries()]
    .map(([name, cents]) => ({ name, cents }))
    .filter(e => e.cents > 0)
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 6);

  const avgBurnCents = shown.length ? Math.round(shown.reduce((s, m) => s + m.expenseCents, 0) / shown.length) : 0;
  const runwayMonths = totalCashCents > 0 && avgBurnCents > 0 ? Math.round((totalCashCents / avgBurnCents) * 10) / 10 : null;
  return { months: shown, cash, expenses, totalCashCents, avgBurnCents, runwayMonths };
}
