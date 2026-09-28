/**
 * Invoices paid online through the payment link (K-11, src/server/services/onlinePaymentService.ts):
 * the Stripe webhook becomes a real payment record + one ledger entry in the home currency, into a
 * Stripe Clearing account; replays do nothing; another currency is not booked; a bank debit still
 * clearing waits; paying more than is due leaves the rest unapplied. Needs LF_TEST_DATABASE_URL.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Invoices paid online', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_online_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let record: typeof import('../server/services/onlinePaymentService').recordStripeInvoicePayment;
  const session = (invoice: string, fields: Record<string, unknown> = {}) => ({
    id: `cs_${invoice}`, payment_status: 'paid', amount_total: 10000, currency: 'eur', payment_intent: `pi_${invoice}`,
    metadata: { invoiceId: id(invoice), workspaceId: ws }, ...fields,
  });

  before(async () => {
    process.env.DATABASE_URL = url;
    ({ recordStripeInvoicePayment: record } = await import('../server/services/onlinePaymentService'));
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: `${ws}-owner`, name: 'Online Co', currency: 'USD', timezone: 'UTC' });
    await db.collection('chartAccounts').doc(id('ar')).set({ workspaceId: ws, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1200' });
    const inv = (name: string, fields: Record<string, unknown> = {}) => db.collection('invoices').doc(id(name)).set({
      workspaceId: ws, customerId: id('c'), customerName: 'Acme', number: name, amountCents: 10000, currency: 'EUR', exchangeRate: 1.1, status: 'sent', date: '2026-09-01', ...fields,
    });
    await inv('a');
    await inv('b');
    await inv('c', { amountCents: 6000 });
    await inv('d');
  });

  after(async () => {
    for (const table of ['transactions', 'payments', 'invoices', 'chartAccounts', 'auditLogs', 'notifications', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.pool.query(`delete from public."stripeProcessedEvents" where data->>'sessionId' like 'cs_%' and id like $1`, [`evt_${ws}%`]);
    await db.terminate();
  });

  test('a paid session is a payment record, the invoice is paid, the ledger gets the home-currency amount', async () => {
    const out = await record(db, `evt_${ws}_1`, 'checkout.session.completed', session('a'));
    assert.equal(out.status, 'recorded');
    const payment = (await db.collection('payments').doc((out as { paymentId: string }).paymentId).get()).data();
    assert.equal(payment?.direction, 'received');
    assert.equal(payment?.method, 'card');
    assert.equal(payment?.currency, 'EUR');
    assert.equal((await db.collection('invoices').doc(id('a')).get()).data()?.status, 'paid');
    const tx = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    assert.equal(tx.length, 1);
    assert.deepEqual(tx[0].lines.map((l: { amountCents: number }) => l.amountCents), [11000, -11000]);
    const clearing = (await db.collection('chartAccounts').doc(`${ws}_stripe_clearing`).get()).data();
    assert.equal(clearing?.name, 'Stripe Clearing');
    assert.equal(tx[0].lines[0].accountId, `${ws}_stripe_clearing`);
    const notes = await db.collection('notifications').where('workspaceId', '==', ws).get();
    assert.equal(notes.docs.length, 1, 'the owner is told');
  });

  test('the same event again does nothing', async () => {
    assert.equal((await record(db, `evt_${ws}_1`, 'checkout.session.completed', session('a'))).status, 'already_processed');
    assert.equal((await db.collection('payments').where('workspaceId', '==', ws).get()).docs.length, 1);
  });

  test('another currency is not booked; a debit still clearing waits', async () => {
    assert.equal((await record(db, `evt_${ws}_2`, 'checkout.session.completed', session('b', { currency: 'usd' }))).status, 'currency_mismatch');
    assert.equal((await record(db, `evt_${ws}_3`, 'checkout.session.completed', session('d', { payment_status: 'unpaid' }))).status, 'pending');
    assert.equal((await db.collection('invoices').doc(id('d')).get()).data()?.paymentStatus, 'pending_settlement');
    assert.equal((await record(db, `evt_${ws}_4`, 'checkout.session.async_payment_succeeded', session('d'))).status, 'recorded', 'then the success event records it');
  });

  test('paying more than is due: the invoice is paid, the rest stays unapplied', async () => {
    const out = await record(db, `evt_${ws}_5`, 'checkout.session.completed', session('c'));
    const payment = (await db.collection('payments').doc((out as { paymentId: string }).paymentId).get()).data();
    assert.equal(payment?.unappliedCents, 4000);
    assert.equal((await db.collection('invoices').doc(id('c')).get()).data()?.amountPaidCents, 6000);
  });
});
