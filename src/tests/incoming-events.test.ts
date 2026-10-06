/**
 * Incoming events (K-37): what Stripe and the email provider told LedgerFlow about a workspace, in
 * words, newest first; read only, for owners and accountants, and never another workspace's events.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { describeEmailEvent, describeStripeEvent, incomingEvents } from '../lib/incomingEvents';

describe('In words', () => {
  test('Stripe outcomes', () => {
    assert.deepEqual(describeStripeEvent({ id: 'e1', type: 'checkout.session.completed', outcome: 'recorded', amountCents: 12000, invoiceId: 'inv1', processedAt: '2026-10-06T10:00:00Z' }),
      { id: 'e1', source: 'stripe', at: '2026-10-06T10:00:00Z', what: 'Online card payment (120.00)', outcome: 'Payment recorded against the invoice', tone: 'ok', recordId: 'inv1' });
    assert.equal(describeStripeEvent({ type: 'checkout.session.completed', outcome: 'pending' }).tone, 'waiting');
    assert.equal(describeStripeEvent({ type: 'checkout.session.completed', note: 'currency_mismatch' }).outcome, 'Not recorded: paid in a different currency from the invoice');
    assert.equal(describeStripeEvent({ type: 'invoice.created' }).what, 'invoice.created');
  });

  test('email reports; the send log itself is not an incoming event; newest first', () => {
    assert.equal(describeEmailEvent({ event: 'sent' }), null);
    assert.deepEqual(describeEmailEvent({ id: 'm1', event: 'bounced', recipient: 'a@b.co', documentId: 'inv1', timestamp: '2026-10-05T09:00:00Z' }),
      { id: 'm1', source: 'email', at: '2026-10-05T09:00:00Z', what: 'Email bounced', outcome: "Not delivered: the address won't be emailed again until it is changed", tone: 'problem', recordId: 'inv1', detail: 'a@b.co' });
    const all = incomingEvents([{ id: 's', type: 'checkout.session.completed', outcome: 'recorded', processedAt: '2026-10-06T10:00:00Z' }],
      [{ id: 'm', event: 'delivered', timestamp: '2026-10-07T10:00:00Z' }, { id: 'x', event: 'sent', timestamp: '2026-10-08T00:00:00Z' }]);
    assert.deepEqual(all.map(e => e.id), ['m', 's']);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('The route (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_inc_${crypto.randomBytes(4).toString('hex')}`;
  const other = `${ws}_other`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const get = async (uid: string) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/incoming-events`, { headers: { 'x-test-uid': uid } });
    return { status: res.status, body: await res.json() as { data?: { events: Array<{ id: string; what: string }> } } };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Inc', currency: 'USD', members: ['owner-1', 'acc-1', 'book-1'], roles: { 'acc-1': 'accountant', 'book-1': 'bookkeeper' } });
    await db.collection('stripeProcessedEvents').doc(`${ws}_e1`).set({ id: `${ws}_e1`, type: 'checkout.session.completed', outcome: 'recorded', workspaceId: ws, processedAt: '2026-10-06T10:00:00Z' });
    await db.collection('stripeProcessedEvents').doc(`${ws}_e2`).set({ id: `${ws}_e2`, type: 'checkout.session.completed', outcome: 'recorded', workspaceId: other, processedAt: '2026-10-06T11:00:00Z' });
    await db.collection('stripeProcessedEvents').doc(`${ws}_e3`).set({ id: `${ws}_e3`, type: 'checkout.session.completed', outcome: 'invoice_not_found', processedAt: '2026-10-06T12:00:00Z' });
    await db.collection('emailEvents').doc(`${ws}_m1`).set({ id: `${ws}_m1`, event: 'bounced', recipient: 'x@y.co', workspaceId: ws, timestamp: '2026-10-06T13:00:00Z' });
    await db.collection('emailEvents').doc(`${ws}_m2`).set({ id: `${ws}_m2`, event: 'sent', recipient: 'x@y.co', workspaceId: ws, timestamp: '2026-10-06T14:00:00Z' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    await db.pool.query(`delete from public."stripeProcessedEvents" where id like $1`, [`${ws}%`]);
    await db.pool.query(`delete from public."emailEvents" where id like $1`, [`${ws}%`]);
    await db.pool.query(`delete from public.workspaces where id = $1`, [ws]);
    await db.terminate();
  });

  test('owners and accountants see this workspace\'s events only, newest first; a bookkeeper is refused', async () => {
    const owner = await get('owner-1');
    assert.equal(owner.status, 200);
    assert.deepEqual(owner.body.data!.events.map(e => e.id), [`${ws}_m1`, `${ws}_e1`], 'not the other workspace\'s, not the unmatched one, not the send log');
    assert.equal((await get('acc-1')).status, 200);
    assert.equal((await get('book-1')).status, 403);
    assert.equal((await get('stranger')).status, 403);
  });
});
