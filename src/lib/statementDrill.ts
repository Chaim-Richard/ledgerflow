import type { Transaction } from '../types';
import { isPostable, isTransactionInDateRange } from './txFilters';

/**
 * C-95: the entries behind a *total* on the profit & loss, the balance sheet or the trial balance.
 *
 * A statement total is a group of accounts (income, cost of goods, expenses, assets, liabilities,
 * equity) or the whole statement. Opening it lists the posted entries whose lines touch any account
 * of the group, and asks the server to explain the same figure (`/api/v1/reports/explain`), so the
 * drill-down shows the lines that add up to the total on screen instead of a second calculation.
 *
 * Nothing here recalculates money: the totals stay the report's own, and the expected figure is
 * passed through untouched so the modal can say when the loaded entries do not add up to it.
 */
export interface StatementTotal {
  /** what the reader clicked, e.g. "Total income" or "Net income" */
  name: string;
  /** the accounts the total adds up; an empty group opens nothing */
  accountIds: string[];
  /** the figure on screen, in cents, as the report shows it */
  expectedCents: number;
  /** -1 where the report shows credits as positive (income, liabilities, equity) */
  sign: 1 | -1;
  /** the period the figure covers; no start = a balance as of the end date */
  startDate?: string;
  endDate?: string;
  /** CB-25: only lines carrying this label value */
  labelFilter?: { dimensionId: string; value: string };
}

export interface StatementDrillTarget {
  accountName: string;
  transactions: Transaction[];
  explain: {
    accountIds: string[];
    startDate?: string;
    endDate?: string;
    expectedCents: number;
    sign: 1 | -1;
    label?: string;
    labelFilter?: { dimensionId: string; value: string };
  };
}

/** The posted entries whose lines touch one of the accounts, inside the total's period. */
export function entriesForAccounts(
  transactions: readonly Transaction[] | null | undefined,
  accountIds: readonly string[],
  startDate?: string,
  endDate?: string,
): Transaction[] {
  const wanted = new Set(accountIds.filter(Boolean));
  if (!wanted.size) return [];
  return (transactions || []).filter(transaction =>
    isPostable(transaction)
    && isTransactionInDateRange(transaction, startDate, endDate)
    && (transaction.lines || []).some(line => wanted.has(line.accountId)));
}

/**
 * The drill-down for one statement total, or null when the group has no accounts (a total of
 * nothing is not opened, so the reader never sees an empty explanation).
 */
export function statementTotalDrill(
  total: StatementTotal,
  transactions: readonly Transaction[] | null | undefined,
): StatementDrillTarget | null {
  const accountIds = [...new Set(total.accountIds.filter(Boolean))];
  if (!accountIds.length) return null;
  const entries = entriesForAccounts(transactions, accountIds, total.startDate, total.endDate);
  return {
    accountName: total.name,
    transactions: entries,
    explain: {
      accountIds,
      ...(total.startDate ? { startDate: total.startDate } : {}),
      ...(total.endDate ? { endDate: total.endDate } : {}),
      expectedCents: total.expectedCents,
      sign: total.sign,
      label: total.name,
      ...(total.labelFilter ? { labelFilter: total.labelFilter } : {}),
    },
  };
}

/** The account ids of a statement section, in the order the report lists them. */
export function accountIdsOf(section: { accounts?: Record<string, unknown> } | null | undefined): string[] {
  return Object.keys(section?.accounts || {});
}
