/**
 * DEP-1 (owner's QuickBooks example, 18 Oct): an order of 1,000 goods + 100 delivery with a 25% deposit.
 * The deposit is a payment, not an invoice; invoices made from the order can never add up to more
 * than the order's 1,100 — checked on the server inside the save, so delivery is never billed twice,
 * even when two people invoice the same order at the same moment.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const url = process.env.LF_TEST_DATABASE_URL;
describe('order invoices never pass the order total (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_dep_${crypto.randomBytes(4).toString('hex')}`;
  const order = `${ws}_order`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const invoice = (docId: string, amountCents: number) => fetch(`${base}/api/v1/transactions/bulk`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': 'owner-1' },
    body: JSON.stringify({ workspaceId: ws, transactions: [], entityMutation: { collection: 'invoices', docId: `${ws}_${docId}`, action: 'create',
      data: { customerId: 'c1', customerName: 'Acme', invoiceNumber: docId, date: '2026-06-01', dueDate: '2026-07-01', status: 'draft', amountCents, currency: 'USD', metadata: { convertedFromEstimateId: order } } } }),
  }).then(async r => ({ status: r.status, body: await r.json() as Record<string, unknown> }));

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Shop', members: ['owner-1'] });
    await db.collection('estimates').doc(order).set({ workspaceId: ws, number: 'EST-1', customerName: 'Acme', status: 'accepted', orderedAt: '2026-05-01', amountCents: 110000,
      lines: [{ description: 'Goods', quantity: 1, unitPriceCents: 100000, amountCents: 100000 }, { description: 'Delivery', quantity: 1, unitPriceCents: 10000, amountCents: 10000 }] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['invoices', 'estimates', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('25% and then the rest are accepted; a second delivery charge is refused', async () => {
    assert.equal((await invoice('p1', 27500)).status, 200, '25% of 1,100');
    assert.equal((await invoice('p2', 82500)).status, 200, 'the rest');
    const extra = await invoice('p3', 10000);
    assert.equal(extra.status, 409, 'delivery billed again');
    assert.match(String(extra.body.error), /more than is left/);
    assert.equal((await db.collection('invoices').doc(`${ws}_p3`).get()).exists, false);
  });

  test('two people invoicing the same order at the same moment: only one gets through', async () => {
    await db.pool.query(`delete from public."invoices" where workspace_id = $1`, [ws]);
    const results = await Promise.all([invoice('a', 66000), invoice('b', 66000)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409], JSON.stringify(results.map(r => r.body)));
    const made = await db.collection('invoices').where('workspaceId', '==', ws).get();
    assert.equal(made.docs.reduce((s, d) => s + Number(d.data().amountCents), 0), 66000);
  });
});
