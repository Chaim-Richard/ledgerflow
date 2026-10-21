/**
 * INT-7: an online payment for an invoice already paid in full is never applied twice — it becomes the customer's
 * credit (Customer Deposits), the payment is flagged for refund review, and A/R never goes below zero. Real database
 * (LF_TEST_DATABASE_URL); the Stripe webhook's own service is called with the session Stripe would send.
 *
 * Worked figures (cents), USD:
 *   INV-1 1,000.00: ledger A/R +100,000 / Sales −100,000
 *   paid by hand 100,000 (Bank / A/R)                       → A/R 100,000 − 100,000 = 0, INV-1 due 0, paid
 *   card payment 100,000 arrives (session opened earlier)  → nothing applied; credit 100,000 in Customer Deposits;
 *                                                            Stripe Clearing +100,000, Customer Deposits −100,000;
 *                                                            A/R still 0; INV-1 still 100,000 paid, 0 due;
 *                                                            refund review: 100,000, "invoice_already_paid"
 *   the same event again                                  → nothing more
 *   INV-2 1,000.00 with 400.00 paid by hand, card 1,000.00 → 600.00 applied (INV-2 paid), 400.00 credit to review;
 *                                                            A/R 100,000 − 40,000 − 60,000 = 0
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

describe('INT-7 an online payment for a paid invoice', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_int7_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let record: typeof import('../server/services/onlinePaymentService').recordStripeInvoicePayment;
  let payByHand: typeof import('../server/services/paymentService').createPaymentAtomic;
  const session = (invoice: string, cents: number) => ({
    id: `cs_${invoice}_${ws}`, payment_status: 'paid', amount_total: cents, currency: 'usd', payment_intent: `pi_${invoice}`,
    metadata: { invoiceId: id(invoice), workspaceId: ws },
  });
  const balance = async (accountId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs
    .flatMap(d => (d.data().lines || []) as Array<{ accountId: string; amountCents: number }>)
    .filter(l => l.accountId === accountId).reduce((s, l) => s + l.amountCents, 0);
  const invoice = async (name: string) => (await db.collection('invoices').doc(id(name)).get()).data() || {};
  const issue = async (name: string) => {
    await db.collection('invoices').doc(id(name)).set({ workspaceId: ws, customerId: id('cust'), customerName: 'Acme', number: name, amountCents: 100_000, amountPaidCents: 0, currency: 'USD', status: 'sent', date: '2026-10-01', arAccountId: id('ar') });
    await db.collection('transactions').doc(id(`tx_${name}`)).set({
      workspaceId: ws, uid: 'owner', date: '2026-10-01', description: name, status: 'completed', type: 'actual', currency: 'USD', totalAmountCents: 100_000,
      lines: [{ accountId: id('ar'), amountCents: 100_000 }, { accountId: id('sales'), amountCents: -100_000 }],
    });
  };
  const hand = (name: string, cents: number) => payByHand(db, {
    workspaceId: ws, uid: 'owner', paymentDate: '2026-10-05', amountCents: cents, paymentMethod: 'bank_transfer', customerId: id('cust'), entityName: 'Acme',
    cashAccountId: id('bank'), allocations: [{ documentId: id(name), documentType: 'invoice', amountCents: cents }],
  } as never);

  before(async () => {
    process.env.DATABASE_URL = url;
    ({ recordStripeInvoicePayment: record } = await import('../server/services/onlinePaymentService'));
    ({ createPaymentAtomic: payByHand } = await import('../server/services/paymentService'));
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner', name: 'Online Co', currency: 'USD', timezone: 'UTC', members: ['owner'], roles: { owner: 'owner' } });
    await db.collection('chartAccounts').doc(id('bank')).set({ workspaceId: ws, name: 'Checking', type: 'asset', category: 'Cash', code: '1000' });
    await db.collection('chartAccounts').doc(id('ar')).set({ workspaceId: ws, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1200' });
    await db.collection('chartAccounts').doc(id('sales')).set({ workspaceId: ws, name: 'Sales', type: 'income', category: 'Revenue', code: '4000' });
    await issue('INV-1');
  });

  after(async () => {
    for (const table of ['transactions', 'payments', 'invoices', 'chartAccounts', 'auditLogs', 'notifications', 'documentSeries', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.pool.query(`delete from public."stripeProcessedEvents" where id like $1`, [`evt_${ws}%`]).catch(() => {});
    await db.terminate();
  });

  test('paid by hand, then 1,000.00 by card: credit 1,000.00 flagged for refund, invoice 0 due, A/R 0', async () => {
    await hand('INV-1', 100_000);
    assert.deepEqual([(await invoice('INV-1')).amountPaidCents, (await invoice('INV-1')).status, await balance(id('ar'))], [100_000, 'paid', 0]);

    const out = await record(db, `evt_${ws}_1`, 'checkout.session.completed', session('INV-1', 100_000));
    assert.equal(out.status, 'recorded');
    assert.equal((out as { overpaidCents?: number }).overpaidCents, 100_000);
    const payment = (await db.collection('payments').doc((out as { paymentId: string }).paymentId).get()).data() || {};
    assert.deepEqual([payment.amountCents, payment.unappliedCents, payment.allocations], [100_000, 100_000, []], 'nothing applied twice');
    assert.equal(payment.refundReview?.status, 'open');
    assert.deepEqual([payment.refundReview?.overpaidCents, payment.refundReview?.reason, payment.refundReview?.invoiceId], [100_000, 'invoice_already_paid', id('INV-1')]);
    assert.deepEqual([(await invoice('INV-1')).amountPaidCents, (await invoice('INV-1')).status], [100_000, 'paid'], 'the invoice is as it was');

    const deposits = (await db.collection('chartAccounts').where('workspaceId', '==', ws).get()).docs.find(d => d.data().name === 'Customer Deposits');
    assert.ok(deposits, 'Customer Deposits made on first use');
    assert.equal(deposits!.data().type, 'liability');
    assert.equal(payment.advanceAccountId, deposits!.id);
    assert.equal(await balance(deposits!.id), -100_000, 'the customer\'s credit');
    assert.equal(await balance(String(payment.cashAccountId)), 100_000, 'Stripe Clearing');
    assert.equal(await balance(id('ar')), 0, 'A/R never below zero');

    const notices = (await db.collection('notifications').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    assert.ok(notices.some(n => /Overpaid online: 1000\.00 USD to review for a refund/.test(String(n.title))), JSON.stringify(notices.map(n => n.title)));

    assert.deepEqual(await record(db, `evt_${ws}_1`, 'checkout.session.completed', session('INV-1', 100_000)), { status: 'already_processed' });
    assert.equal((await db.collection('payments').where('workspaceId', '==', ws).get()).docs.length, 2, 'the replay adds nothing');
    assert.equal(await balance(id('ar')), 0);
  });

  test('400.00 paid by hand, then 1,000.00 by card: 600.00 applied, 400.00 to review, A/R 0', async () => {
    await issue('INV-2');
    await hand('INV-2', 40_000);
    const out = await record(db, `evt_${ws}_2`, 'checkout.session.completed', session('INV-2', 100_000));
    const payment = (await db.collection('payments').doc((out as { paymentId: string }).paymentId).get()).data() || {};
    assert.deepEqual([payment.unappliedCents, payment.allocations?.[0]?.amountCents], [40_000, 60_000], '100,000 − 60,000 due');
    assert.deepEqual([payment.refundReview?.overpaidCents, payment.refundReview?.reason], [40_000, 'paid_more_than_due']);
    assert.deepEqual([(await invoice('INV-2')).amountPaidCents, (await invoice('INV-2')).status], [100_000, 'paid']);
    assert.equal(await balance(id('ar')), 0, '200,000 − 100,000 − 40,000 − 60,000');
  });
});
