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
  const mapped = usable.find(a => a.id === (direction === 'received' ? mappings?.['customer deposits'] : mappings?.['vendor prepayments']));
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

/**
 * Deposits taken for an estimate (BE-05): received payments linked to it, not void. `receivedCents`
 * is everything taken, `waiting` the ones with money not yet applied to the estimate's invoice.
 */
export function estimateDeposits<P extends AdvancePayment & { estimateId?: string; amountCents?: number }>(payments: P[], estimateId: string | undefined): { receivedCents: number; unappliedCents: number; waiting: P[] } {
  if (!estimateId) return { receivedCents: 0, unappliedCents: 0, waiting: [] };
  const mine = payments.filter(p => p.estimateId === estimateId && p.direction === 'received' && p.status !== 'void');
  const waiting = mine.filter(p => (Number(p.unappliedCents) || 0) > 0).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  return {
    receivedCents: mine.reduce((sum, p) => sum + (Number(p.amountCents) || 0), 0),
    unappliedCents: waiting.reduce((sum, p) => sum + (Number(p.unappliedCents) || 0), 0),
    waiting,
  };
}

/** How much of each waiting deposit goes to an invoice with `dueCents` left (oldest deposit first). */
export function depositApplication(waiting: Array<{ id: string; unappliedCents?: number }>, dueCents: number): Array<{ paymentId: string; amountCents: number }> {
  const out: Array<{ paymentId: string; amountCents: number }> = [];
  let left = Math.max(0, dueCents);
  for (const p of waiting) {
    if (left <= 0) break;
    const amount = Math.min(left, Number(p.unappliedCents) || 0);
    if (amount > 0) out.push({ paymentId: p.id, amountCents: amount });
    left -= amount;
  }
  return out;
}

/**
 * Open advances (CA-09): customer deposits or vendor prepayments with money not yet applied to an
 * invoice or bill, with how long each has waited at `asOf` and the waiting grouped by contact —
 * so old deposits get applied (or refunded) instead of sitting forgotten. What is open is today's
 * state (applying is not dated), so only the age depends on the date.
 */
export type AgeBucket = '0-30' | '31-60' | '61-90' | '90+';

export interface AdvanceRow {
  paymentId: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  currency: string;
  amountCents: number;
  appliedCents: number;
  openCents: number;
  ageDays: number;
  bucket: AgeBucket;
}

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000);

export function ageBucket(days: number): AgeBucket {
  return days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
}

export function openAdvances<P extends AdvancePayment & { amountCents?: number; contactName?: string; entityName?: string }>(
  payments: P[], direction: PaymentDirection, asOf: string,
): { rows: AdvanceRow[]; byParty: Array<{ partyId: string; partyName: string; currency: string; openCents: number; count: number; oldestDays: number }>; totals: Record<string, number> } {
  const rows: AdvanceRow[] = payments
    .filter(p => p.direction === direction && p.status !== 'void' && (Number(p.unappliedCents) || 0) > 0)
    .filter(p => !p.date || String(p.date).slice(0, 10) <= asOf)
    .map(p => {
      const amountCents = Math.round(Number(p.amountCents) || 0);
      const openCents = Math.round(Number(p.unappliedCents) || 0);
      const ageDays = p.date ? Math.max(0, dayNumber(asOf) - dayNumber(String(p.date))) : 0;
      return {
        paymentId: p.id,
        number: String(p.number || p.id),
        date: String(p.date || '').slice(0, 10),
        partyId: String(p.contactId || (direction === 'received' ? p.customerId : p.vendorId) || ''),
        partyName: String(p.contactName || p.entityName || 'Unknown contact'),
        currency: String(p.currency || ''),
        amountCents,
        appliedCents: Math.max(0, amountCents - openCents),
        openCents,
        ageDays,
        bucket: ageBucket(ageDays),
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays || a.partyName.localeCompare(b.partyName));
  const parties = new Map<string, { partyId: string; partyName: string; currency: string; openCents: number; count: number; oldestDays: number }>();
  const totals: Record<string, number> = {};
  for (const r of rows) {
    const k = `${r.partyId}|${r.currency}`;
    const p = parties.get(k) || { partyId: r.partyId, partyName: r.partyName, currency: r.currency, openCents: 0, count: 0, oldestDays: 0 };
    p.openCents += r.openCents; p.count += 1; p.oldestDays = Math.max(p.oldestDays, r.ageDays);
    parties.set(k, p);
    totals[r.currency] = (totals[r.currency] || 0) + r.openCents;
  }
  return { rows, byParty: [...parties.values()].sort((a, b) => b.openCents - a.openCents), totals };
}
