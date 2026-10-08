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
 *
 * Dealings between the companies (Z-19): an entry posted as intercompany (`metadata.isIntercompany`,
 * with the other company and its entry) needs its match there. Matched pairs are counted; the rest
 * are listed with why: the match is missing, was undone, or has another amount, or the other company
 * is outside the group (or not one the person can open).
 *
 * Eliminations (CB-26, Z-16 step 5): what the companies owe each other (balances on their
 * intercompany accounts: role 'intercompany', or "Intercompany" in the name) is taken out of the
 * group's total assets and liabilities. If the two sides differ, the difference is said, and kept in
 * equity so the total still balances.
 */
import type { Firestore } from '../db/firestore';
import { openable } from '../services/workspaceGroupService';
import { computeBalanceSheet, computeProfitAndLoss } from './computeReports';
import type { ChartAccount, Transaction } from '../../types';
import { isPostable } from '../../lib/txFilters';

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
  total: (GroupFigures & { currency: string; cta: number; eliminated: Eliminated }) | null;
  /** members of the group this person can no longer open (left out) */
  notIncluded: number;
  /** Z-19: dealings between the members in the period */
  intercompany: IntercompanySummary;
}

export interface Eliminated {
  /** owed to members by members, taken out of total assets */
  assets: number;
  /** owed by members to members, taken out of total liabilities */
  liabilities: number;
  /** assets − liabilities: what the two sides disagree on (kept in equity) */
  difference: number;
}

/** An account holding what a company owes or is owed by the others in its group. */
export const isIntercompanyAccount = (acc: Pick<ChartAccount, 'name'> & { role?: string }) => acc.role === 'intercompany' || /intercompany/i.test(acc.name || '');

export type IntercompanyReason = 'missing' | 'undone' | 'amount' | 'outside-group' | 'not-open';

export interface IntercompanyIssue {
  workspaceId: string;
  transactionId: string;
  date: string;
  description: string;
  amountCents: number;
  currency: string;
  withWorkspaceId: string;
  /** the other company's name, when it is in the group */
  withName: string | null;
  reason: IntercompanyReason;
  /** the other side's amount, when it differs */
  otherAmountCents?: number;
}

export interface IntercompanySummary {
  /** pairs found on both sides, in force, with the same amount */
  matched: number;
  unmatched: IntercompanyIssue[];
}

const inForce = (tx: Transaction) => isPostable(tx) && !tx.reversalEventId && !tx.metadata?.isReversal;

/**
 * Each intercompany entry in force, dated in the period, against its match in the other company.
 * `entries` are each member's intercompany entries up to the end date (a match may be dated earlier).
 */
export function matchIntercompany(members: Array<{ workspaceId: string; name: string; currency: string; entries: Transaction[] }>, open: Set<string>, startDate: string, endDate: string): IntercompanySummary {
  const byWorkspace = new Map(members.map(m => [m.workspaceId, m]));
  let matched = 0;
  const unmatched: IntercompanyIssue[] = [];
  for (const m of members) {
    for (const e of m.entries) {
      const date = String(e.date || '').slice(0, 10);
      if (!inForce(e) || date < startDate || date > endDate) continue;
      const meta = (e.metadata || {}) as Record<string, unknown>;
      const withWorkspaceId = String(meta.targetWorkspaceId || meta.sourceWorkspaceId || '');
      const otherId = String(meta.targetTxId || meta.sourceTxId || '');
      const other = byWorkspace.get(withWorkspaceId);
      const issue = (reason: IntercompanyReason, extra: Partial<IntercompanyIssue> = {}) => unmatched.push({
        workspaceId: m.workspaceId, transactionId: e.id, date, description: e.description || '', amountCents: Math.round(Number(e.totalAmountCents) || 0),
        currency: m.currency, withWorkspaceId, withName: other?.name || null, reason, ...extra,
      });
      if (!other) { issue(open.has(withWorkspaceId) ? 'outside-group' : 'not-open'); continue; }
      const match = other.entries.find(x => x.id === otherId);
      if (!match) { issue('missing'); continue; }
      if (!inForce(match)) { issue('undone'); continue; }
      const otherAmountCents = Math.round(Number(match.totalAmountCents) || 0);
      if (other.currency === m.currency && otherAmountCents !== Math.round(Number(e.totalAmountCents) || 0)) {
        // reported once, from the side that started it
        if (meta.targetWorkspaceId) issue('amount', { otherAmountCents });
        continue;
      }
      if (meta.targetWorkspaceId) matched += 1;
    }
  }
  return { matched, unmatched };
}

