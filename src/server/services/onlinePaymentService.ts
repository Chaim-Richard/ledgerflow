/**
 * A customer paid an invoice online through its payment link (K-11: /i/:token → Stripe Checkout).
 * Stripe's webhook calls this once per event. The money is recorded exactly like a payment a
 * person records (paymentService.createPaymentInTransaction): a payment record, the invoice's
 * paid amount and status, and one ledger entry in the home currency. It lands in a "Stripe
 * Clearing" account (Stripe pays out to the bank later, minus its fees). Replays of the same
 * event do nothing; a payment in another currency than the invoice's is not booked.
 */
import type { DocumentData, Firestore } from '../db/firestore';
import { createPaymentInTransaction } from './paymentService';
import { notifyPaymentReceived } from './notificationService';
import { logger } from '../utils/logger';
import { calculateAmountDue } from '../../lib/documentMath';
import { formatTzDate } from '../../lib/utils';

export interface StripeInvoiceSession {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
}

export type OnlinePaymentResult =
  | { status: 'recorded'; paymentId: string }
  | { status: 'already_processed' | 'pending' | 'not_found' | 'currency_mismatch' | 'nothing_due' };

/** The workspace's Stripe clearing account, created on first use. */
async function clearingAccountId(db: Firestore, workspaceId: string): Promise<string> {
  const accounts = await db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get();
  const existing = accounts.docs.find(d => {
    const a = d.data();
    return String(a.type).toLowerCase() === 'asset' && (a.subtype === 'payment_clearing' || /stripe/i.test(String(a.name || '')));
  });
  if (existing) return existing.id;
  const id = `${workspaceId}_stripe_clearing`;
  const ref = db.collection('chartAccounts').doc(id);
  if (!(await ref.get()).exists) {
    await ref.set({
      id, uid: 'system', workspaceId, name: 'Stripe Clearing', code: '1015', type: 'asset', subtype: 'cash', category: 'Cash',
      description: 'Online card payments received, until Stripe pays them out to the bank', isSystem: false,
      createdAt: new Date().toISOString(),
    });
  }
  return id;
}

export async function recordStripeInvoicePayment(db: Firestore, eventId: string, eventType: string, session: StripeInvoiceSession): Promise<OnlinePaymentResult> {
  const invoiceId = session.metadata?.invoiceId;
  const eventRef = db.collection('stripeProcessedEvents').doc(eventId);
  const markEvent = (note: string) => eventRef.set({ id: eventId, type: eventType, sessionId: session.id, note, processedAt: new Date().toISOString() });
  if ((await eventRef.get()).exists) return { status: 'already_processed' };

  const invoiceRef = db.collection('invoices').doc(String(invoiceId || ''));
  const invoice = invoiceId ? (await invoiceRef.get()).data() : undefined;
  if (!invoice || !invoice.workspaceId || (session.metadata?.workspaceId && session.metadata.workspaceId !== invoice.workspaceId)) {
    await markEvent('invoice_not_found');
    return { status: 'not_found' };
  }
  const workspaceId = String(invoice.workspaceId);
  const workspace = (await db.collection('workspaces').doc(workspaceId).get()).data() || {};

  if (session.payment_status !== 'paid') {
    // e.g. a bank debit still clearing: the next event (async_payment_succeeded) records it
    await invoiceRef.update({ paymentStatus: 'pending_settlement', updatedAt: new Date().toISOString() });
    return { status: 'pending' };
  }

  const invoiceCurrency = String(invoice.currency || workspace.currency || 'USD').toLowerCase();
  if (String(session.currency || '').toLowerCase() !== invoiceCurrency) {
    logger.warn('online payment currency differs from the invoice; not booked', { workspaceId, invoiceId, sessionId: session.id });
    await markEvent('currency_mismatch');
    return { status: 'currency_mismatch' };
  }

  const paidCents = Math.max(0, Math.round(Number(session.amount_total) || 0));
  const dueCents = calculateAmountDue(invoice as DocumentData);
  if (paidCents <= 0) {
    await markEvent('nothing_paid');
    return { status: 'nothing_due' };
  }
  const cashAccountId = await clearingAccountId(db, workspaceId);
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  const today = formatTzDate(new Date(), typeof workspace.timezone === 'string' ? workspace.timezone : 'UTC');

  const result = await db.runTransaction(async (t) => {
    if ((await t.get(eventRef)).exists) return null;
    const payment = await createPaymentInTransaction(db, t, {
      workspaceId,
      uid: 'system',
      paymentDate: today,
      amountCents: paidCents,
      paymentMethod: 'card',
      referenceNumber: paymentIntent || session.id,
      memo: `Paid online (Stripe ${session.id})`,
      customerId: invoice.customerId ? String(invoice.customerId) : undefined,
      entityName: String(invoice.customerName || ''),
      cashAccountId,
      // anything above what is due stays on the payment as unapplied (a credit for the customer)
      allocations: dueCents > 0 ? [{ documentId: invoiceRef.id, documentType: 'invoice', amountCents: Math.min(paidCents, dueCents) }] : [],
    });
    t.set(eventRef, { id: eventId, type: eventType, sessionId: session.id, paymentId: payment.paymentId, processedAt: new Date().toISOString() });
    return payment;
  });
  if (!result) return { status: 'already_processed' };
  await notifyPaymentReceived(db, result.payment);
  return { status: 'recorded', paymentId: result.paymentId };
}
