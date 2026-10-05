/**
 * Advance payments (BE-12, K-18): money received before there is an invoice (a customer deposit) or
 * paid before there is a bill (a vendor prepayment). The part of a payment not matched to documents
 * is kept in its own account (Customer Deposits, a liability; Vendor Prepayments, an asset) and is
 * applied to the invoice or bill later. Without such an account it stays on A/R or A/P (as before).
 */
import { resolveAccountRole } from './accountUtils';
import type { ChartAccount } from '../types';

export type PaymentDirection = 'received' | 'made';

/** The account an unmatched payment waits in, or undefined when the chart has none. */
export function advanceAccount(
  accounts: ChartAccount[],
  direction: PaymentDirection,
  mappings?: Record<string, string | undefined>,
): ChartAccount | undefined {
  const usable = accounts.filter(a => !a.isArchived && a.isActive !== false);
  const mapped = usable.find(a => a.id === (direction === 'received' ? mappings?.customerDeposits : mappings?.vendorPrepayments));
  if (mapped) return mapped;
  if (direction === 'received') {
    return usable.find(a => resolveAccountRole(a) === 'liability' && /deposit|advance|unearned|retainer/i.test(a.name || ''));
  }
  return usable.find(a => resolveAccountRole(a) === 'asset' && /prepa|advance|deposit/i.test(a.name || '') && !/undeposited/i.test(a.name || ''));
}
