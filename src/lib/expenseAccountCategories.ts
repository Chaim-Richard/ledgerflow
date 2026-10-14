/**
 * E-22: a category is a real expense/COGS account in this workspace's chart.
 * Do not invent a second unsynchronised mapping table or persist a display-only
 * category on a bill. Bills with multiple splits can match multiple categories.
 */
import type { Bill, ChartAccount } from '../types';
import { isExpenseAccount } from './txFilters';

export const UNMAPPED_BILL_CATEGORY = '__no_expense_account__';

export interface ExpenseAccountCategory {
  accountId: string;
  name: string;
  code: string;
  archived: boolean;
  billCount: number;
}
export interface ExpenseCategoryIndex {
  categories: ExpenseAccountCategory[];
  withoutCategoryCount: number;
  billCount: number;
}

function inPeriod(bill: Bill, from?: string, through?: string): boolean {
  if (!from && !through) return true;
  // A missing bill date cannot be assigned to a selected calendar period.
  const date = bill.date || bill.issueDate;
  return typeof date === 'string' && (!from || date.slice(0, 10) >= from)
    && (!through || date.slice(0, 10) <= through);
}

export function scopedExpenseBills(bills: readonly Bill[], workspaceId: string, from?: string, through?: string): Bill[] {
  if (!workspaceId) return [];
  return bills.filter(bill => bill.workspaceId === workspaceId && inPeriod(bill, from, through));
}

export function expenseAccountCategories(
  accounts: readonly ChartAccount[],
  bills: readonly Bill[],
  workspaceId: string,
  from?: string,
  through?: string,
): ExpenseCategoryIndex {
  const eligible = accounts.filter(account => account.workspaceId === workspaceId && isExpenseAccount(account));
  // Treat archived accounts as valid historical categories, but never mix tenants.
  const byId = new Map(eligible.map(account => [account.id, account]));
  const counts = new Map<string, number>();
  let withoutCategoryCount = 0;
  const scoped = scopedExpenseBills(bills, workspaceId, from, through);
  for (const bill of scoped) {
    const matching = new Set((bill.splits || []).map(split => split.accountId).filter(id => byId.has(id)));
    if (!matching.size) withoutCategoryCount++;
    for (const accountId of matching) counts.set(accountId, (counts.get(accountId) || 0) + 1);
  }
  const categories = eligible.map(account => ({
    accountId: account.id,
    name: account.name.trim() || account.code || account.id,
    code: account.code || '',
    archived: Boolean(account.isArchived || account.archived || account.isActive === false),
    billCount: counts.get(account.id) || 0,
  })).sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code) || a.accountId.localeCompare(b.accountId));
  return { categories, withoutCategoryCount, billCount: scoped.length };
}

export function billsInExpenseCategory(
  bills: readonly Bill[],
  accounts: readonly ChartAccount[],
  workspaceId: string,
  categoryId: string,
  from?: string,
  through?: string,
): Bill[] {
  const scoped = scopedExpenseBills(bills, workspaceId, from, through);
  if (!categoryId) return scoped;
  const eligibleIds = new Set(
    accounts.filter(account => account.workspaceId === workspaceId && isExpenseAccount(account)).map(account => account.id)
  );
  if (categoryId !== UNMAPPED_BILL_CATEGORY && !eligibleIds.has(categoryId)) return [];
  return scoped.filter(bill => {
    const matching = new Set((bill.splits || []).map(split => split.accountId).filter(id => eligibleIds.has(id)));
    return categoryId === UNMAPPED_BILL_CATEGORY ? matching.size === 0 : matching.has(categoryId);
  });
}
