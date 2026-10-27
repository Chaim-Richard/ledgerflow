import { z } from 'zod';

export const PACK_REPORTS = {
  pl: 'Profit and loss', bs: 'Balance sheet', ar: 'Receivables aging',
  tb: 'Trial balance', cf: 'Cash flow', ap: 'Payables aging',
  budget: 'Budget vs actual', stock: 'Stock on hand by age',
} as const;
export type PackReport = keyof typeof PACK_REPORTS;
export interface PackRow { id: string; label: string; cents: number; total?: boolean }
export interface PackSection { kind: PackReport; rows: PackRow[]; warnings: string[] }
const amount = z.number().int().safe();
const accounts = z.record(z.string(), z.object({ name: z.string(), code: z.string().optional(), balance: amount }));
const group = z.object({ total: amount, accounts });
const balances = z.record(z.string(), amount);
const plSchema = z.object({ income: group, cogs: group, expense: group, grossProfit: amount, netIncome: amount });
const bsSchema = z.object({ assets: balances, liabilities: balances, equity: balances, totalAssets: amount,
  totalLiabilities: amount, totalEquity: amount, netIncome: amount, totalClaims: amount, isBalanced: z.boolean(),
  orphanedLines: z.array(z.unknown()).optional() });
const agingSchema = z.object({ current: amount, '1-30': amount, '31-60': amount, '61-90': amount, '90+': amount, total: amount });
const tbSchema = z.object({ accounts: z.array(z.object({ name: z.string(), code: z.string().optional(), debit: amount, credit: amount, netSigned: amount })), totalDebit: amount, totalCredit: amount, isBalanced: z.boolean() });
const flowGroup = z.object({ total: amount, inflow: amount, outflow: amount, items: z.array(z.object({ name: z.string(), amount })) });
const cfSchema = z.object({ operating: flowGroup, investing: flowGroup, financing: flowGroup, netChange: amount });
/** C-84: the budget screen's own answer (GET /reports/budget-vs-actual), in cents, one month */
const budgetSchema = z.array(z.object({ accountName: z.string(), budget: amount, actual: amount, variance: amount, percent: z.number() }));
/** C-84: the stock screen's own answer (GET /reports/stock-aging); quantity is units, the value is money */
const stockSchema = z.object({ asOf: z.string(), items: z.array(z.object({
  itemName: z.string(), quantity: z.number(), valueCents: amount, unknownAge: z.number().optional(),
})) });

