/**
 * Payments that did not go through (S-05, S-16): a customer's failed bank payment for an invoice
 * tells the people who keep the books once and leaves the invoice open; a failed charge for the
 * workspace's own plan tells the owners. Each Stripe event once; the outcome is kept for Settings →
 * Incoming events. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';
import { describeStripeEvent } from '../lib/incomingEvents';

describe('Failed payments in words', () => {
  test('both outcomes read as problems', () => {
    assert.deepEqual([describeStripeEvent({ type: 'checkout.session.async_payment_failed', outcome: 'payment_failed', amountCents: 50000 }).what, describeStripeEvent({ outcome: 'payment_failed' }).tone],
      ['Online payment failed (500.00)', 'problem']);
    assert.equal(describeStripeEvent({ type: 'invoice.payment_failed', outcome: 'subscription_payment_failed' }).outcome, 'The plan could not be charged; update the card in Billing');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Payment failures (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_payfail_${crypto.randomBytes(4).toString('hex')}`;
  const ev = (n: string) => `evt_${ws}_${n}`;
  let db: Firestore;
  let svc: typeof import('../server/services/paymentFailureService');
  const told = async (kind: string) => (await db.pool.query(
    `select data->>'uid' as uid, data->>'message' as message from public.notifications where workspace_id = $1 and data->>'kind' = $2 order by 1`, [ws, kind])).rows;

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    svc = await import('../server/services/paymentFailureService');
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Payfail Co', currency: 'USD', members: ['owner-1', 'book-1'], roles: { 'book-1': 'bookkeeper' }, stripeCustomerId: `cus_${ws}`, stripeSubscriptionId: `sub_${ws}` });
    await db.collection('invoices').doc(`${ws}_inv`).set({ workspaceId: ws, number: 'INV-3', customerName: 'Acme', status: 'sent', amountCents: 50000, currency: 'USD' });
  });

  after(async () => {
    for (const table of ['invoices', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.pool.query(`delete from public."stripeProcessedEvents" where id like $1`, [`evt_${ws}_%`]);
    await db.terminate();
  });

  test('a failed bank payment for an invoice: the bookkeepers are told once, the invoice stays open', async () => {
    const session = { metadata: { invoiceId: `${ws}_inv` }, amount_total: 50000, currency: 'usd' };
    assert.equal(await svc.recordInvoicePaymentFailed(db, ev('1'), 'checkout.session.async_payment_failed', session), 'recorded');
    assert.equal(await svc.recordInvoicePaymentFailed(db, ev('1'), 'checkout.session.async_payment_failed', session), 'already_processed');
    assert.deepEqual(await told('payment.failed'), [
      { uid: 'book-1', message: "Acme's bank payment of $500.00 did not go through. The invoice is still open; they can pay again from its link." },
      { uid: 'owner-1', message: "Acme's bank payment of $500.00 did not go through. The invoice is still open; they can pay again from its link." },
    ]);
    assert.equal((await db.collection('invoices').doc(`${ws}_inv`).get()).data()?.status, 'sent');
    assert.equal((await db.collection('stripeProcessedEvents').doc(ev('1')).get()).data()?.outcome, 'payment_failed');
    assert.equal(await svc.recordInvoicePaymentFailed(db, ev('2'), 'checkout.session.async_payment_failed', { metadata: { invoiceId: 'nope' } }), 'not_found');
  });

  test('the plan could not be charged: only the owner is told', async () => {
    assert.equal(await svc.recordSubscriptionPaymentFailed(db, ev('3'), 'invoice.payment_failed', { subscription: `sub_${ws}`, customer: `cus_${ws}`, amount_due: 2900, currency: 'usd' }), 'recorded');
    assert.deepEqual(await told('subscription.payment_failed'), [{ uid: 'owner-1', message: 'The card for your plan could not be charged ($29.00). Update it in Settings → Billing to keep the plan.' }]);
    assert.equal(await svc.recordSubscriptionPaymentFailed(db, ev('4'), 'invoice.payment_failed', { customer: 'cus_unknown' }), 'not_found');
  });
});
