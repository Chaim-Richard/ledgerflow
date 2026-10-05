/**
 * Stock changes with the books (K-13 BA-04 W-04 W-05): POST /api/v1/inventory/adjust and /count.
 * Each change posts the same value to Inventory against the offset account, in the workspace
 * currency, in the same database transaction as the new quantity; viewers are refused (the old
 * /adjust let any member post). Needs LF_TEST_DATABASE_URL.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Stock adjustments and counts', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_stock_${crypto.randomBytes(4).toString('hex')}`;
  const other = `${ws}_other`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const post = (uid: string, path: string, body: Record<string, unknown>) =>
    fetch(`${base}/api/v1/inventory/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ workspaceId: ws, inventoryAccountId: id('inv'), offsetAccountId: id('shrink'), date: '2026-07-10', ...body }) });
  const qty = async (name: string) => (await db.collection('inventory').doc(id(name)).get()).data();
  const entry = async (txId: string) => (await db.collection('transactions').doc(txId).get()).data();

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner', name: 'Stock Co', currency: 'EUR', members: ['owner', 'book', 'view'], roles: { book: 'bookkeeper', view: 'viewer' } });
    await db.collection('workspaces').doc(other).set({ uid: 'x', name: 'Other', currency: 'USD', members: ['x'] });
    const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, name, ...fields });
    await account('inv', { type: 'asset', category: 'Inventory', code: '1300' });
    await account('shrink', { type: 'expense', category: 'COGS', code: '5100', name: 'Stock variance' });
    await account('ap', { type: 'liability', category: 'Payables', code: '2000' });
    const item = (name: string, fields: Record<string, unknown>) => db.collection('inventory').doc(id(name)).set({ workspaceId: ws, name, sku: name.toUpperCase(), unitPriceCents: 1000, reorderPoint: 0, ...fields });
    await item('bolts', { quantityAtHand: 10, unitCostCents: 400 });
    await item('nuts', { quantityAtHand: 5, unitCostCents: 250 });
    await item('washers', { quantityAtHand: 20, unitCostCents: 10 });
    await item('free', { quantityAtHand: 4, unitCostCents: 0 });
    await db.collection('inventory').doc(`${other}_item`).set({ workspaceId: other, name: 'theirs', quantityAtHand: 3, unitCostCents: 100 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/inventory', inventoryRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'inventory', 'chartAccounts', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]);
    }
    await db.terminate();
  });

  test('3 damaged bolts at cost 4.00: inventory −12.00, variance +12.00, in euros; 10 → 7', async () => {
    const res = await post('book', 'adjust', { itemId: id('bolts'), quantityChange: -3, reason: 'Damaged in storage' });
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.newQuantity, 7);
    assert.equal((await qty('bolts'))?.quantityAtHand, 7);
    const tx = await entry(body.transactionId);
    assert.equal(tx?.currency, 'EUR');
    assert.deepEqual(tx?.lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]), [[id('inv'), -1200], [id('shrink'), 1200]]);
    assert.equal(tx?.metadata.reason, 'Damaged in storage');
  });

  test('a purchase of 10 at 6.00 adds 60.00 and averages the cost: (7×4.00 + 10×6.00) / 17 = 5.18', async () => {
    const res = await post('owner', 'adjust', { itemId: id('bolts'), quantityChange: 10, unitCostCents: 600, type: 'purchase', offsetAccountId: id('ap') });
    assert.equal(res.status, 200, await res.clone().text());
    const item = await qty('bolts');
    assert.deepEqual({ q: item?.quantityAtHand, cost: item?.unitCostCents }, { q: 17, cost: 518 });
    const tx = await entry((await res.json()).transactionId);
    assert.deepEqual(tx?.lines.map((l: { amountCents: number }) => l.amountCents), [6000, -6000]);
  });

  test('a stock count adjusts every item that differs in one entry; unchanged items are left alone', async () => {
    const res = await post('book', 'count', { reason: 'July count', counts: [
      { itemId: id('bolts'), counted: 15 },   // 17 → 15 at 5.18: −10.36
      { itemId: id('nuts'), counted: 8 },     // 5 → 8 at 2.50: +7.50
      { itemId: id('washers'), counted: 20 }, // unchanged
    ] });
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.valueCents, -1036 + 750);
    assert.deepEqual(body.items.map((i: { itemId: string; before: number; after: number }) => [i.itemId, i.before, i.after]), [[id('bolts'), 17, 15], [id('nuts'), 5, 8]]);
    const tx = await entry(body.transactionId);
    assert.deepEqual(tx?.lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]), [[id('inv'), -1036], [id('inv'), 750], [id('shrink'), 286]]);
    assert.equal(tx?.lines.reduce((s: number, l: { amountCents: number }) => s + l.amountCents, 0), 0);
    assert.equal((await qty('washers'))?.quantityAtHand, 20);
  });

  test('refused: below zero (nothing changes), a viewer, another workspace\'s item, a count with no differences', async () => {
    const tooMany = await post('owner', 'adjust', { itemId: id('nuts'), quantityChange: -9 });
    assert.equal(tooMany.status, 400);
    assert.match((await tooMany.json()).error, /only 8 on hand/);
    assert.equal((await qty('nuts'))?.quantityAtHand, 8);
    assert.equal((await post('view', 'adjust', { itemId: id('nuts'), quantityChange: 1 })).status, 403);
    assert.equal((await post('view', 'count', { counts: [{ itemId: id('nuts'), counted: 1 }] })).status, 403);
    assert.equal((await post('owner', 'adjust', { itemId: `${other}_item`, quantityChange: -1 })).status, 404);
    const same = await post('owner', 'count', { counts: [{ itemId: id('washers'), counted: 20 }] });
    assert.equal(same.status, 400);
    assert.equal((await post('owner', 'adjust', { itemId: id('nuts'), quantityChange: 1, offsetAccountId: id('inv') })).status, 400);
  });

  test('recording a sale (/cogs): cost of 2 washers at 0.10 → COGS +0.20, inventory −0.20, 20 → 18; the same key twice posts once', async () => {
    const sell = (uid: string, body: Record<string, unknown>, key?: string) => fetch(`${base}/api/v1/inventory/cogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-uid': uid, ...(key ? { 'Idempotency-Key': key } : {}) },
      body: JSON.stringify({ workspaceId: ws, inventoryAccountId: id('inv'), cogsAccountId: id('shrink'), date: '2026-07-11', ...body }),
    });
    const res = await sell('book', { itemId: id('washers'), quantitySold: 2 }, 'sale-1');
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.equal(body.totalCogsCents, 20);
    assert.equal((await qty('washers'))?.quantityAtHand, 18);
    const tx = await entry(body.transactionId);
    assert.equal(tx?.currency, 'EUR');
    assert.equal(tx?.date, '2026-07-11');
    assert.deepEqual(tx?.lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]), [[id('shrink'), 20], [id('inv'), -20]]);
    const again = await sell('book', { itemId: id('washers'), quantitySold: 2 }, 'sale-1');
    assert.equal((await again.json()).transactionId, body.transactionId, 'the same request answers with the first result');
    assert.equal((await qty('washers'))?.quantityAtHand, 18, 'stock lowered once');

    assert.equal((await sell('book', { itemId: id('washers'), quantitySold: 19 })).status, 400, 'more than on hand');
    assert.equal((await qty('washers'))?.quantityAtHand, 18);
    assert.equal((await sell('view', { itemId: id('washers'), quantitySold: 1 })).status, 403, 'viewer');
    assert.equal((await sell('book', { itemId: id('washers'), quantitySold: 1.5 })).status, 400, 'whole units only');
    assert.equal((await sell('book', { itemId: id('washers') })).status, 400, 'quantity missing');
    assert.equal((await sell('book', { itemId: id('free'), quantitySold: 1 })).status, 400, 'no cost set');
    assert.equal((await sell('book', { itemId: `${ws}_missing`, quantitySold: 1 })).status, 404);
    assert.equal((await sell('owner', { itemId: `${other}_item`, quantitySold: 1 })).status, 403, "another workspace's item");
  });
});