/** Presentation only: preserve the single-report server totals, never reconstruct financial history. */
export function packSection(kind: PackReport, input: unknown, names: Record<string, string>): PackSection {
  const rows: PackRow[] = [], warnings: string[] = [];
  const row = (label: string, cents: number, total = false) => rows.push({ id: `${rows.length}:${label}`, label, cents, total });
  if (kind === 'pl') {
    const data = plSchema.parse(input);
    for (const [key, title] of [['income', 'Income'], ['cogs', 'Cost of goods'], ['expense', 'Expenses']] as const) {
      for (const account of Object.values(data[key].accounts)) row(`${account.code ? `${account.code} · ` : ''}${account.name}`, account.balance);
      row(`Total ${title.toLowerCase()}`, data[key].total, true);
    }
    row('Gross profit', data.grossProfit, true); row('Net income', data.netIncome, true);
  } else if (kind === 'bs') {
    const data = bsSchema.parse(input);
    for (const [key, total, label] of [['assets', 'totalAssets', 'Assets'], ['liabilities', 'totalLiabilities', 'Liabilities'], ['equity', 'totalEquity', 'Equity']] as const) {
      for (const [id, cents] of Object.entries(data[key])) row(`${label} · ${names[id] || id}`, cents);
      row(`Total ${label.toLowerCase()}`, data[total], true);
    }
    row('Current earnings', data.netIncome, true); row('Total liabilities and equity including earnings', data.totalClaims, true);
    if (!data.isBalanced) warnings.push('The balance sheet is not balanced.');
    if (data.orphanedLines?.length) warnings.push(`${data.orphanedLines.length} posting lines reference missing accounts.`);
  } else if (kind === 'ar' || kind === 'ap') {
    const data = agingSchema.parse(input);
    for (const key of ['current', '1-30', '31-60', '61-90', '90+'] as const) row(key === 'current' ? 'Not overdue' : `${key} days overdue`, data[key]);
    row('Total outstanding', data.total, true);
  } else if (kind === 'tb') {
    const data = tbSchema.parse(input);
    for (const account of data.accounts) {
      const name = `${account.code ? `${account.code} · ` : ''}${account.name}`;
      row(`${name} · Debit`, account.debit); row(`${name} · Credit`, account.credit);
    }
    row('Total debit', data.totalDebit, true); row('Total credit', data.totalCredit, true);
    if (!data.isBalanced) warnings.push('The trial balance is not balanced.');
  } else if (kind === 'budget') {
    const data = budgetSchema.parse(input);
    if (!data.length) warnings.push('No budgets are set for the month of this pack, so there is nothing to compare.');
    let budgetTotal = 0, actualTotal = 0, varianceTotal = 0, over = 0;
    for (const line of data) {
      row(`${line.accountName} · Budget`, line.budget);
      row(`${line.accountName} · Actual`, line.actual);
      row(`${line.accountName} · Variance`, line.variance);
      budgetTotal += line.budget; actualTotal += line.actual; varianceTotal += line.variance;
      if (line.variance < 0) over += 1;
    }
    if (data.length) {
      row('Total budget', budgetTotal, true); row('Total actual', actualTotal, true); row('Total variance', varianceTotal, true);
    }
    if (over) warnings.push(`${over} budget ${over === 1 ? 'line is' : 'lines are'} over budget for the month.`);
  } else if (kind === 'stock') {
    const data = stockSchema.parse(input);
    if (!data.items.length) warnings.push(`No item had stock on hand at ${data.asOf}.`);
    let total = 0, undated = 0;
    for (const item of data.items) {
      row(`${item.itemName} · ${item.quantity} units`, item.valueCents);
      total += item.valueCents;
      if ((item.unknownAge || 0) > 0) undated += 1;
    }
    if (data.items.length) row('Total stock on hand', total, true);
    if (undated) warnings.push(`${undated} ${undated === 1 ? 'item includes units' : 'items include units'} from before the stock history began, so their age is unknown.`);
  } else {
    const data = cfSchema.parse(input);
    for (const key of ['operating', 'investing', 'financing'] as const) {
      row(`${key} inflow`, data[key].inflow); row(`${key} outflow`, data[key].outflow);
      for (const item of data[key].items) row(item.name, item.amount);
      row(`Total ${key}`, data[key].total, true);
    }
    row('Net change in cash', data.netChange, true);
  }
  return { kind, rows, warnings };
}
export function packReportUrl(kind: PackReport, workspaceId: string, startDate: string, endDate: string): string {
  const query = new URLSearchParams({ workspaceId });
  const path = { pl: 'profit-and-loss', bs: 'balance-sheet', ar: 'aging', ap: 'aging', tb: 'trial-balance', cf: 'cash-flow', budget: 'budget-vs-actual', stock: 'stock-aging' }[kind];
  if (kind === 'ar' || kind === 'ap') query.set('type', kind);
  else if (kind === 'tb') query.set('asOfDate', endDate);
  // C-84: the budget report is one month at a time, so the pack asks for the month it ends in
  else if (kind === 'budget') query.set('month', endDate.slice(0, 7));
  else if (kind === 'stock') query.set('asOf', endDate);
  else { query.set('endDate', endDate); if (kind === 'pl' || kind === 'cf') query.set('startDate', startDate); }
  return `/api/v1/reports/${path}?${query}`;
}
