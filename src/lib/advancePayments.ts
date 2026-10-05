/**
 * Advance payments (BE-12, K-18): money received before there is an invoice (a customer deposit) or
 * paid before there is a bill (a vendor prepayment). The part of a payment not matched to documents
 * is kept in its own account (Customer Deposits, a liability; Vendor Prepayments, an asset) and is
 * applied to the invoice or bill later. Without such an account it stays on A/R or A/P (as before).
 */
import { resolveAccountRole } from './accountUtils';
import type { ChartAccount } from '../types';
import { calculateAmountDue } from './documentMath';

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

/** A payment as the screens hold it (only the fields used here). */
export interface AdvancePayment {
  id: string;
  number?: string;
  date?: string;
  direction?: PaymentDirection;
  contactId?: string | null;
  customerId?: string | null;
  vendorId?: string | null;
  currency?: string;
  unappliedCents?: number;
  status?: string;
}

/** An invoice or bill as the screens hold it (only the fields used here). */
export interface ApplicableDocument {
  id: string;
  number?: string;
  date?: string;
  dueDate?: string;
  currency?: string;
  status?: string;
  customerId?: string;
  vendorId?: string;
  amountCents?: number;
  amountPaidCents?: number;
  depositCents?: number;
}

/** The party's payments with money not yet applied to an invoice or bill, oldest first. */
export function unappliedPayments<P extends AdvancePayment>(payments: P[], partyId: string, direction: PaymentDirection): P[] {
  return payments
    .filter(p => p.direction === direction && p.status !== 'void' && (Number(p.unappliedCents) || 0) > 0)
    .filter(p => (p.contactId || (direction === 'received' ? p.customerId : p.vendorId)) === partyId)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

/**
 * The party's open invoices (a payment received) or bills (a payment made) in the payment's currency,
 * oldest due first, with what is still due on each — the ones the server accepts (payment apply).
 */
export function applicableDocuments<D extends ApplicableDocument>(
  payment: AdvancePayment,
  documents: D[],
  partyId: string,
  baseCurrency: string,
): Array<{ doc: D; dueCents: number }> {
  const currency = payment.currency || baseCurrency;
  return documents
    .filter(d => (payment.direction === 'made' ? d.vendorId : d.customerId) === partyId)
    .filter(d => d.status !== 'draft' && d.status !== 'void' && (d.currency || baseCurrency) === currency)
    .map(doc => ({ doc, dueCents: calculateAmountDue(doc) }))
    .filter(d => d.dueCents > 0)
    .sort((a, b) => String(a.doc.dueDate || a.doc.date || '').localeCompare(String(b.doc.dueDate || b.doc.date || '')));
}

/** The unapplied amount spread over the documents in order (oldest due first), never more than each one's due. */
export function suggestApplication(unappliedCents: number, documents: Array<{ id: string; dueCents: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  let left = Math.max(0, Math.round(unappliedCents));
  for (const d of documents) {
    if (left <= 0) break;
    const amount = Math.min(left, d.dueCents);
    if (amount > 0) out[d.id] = amount;
    left -= amount;
  }
  return out;
}
