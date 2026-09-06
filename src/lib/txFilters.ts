import { Transaction, TransactionLine, Invoice, Bill } from '../types';

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
 * Predicate to determine if an invoice is open / active (outstanding receivable)
 * Excludes draft, paid, rejected, and void invoices.
 */
export function isOpenInvoice(item: Invoice | { status?: string } | null | undefined): boolean {
  if (!item?.status) return false;
  return ['pending', 'sent', 'approved', 'invoiced', 'overdue', 'partially_paid', 'unpaid'].includes(item.status);
}

/**
 * Predicate to determine if a bill is open / active (outstanding payable)
 * Excludes draft, paid, and void bills.
 */
export function isOpenBill(item: Bill | { status?: string } | null | undefined): boolean {
  if (!item?.status) return false;
  return ['pending', 'approved', 'overdue', 'unpaid', 'partially_paid'].includes(item.status);
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
