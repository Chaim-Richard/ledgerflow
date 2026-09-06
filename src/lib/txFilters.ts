import { Transaction, TransactionLine, ChartAccount } from '../types';

/**
 * Predicate to determine if a transaction is postable / active
 * Filters out void, failed, draft, and soft-deleted transactions.
 */
export function isPostable(t: Transaction): boolean {
  if (!t) return false;
  if (t.status === 'void' || t.status === 'failed' || (t as any).status === 'draft' || t.deletedAt) {
    return false;
  }
  return true;
}

/**
 * Calculates the base-currency amount in cents for a line item,
 * incorporating line or transaction-level FX exchange rates.
 */
export function lineAmount(l: TransactionLine, t?: Transaction): number {
  if (!l) return 0;
  const raw = l.amountCents || 0;
  const rate = l.exchangeRate ?? t?.exchangeRate ?? 1;
  return Math.round(raw * rate);
}

/**
 * Checks if an account is an income/revenue account
 */
export function isRevenueAccount(account?: ChartAccount): boolean {
  if (!account) return false;
  const type = (account.type || '').toLowerCase();
  return type === 'revenue' || type === 'income';
}

/**
 * Checks if an account is an expense/cost-of-goods account
 */
export function isExpenseAccount(account?: ChartAccount): boolean {
  if (!account) return false;
  const type = (account.type || '').toLowerCase();
  return type === 'expense' || type === 'cost_of_goods' || type === 'cogs';
}

/**
 * Checks if an account is a cash or cash equivalent asset
 */
export function isCashAccount(account?: ChartAccount): boolean {
  if (!account) return false;
  const category = (account.category || '').toLowerCase();
  const subType = ((account as any).subType || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  return (
    category.includes('cash') ||
    category.includes('bank') ||
    subType.includes('cash') ||
    subType.includes('bank') ||
    name.includes('checking') ||
    name.includes('savings') ||
    name.includes('operating cash') ||
    name.includes('petty cash')
  );
}

/**
 * Determines whether a transaction is predominantly an Income transaction
 */
export function isIncomeTransaction(tx: Transaction, accountMap?: Map<string, ChartAccount>): boolean {
  if (!isPostable(tx)) return false;
  if (tx.type === 'income') return true;
  if (tx.type === 'expense') return false;
  
  // If lines are present, check if any line credits a revenue account
  if (Array.isArray(tx.lines) && tx.lines.length > 0) {
    for (const line of tx.lines) {
      const acc = accountMap?.get(line.accountId);
      if (acc && isRevenueAccount(acc) && line.amountCents < 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Determines whether a transaction is predominantly an Expense transaction
 */
export function isExpenseTransaction(tx: Transaction, accountMap?: Map<string, ChartAccount>): boolean {
  if (!isPostable(tx)) return false;
  if (tx.type === 'expense') return true;
  if (tx.type === 'income') return false;
  
  if (Array.isArray(tx.lines) && tx.lines.length > 0) {
    for (const line of tx.lines) {
      const acc = accountMap?.get(line.accountId);
      if (acc && isExpenseAccount(acc) && line.amountCents > 0) {
        return true;
      }
    }
  }
  return false;
}


