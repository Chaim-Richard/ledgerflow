import type { Budget, ChartAccount, Transaction } from '../types';
import { computeGeneralLedger } from '../server/reports/computeReports';
import { splitReportPeriods, type ReportPeriod } from './reportColumns';

export type SavedBudget = Budget & { name?: string; startDate?: string };
/** Saved objectives are flat monthly/quarterly/yearly caps, not daily accrual schedules.
 * Month columns divide quarter/year caps evenly; remainder cents stay in the last month.
 * Partial months retain their monthly cap. Dated annual/month budgets use that calendar period.
 */
export function budgetMonthAmount(budget: SavedBudget, month: string): number {
  const dated = /^\d{4}(-\d{2})?$/.test(budget.period);
  if (dated && !month.startsWith(budget.period)) return 0;
  const start = budget.startDate?.slice(0, 7) || budget.createdAt.slice(0, 7);
  if (!dated && (!/^\d{4}-\d{2}$/.test(start) || month < start)) return 0;
  const months = budget.period === 'yearly' || /^\d{4}$/.test(budget.period) ? 12 : budget.period === 'quarterly' ? 3 : budget.period === 'monthly' || /^\d{4}-\d{2}$/.test(budget.period) ? 1 : 0;
  if (!months || !Number.isSafeInteger(budget.amountCents)) return 0;
  const origin = dated ? budget.period.slice(0, 4) + '-01' : start;
  const index = (Number(month.slice(0, 4)) - Number(origin.slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(origin.slice(5, 7));
  const base = Math.trunc(budget.amountCents / months);
  return base + (index % months === months - 1 ? budget.amountCents - base * months : 0);
}

export function computeBudgetActual(budget: SavedBudget, accounts: ChartAccount[], transactions: Transaction[], periods: ReportPeriod[]) {
  if (budget.targetType !== 'account' || typeof budget.targetId !== 'string') return null;
  const matches = accounts.filter(a => a.id === budget.targetId || a.name.toLocaleLowerCase() === budget.targetId.toLocaleLowerCase() || a.code?.toLocaleLowerCase() === budget.targetId.toLocaleLowerCase());
  const account = matches.find(a => a.id === budget.targetId) || (matches.length === 1 ? matches[0] : undefined);
  if (!account) return null;
  return { account, columns: periods.map(period => {
    const ledger = computeGeneralLedger([account], transactions, period.startDate, period.endDate, account.id).accounts[0];
    const actualCents = ledger.endingBalanceCents - ledger.openingBalanceCents;
    const budgetCents = splitReportPeriods(period.startDate, period.endDate, 'months').reduce((sum, month) => sum + budgetMonthAmount(budget, month.startDate.slice(0, 7)), 0);
    // Adapt account impacts for the existing modal without passing unrelated journal totals.
    const byId = new Map<string, Transaction>();
    const debitNormal = ['asset', 'expense', 'cost_of_goods'].includes(account.type);
    for (const entry of ledger.entries) {
      const impact = (entry.debitCents - entry.creditCents) * (debitNormal ? 1 : -1);
      const existing = byId.get(entry.transactionId);
      if (existing) { existing.lines[0].amountCents += impact; existing.totalAmountCents = Math.abs(existing.lines[0].amountCents); }
      else {
        const original = transactions.find(tx => tx.id === entry.transactionId)!;
        byId.set(entry.transactionId, { ...original, lines: [{ accountId: account.id, accountName: account.name, amountCents: impact }], totalAmountCents: Math.abs(impact) });
      }
    }
    return { period, budgetCents, actualCents, differenceCents: budgetCents - actualCents, percentUsed: budgetCents ? actualCents / budgetCents * 100 : null, drillTransactions: [...byId.values()] };
  }) };
}
