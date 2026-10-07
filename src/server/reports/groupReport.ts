/**
 * The group summary (Z-20, first step of the multi-entity design Z-16): for one of the person's
 * groups of books (DA-01) and a period, each member's profit and loss and balance sheet side by side,
 * and the group's total when all members keep their books in the same currency. Each member is read
 * under the person's own access, never copied into another ledger; members the person can no longer
 * open are not included, and the answer says how many. Every figure is the member's own report, so it
 * can be opened in its own books.
 *
 * Translation (Z-17, Z-18): with a reporting currency, each member in another currency is translated
 * with the rates given for it (1 unit of its currency in the reporting currency): the closing rate
 * at the end date for assets and liabilities, the period's average rate for its income and costs,
 * and the historical rate for its equity and the profit of earlier periods. The difference that
 * leaves is the translation difference (CTA), shown on its own line so the group still balances.
 * Rates are never invented: a missing one is refused.
 */
import type { Firestore } from '../db/firestore';
import { openable } from '../services/workspaceGroupService';
import { computeBalanceSheet, computeProfitAndLoss } from './computeReports';
import type { ChartAccount, Transaction } from '../../types';

export class GroupReportError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'GroupReportError';
  }
}

export interface GroupFigures {
  income: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  /** equity accounts and the profit not yet closed into them */
  totalEquity: number;
}

export interface TranslationRates {
  /** at the end date: assets and liabilities */
  closing: number;
  /** over the period: income and costs */
  average: number;
  /** when the equity was put in: equity and earlier profit */
  historical: number;
}

export interface GroupMember extends GroupFigures {
  workspaceId: string;
  name: string;
  currency: string;
  isBalanced: boolean;
  /** in the reporting currency, when one was asked for */
  translated?: GroupFigures & { cta: number; rates: TranslationRates | null };
}

export interface GroupSummary {
  group: { id: string; name: string };
  startDate: string;
  endDate: string;
  members: GroupMember[];
  /** the group's total: in the reporting currency, or when every member uses the same currency */
  total: (GroupFigures & { currency: string; cta: number }) | null;
  /** members of the group this person can no longer open (left out) */
  notIncluded: number;
}

const FIGURES: Array<keyof GroupFigures> = ['income', 'cogs', 'grossProfit', 'expense', 'netIncome', 'totalAssets', 'totalLiabilities', 'totalEquity'];

async function memberFigures(db: Firestore, workspaceId: string, startDate: string, endDate: string): Promise<GroupMember & { earlierProfit: number; equityAccounts: number }> {
  const ws = (await db.collection('workspaces').doc(workspaceId).get()).data() || {};
  const accounts = (await db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get()).docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount);
  const transactions = (await db.collection('transactions').where('workspaceId', '==', workspaceId).where('date', '<=', endDate).get()).docs
    .map(d => ({ ...d.data(), id: d.id }) as Transaction);
  const pl = computeProfitAndLoss(accounts, transactions, startDate, endDate);
  const bs = computeBalanceSheet(accounts, transactions, endDate);
  return {
    workspaceId,
    name: String(ws.name || workspaceId),
    currency: String(ws.currency || 'USD'),
    income: pl.income.total,
    cogs: pl.cogs.total,
    grossProfit: pl.grossProfit,
    expense: pl.expense.total,
    netIncome: pl.netIncome,
    totalAssets: bs.totalAssets,
    totalLiabilities: bs.totalLiabilities,
    totalEquity: bs.totalEquity + bs.netIncome,
    isBalanced: bs.isBalanced,
    equityAccounts: bs.totalEquity,
    // profit before the period that is not closed into equity yet
    earlierProfit: bs.netIncome - pl.netIncome,
  };
}

const ratesProblem = (currency: string, r: TranslationRates | undefined) =>
  !r || ![r.closing, r.average, r.historical].every(x => Number.isFinite(x) && x > 0)
    ? `Enter the closing, average and historical rates for ${currency} (1 ${currency} in the reporting currency)`
    : null;

/** One member's figures in the reporting currency (whole cents), and its translation difference. */
export function translate(m: GroupFigures & { equityAccounts: number; earlierProfit: number }, r: TranslationRates | null): GroupFigures & { cta: number } {
  const at = (cents: number, rate: number) => Math.round(cents * rate);
  if (!r) return { income: m.income, cogs: m.cogs, grossProfit: m.grossProfit, expense: m.expense, netIncome: m.netIncome, totalAssets: m.totalAssets, totalLiabilities: m.totalLiabilities, totalEquity: m.totalEquity, cta: 0 };
  const income = at(m.income, r.average);
  const cogs = at(m.cogs, r.average);
  const expense = at(m.expense, r.average);
  const netIncome = at(m.netIncome, r.average);
  const totalAssets = at(m.totalAssets, r.closing);
  const totalLiabilities = at(m.totalLiabilities, r.closing);
  const equity = at(m.equityAccounts + m.earlierProfit, r.historical) + netIncome;
  const cta = totalAssets - totalLiabilities - equity;
  return { income, cogs, grossProfit: income - cogs, expense, netIncome, totalAssets, totalLiabilities, totalEquity: equity + cta, cta };
}

export async function groupSummary(db: Firestore, input: { uid: string; groupId: string; startDate: string; endDate: string; reportCurrency?: string; rates?: Record<string, TranslationRates> }): Promise<GroupSummary> {
  if (input.startDate > input.endDate) throw new GroupReportError(400, 'The period starts after it ends');
  const snap = await db.collection('workspaceGroups').doc(input.groupId).get();
  const group = snap.data();
  // someone else's group answers like a missing one
  if (!group || group.ownerUid !== input.uid) throw new GroupReportError(404, 'Group not found');
  const open = await openable(db, input.uid);
  const ids = (Array.isArray(group.workspaceIds) ? group.workspaceIds as string[] : []);
  const shown = ids.filter(id => open.has(id));
  const read: Array<GroupMember & { earlierProfit: number; equityAccounts: number }> = [];
  for (const id of shown) read.push(await memberFigures(db, id, input.startDate, input.endDate));
  const reportCurrency = input.reportCurrency;
  if (reportCurrency) {
    for (const currency of new Set(read.map(m => m.currency).filter(c => c !== reportCurrency))) {
      const problem = ratesProblem(currency, input.rates?.[currency]);
      if (problem) throw new GroupReportError(400, problem);
    }
  }
  const members: GroupMember[] = read.map(({ earlierProfit, equityAccounts, ...m }) => {
    if (!reportCurrency) return m;
    const rates = m.currency === reportCurrency ? null : input.rates![m.currency];
    return { ...m, translated: { ...translate({ ...m, earlierProfit, equityAccounts }, rates), rates } };
  });
  const currencies = new Set(members.map(m => m.currency));
  const sum = (figures: Array<GroupFigures & { cta: number }>, currency: string) => ({
    currency,
    ...Object.fromEntries([...FIGURES, 'cta' as const].map(f => [f, figures.reduce((s, x) => s + x[f], 0)])) as unknown as GroupFigures & { cta: number },
  });
  const total = members.length === 0 ? null
    : reportCurrency ? sum(members.map(m => m.translated!), reportCurrency)
      : currencies.size === 1 ? sum(members.map(m => ({ ...m, cta: 0 })), members[0].currency) : null;
  return { group: { id: snap.id, name: String(group.name || '') }, startDate: input.startDate, endDate: input.endDate, members, total, notIncluded: ids.length - shown.length };
}
