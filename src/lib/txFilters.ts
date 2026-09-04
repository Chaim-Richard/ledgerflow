import { Transaction, TransactionLine } from '../types';

/**
 * Predicate to determine if a transaction is postable / active
 * Filters out void, failed, and soft-deleted transactions.
 */
export function isPostable(t: Transaction): boolean {
  if (!t) return false;
  if (t.status === 'void' || t.status === 'failed' || t.deletedAt) {
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
