/**
 * "The customer opened the invoice" (S-02): opening the invoice's own page records when it was first
 * and last seen, counts at most once an hour, and notifies the people who keep the books once; a
 * draft is not counted. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;
describe('Invoice viewed (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_viewed_${crypto.randomBytes(4).toString('hex')}`;
  const token = `pay_${crypto.randomBytes(16).toString('hex')}`;
  const draftToken = `pay_${crypto.randomBytes(16).toString('hex')}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const open = (t: string) => fetch(`${base}/api/v1/invoices/public/${t}`);
  const invoice = async (name: string) => (await db.collection('invoices').doc(`${ws}_${name}`).get()).data();
  const told = async () => (await db.pool.query(
    `select data->>'uid' as uid, data->>'title' as title, data->>'message' as message from public.notifications where workspace_id = $1 and data->>'kind' = 'invoice.viewed' order by 1`, [ws])).rows;

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Viewed Co', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    await db.collection('invoices').doc(`${ws}_inv`).set({ workspaceId: ws, number: 'INV-7', customerName: 'Acme', status: 'sent', date: '2026-10-01', dueDate: '2026-10-31', amountCents: 50000, currency: 'USD', paymentToken: token });
    await db.collection('invoices').doc(`${ws}_draft`).set({ workspaceId: ws, number: 'DRAFT', customerName: 'Acme', status: 'draft', amountCents: 100, currency: 'USD', paymentToken: draftToken });
    const express = (await import('express')).default;
    const { publicInvoiceRouter } = await import('../server/routes/publicInvoiceRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/invoices/public', publicInvoiceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['invoices', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('the first opening is recorded and the bookkeepers are told once', async () => {
    assert.equal((await open(token)).status, 200);
    const inv = await invoice('inv');
    assert.ok(inv?.viewedAt);
    assert.equal(inv?.viewCount, 1);
    assert.deepEqual(await told(), [
      { uid: 'book-1', title: 'Acme opened invoice INV-7', message: '$500.00 is still due by 2026-10-31.' },
      { uid: 'owner-1', title: 'Acme opened invoice INV-7', message: '$500.00 is still due by 2026-10-31.' },
    ]);
  });

  test('opened again within the hour: not counted; later: counted, not told again', async () => {
    await open(token);
    assert.equal((await invoice('inv'))?.viewCount, 1);
    const { recordInvoiceView } = await import('../server/services/invoiceViewService');
    const ref = db.collection('invoices').doc(`${ws}_inv`);
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    assert.equal(await recordInvoiceView(db, ref as never, (await invoice('inv'))!, later), 'again');
    const inv = await invoice('inv');
    assert.equal(inv?.viewCount, 2);
    assert.equal(inv?.lastViewedAt, later.toISOString());
    assert.equal((await told()).length, 2);
  });

  test('a draft opened by its link is not counted', async () => {
    await open(draftToken);
    assert.equal((await invoice('draft'))?.viewedAt, undefined);
  });
});
