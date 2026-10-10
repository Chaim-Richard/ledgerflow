/**
 * Profit by label (CB-25): for one label (Property, Project, Location…) and a period, the income, cost
 * of goods sold, expenses and result of each of its values, and of the lines without one
 * ("Unassigned"), account by account. Each line belongs to exactly one value (`getLineDimension`, the
 * same reading as the drill-down's label filter), and each value is calculated with the profit and
 * loss's own code, so the columns add back to the profit and loss of the same period.
 */
import type { ChartAccount, Transaction } from '../../types';
import { getLineDimension } from '../../lib/dimensionUtils';
import { computeProfitAndLoss } from './computeReports';

export const UNASSIGNED = 'Unassigned';
type Section = 'income' | 'cogs' | 'expense';
const SECTIONS: Section[] = ['income', 'cogs', 'expense'];

export interface LabelColumn {
  value: string;
  income: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  netIncome: number;
  /** each account's figure in this column (zero left out) */
  accounts: Record<string, number>;
}

export interface LabelReport {
  dimensionId: string;
  startDate: string;
  endDate: string;
  /** the values in order, "Unassigned" last */
  columns: LabelColumn[];
  /** the profit and loss of the period, which the columns add up to */
  total: Omit<LabelColumn, 'value'>;
  /** the accounts with a figure, by section */
  rows: Array<{ id: string; name: string; code?: string; section: Section }>;
}

const column = (value: string, pl: ReturnType<typeof computeProfitAndLoss>): LabelColumn => ({
  value, income: pl.income.total, cogs: pl.cogs.total, grossProfit: pl.grossProfit, expense: pl.expense.total, netIncome: pl.netIncome,
  accounts: Object.fromEntries(SECTIONS.flatMap(s => Object.entries(pl[s].accounts).filter(([, a]) => a.balance !== 0).map(([id, a]) => [id, a.balance]))),
});

export function profitByLabel(accounts: ChartAccount[], transactions: Transaction[], dimensionId: string, startDate: string, endDate: string): LabelReport {
  // each entry split into one copy per value, holding only that value's lines
  const byValue = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const date = String(tx.date || '').slice(0, 10);
    if (date < startDate || date > endDate) continue;
    const parts = new Map<string, NonNullable<Transaction['lines']>>();
    for (const line of tx.lines || []) {
      const value = getLineDimension(line, tx, dimensionId) || UNASSIGNED;
      parts.set(value, [...(parts.get(value) || []), line]);
    }
    for (const [value, lines] of parts) byValue.set(value, [...(byValue.get(value) || []), { ...tx, lines }]);
  }
  const all = computeProfitAndLoss(accounts, transactions, startDate, endDate);
  const columns = [...byValue.entries()]
    .map(([value, txs]) => column(value, computeProfitAndLoss(accounts, txs, startDate, endDate)))
    // a value with nothing on the profit and loss (only balance sheet lines) is left out
    .filter(c => Object.keys(c.accounts).length > 0)
    .sort((a, b) => (a.value === UNASSIGNED ? 1 : b.value === UNASSIGNED ? -1 : a.value.localeCompare(b.value, undefined, { numeric: true })));
  const { value: _v, ...total } = column('', all);
  const rows = SECTIONS.flatMap(section => Object.entries(all[section].accounts)
    .filter(([id]) => columns.some(c => c.accounts[id]))
    .map(([id, a]) => ({ id, name: a.name, ...(a.code ? { code: a.code } : {}), section }))
    .sort((a, b) => (a.code || '￿').localeCompare(b.code || '￿', undefined, { numeric: true }) || a.name.localeCompare(b.name)));
  return { dimensionId, startDate, endDate, columns, total, rows };
}
