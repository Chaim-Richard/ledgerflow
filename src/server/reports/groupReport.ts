/**
 * The group summary (Z-20, first step of the multi-entity design Z-16): for one of the person's
 * groups of books (DA-01) and a period, each member's profit and loss and balance sheet side by side,
 * and the group's total when all members keep their books in the same currency (different currencies
 * need translation rates first, Z-17). Each member is read under the person's own access, never
 * copied into another ledger; members the person can no longer open are not included, and the answer
 * says how many. Every figure is the member's own report, so it can be opened in its own books.
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

export interface GroupMember extends GroupFigures {
  workspaceId: string;
  name: string;
  currency: string;
  isBalanced: boolean;
}

export interface GroupSummary {
  group: { id: string; name: string };
  startDate: string;
  endDate: string;
  members: GroupMember[];
  /** the group's total, when every member uses the same currency */
  total: (GroupFigures & { currency: string }) | null;
  /** members of the group this person can no longer open (left out) */
  notIncluded: number;
}

const FIGURES: Array<keyof GroupFigures> = ['income', 'cogs', 'grossProfit', 'expense', 'netIncome', 'totalAssets', 'totalLiabilities', 'totalEquity'];

async function memberFigures(db: Firestore, workspaceId: string, startDate: string, endDate: string): Promise<GroupMember> {
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
  };
}

export async function groupSummary(db: Firestore, input: { uid: string; groupId: string; startDate: string; endDate: string }): Promise<GroupSummary> {
  if (input.startDate > input.endDate) throw new GroupReportError(400, 'The period starts after it ends');
  const snap = await db.collection('workspaceGroups').doc(input.groupId).get();
  const group = snap.data();
  // someone else's group answers like a missing one
  if (!group || group.ownerUid !== input.uid) throw new GroupReportError(404, 'Group not found');
  const open = await openable(db, input.uid);
  const ids = (Array.isArray(group.workspaceIds) ? group.workspaceIds as string[] : []);
  const shown = ids.filter(id => open.has(id));
  const members: GroupMember[] = [];
  for (const id of shown) members.push(await memberFigures(db, id, input.startDate, input.endDate));
  const currencies = new Set(members.map(m => m.currency));
  const total = members.length > 0 && currencies.size === 1
    ? { currency: members[0].currency, ...Object.fromEntries(FIGURES.map(f => [f, members.reduce((s, m) => s + m[f], 0)])) as unknown as GroupFigures }
    : null;
  return { group: { id: snap.id, name: String(group.name || '') }, startDate: input.startDate, endDate: input.endDate, members, total, notIncluded: ids.length - shown.length };
}