const FIGURES: Array<keyof GroupFigures> = ['income', 'cogs', 'grossProfit', 'expense', 'netIncome', 'totalAssets', 'totalLiabilities', 'totalEquity'];

type ReadMember = GroupMember & { earlierProfit: number; equityAccounts: number; intercompany: Transaction[]; owedBy: number; owedTo: number };

async function memberFigures(db: Firestore, workspaceId: string, startDate: string, endDate: string): Promise<ReadMember> {
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
    intercompany: transactions.filter(tx => tx.metadata?.isIntercompany === true),
    // CB-26: balances with the other companies (assets: owed to it; liabilities: it owes)
    owedBy: accounts.filter(a => a.type === 'asset' && isIntercompanyAccount(a)).reduce((s, a) => s + (bs.assets[a.id] || 0), 0),
    owedTo: accounts.filter(a => a.type === 'liability' && isIntercompanyAccount(a)).reduce((s, a) => s + (bs.liabilities[a.id] || 0), 0),
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
  const read: ReadMember[] = [];
  for (const id of shown) read.push(await memberFigures(db, id, input.startDate, input.endDate));
  const reportCurrency = input.reportCurrency;
  if (reportCurrency) {
    for (const currency of new Set(read.map(m => m.currency).filter(c => c !== reportCurrency))) {
      const problem = ratesProblem(currency, input.rates?.[currency]);
      if (problem) throw new GroupReportError(400, problem);
    }
  }
  const intercompany = matchIntercompany(read.map(m => ({ workspaceId: m.workspaceId, name: m.name, currency: m.currency, entries: m.intercompany })), open, input.startDate, input.endDate);
  const members: GroupMember[] = read.map(({ earlierProfit, equityAccounts, intercompany: _entries, owedBy: _by, owedTo: _to, ...m }) => {
    if (!reportCurrency) return m;
    const rates = m.currency === reportCurrency ? null : input.rates![m.currency];
    return { ...m, translated: { ...translate({ ...m, earlierProfit, equityAccounts }, rates), rates } };
  });
  const currencies = new Set(members.map(m => m.currency));
  // CB-26: balances between the companies, at the closing rate when translated
  const closing = (m: ReadMember) => (reportCurrency && m.currency !== reportCurrency ? input.rates![m.currency].closing : 1);
  const owedBy = read.reduce((s, m) => s + Math.round(m.owedBy * closing(m)), 0);
  const owedTo = read.reduce((s, m) => s + Math.round(m.owedTo * closing(m)), 0);
  const eliminated: Eliminated = { assets: owedBy, liabilities: owedTo, difference: owedBy - owedTo };
  const sum = (figures: Array<GroupFigures & { cta: number }>, currency: string) => {
    const t = Object.fromEntries([...FIGURES, 'cta' as const].map(f => [f, figures.reduce((s, x) => s + x[f], 0)])) as unknown as GroupFigures & { cta: number };
    return { currency, ...t, totalAssets: t.totalAssets - owedBy, totalLiabilities: t.totalLiabilities - owedTo, totalEquity: t.totalEquity - eliminated.difference, eliminated };
  };
  const total = members.length === 0 ? null
    : reportCurrency ? sum(members.map(m => m.translated!), reportCurrency)
      : currencies.size === 1 ? sum(members.map(m => ({ ...m, cta: 0 })), members[0].currency) : null;
  return { group: { id: snap.id, name: String(group.name || '') }, startDate: input.startDate, endDate: input.endDate, members, total, notIncluded: ids.length - shown.length, intercompany };
}
