/**
 * EG-7: the stock closing snapshot and the stock invariant checks (src/lib/stockInvariants.ts,
 * src/server/services/stockClosingService.ts, POST/GET /api/v1/inventory/stock-closing). The DB part needs
 * LF_TEST_DATABASE_URL; the browser side (nobody writes stockClosings) is in supabase/tests/rls.test.sql.
 *
 * Hand-worked figures (cents), moving average:
 *   2026-01-10  buy 10 widgets @ 10.00           stock +10,000   Inventory +10,000   10 on hand @ 10.00
 *   2026-02-10  buy 10 widgets @ 20.00           stock +20,000   Inventory +20,000   20 on hand @ (10,000 + 20,000) / 20 = 15.00
 *   2026-03-05  take out 5 @ 15.00               stock  −7,500   Inventory  −7,500   15 on hand @ 15.00
 *   on hand 15 @ 15.00 = 22,500; Inventory 10,000 + 20,000 − 7,500 = 22,500 → the closing at 2026-03-31 shows a
 *   difference of 0, one row (widget, no location, 15, 22,500, 3 moves).
 *   2026-04-15  a manual journal Inventory +1,000 / Equity −1,000, no stock move
 *     → check (a) at 2026-04-30: stock 22,500, books 23,500, difference (stock − books) −1,000, put on that journal.
 *   gizmo: 2026-05-10 buy 5 @ 5.00; then a move dated back to 2026-05-01 taking out 3 (5 → 2 in the order written)
 *     → by the dates, gizmo ends 2026-05-01 at −3: check (b) names gizmo and 2026-05-01.
 *   the 2026-03-05 move edited (−5 → −6) in the closed period → the closing's checksum no longer matches: stale (c).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import type { StockMove } from '../lib/stockMoves';
import type { ChartAccount, Transaction } from '../types';
import { buildStockClosing, checkStockAgainstBooks, closingFreshness, datedQuantities, fnv64, negativeStockDays, STOCK_INVARIANT_CHECKS } from '../lib/stockInvariants';
import { runDataChecks } from '../lib/dataChecks';

const url = process.env.LF_TEST_DATABASE_URL;

let n = 0;
const mv = (o: Partial<StockMove> & { quantity: number; quantityBefore: number; valueCents: number }): StockMove => ({
  id: `m${++n}`, workspaceId: 'ws', itemId: 'widget', itemName: 'Widget', date: '2026-01-10', kind: 'purchase', quantityAfter: o.quantityBefore + o.quantity,
  unitCostCents: 0, seq: `2026-01-01T00:00:00Z-${String(n).padStart(4, '0')}`, uid: 'u', createdAt: '2026-01-01T00:00:00Z', ...o,
});

test('EG-7 pure: the worked closing, the dated quantities, the checksum and the three checks', () => {
  const moves = [
    mv({ quantity: 10, quantityBefore: 0, valueCents: 10_000, transactionId: 't1' }),
    mv({ date: '2026-02-10', quantity: 10, quantityBefore: 10, valueCents: 20_000, transactionId: 't2', locationId: 'L1' }),
    mv({ date: '2026-03-05', kind: 'adjustment', quantity: -5, quantityBefore: 20, valueCents: -7_500, transactionId: 't3' }),
  ];
  const closing = buildStockClosing({ workspaceId: 'ws', asOf: '2026-03-31', moves, inventoryBalanceCents: 22_500, builtBy: 'u', at: 'now' });
  assert.deepEqual([closing.stockValueCents, closing.differenceCents, closing.moveCount], [22_500, 0, 3]);
  assert.deepEqual(closing.rows.map(r => [r.locationId, r.quantity, r.valueCents, r.moveCount]), [['', 5, 2_500], ['L1', 10, 20_000]].map(([l, q, v], i) => [l, q, v, i === 0 ? 2 : 1]));
  assert.equal(fnv64('a'), 'af63dc4c8601ec8c', 'FNV-1a 64 of "a"');
  const accounts = [{ id: 'inv', name: 'Inventory', type: 'asset', category: 'Inventory' }, { id: 'eq', name: 'Equity', type: 'equity' }] as ChartAccount[];
  const tx = (id: string, date: string, cents: number) => ({ id, date, status: 'completed', type: 'journal', lines: [{ accountId: 'inv', amountCents: cents }, { accountId: 'eq', amountCents: -cents }] }) as unknown as Transaction;
  const entries = [tx('t1', '2026-01-10', 10_000), tx('t2', '2026-02-10', 20_000), tx('t3', '2026-03-05', -7_400), tx('j', '2026-03-20', 1_000)];
  const books = checkStockAgainstBooks({ asOf: '2026-03-31', moves, entries, accounts });
  assert.deepEqual([books.stockValueCents, books.inventoryBalanceCents, books.differenceCents], [22_500, 23_600, -1_100]);
  assert.deepEqual(books.byItem.map(i => [i.itemName, i.differenceCents]), [['Widget', -100]], 't3 posted 74.00 against a move of 75.00');
  assert.deepEqual(books.unattributed.map(u => [u.transactionId, u.differenceCents]), [['j', -1_000]]);
  assert.match(books.message, /books have 11\.00 more than the stock/);
  const back = [...moves, mv({ date: '2026-01-05', kind: 'adjustment', quantity: -12, quantityBefore: 15, valueCents: -18_000 })];
  assert.deepEqual(datedQuantities(back).get('widget')?.[0], { date: '2026-01-05', quantity: -12 });
  assert.deepEqual(negativeStockDays(back).items.map(i => [i.itemName, i.date]), [['Widget', '2026-01-05']]);
  assert.equal(negativeStockDays(moves).ok, true);
  assert.equal(closingFreshness(closing, moves).fresh, true);
  const edited = moves.map(m => m.id === moves[2].id ? { ...m, quantity: -6, valueCents: -9_000 } : m);
  const stale = closingFreshness(closing, edited);
  assert.deepEqual([stale.fresh, stale.changedItems], [false, ['Widget']]);
  assert.equal(closingFreshness(closing, [...moves, mv({ date: '2026-04-02', quantity: 1, quantityBefore: 15, valueCents: 1_500 })]).fresh, true, 'a move after the period end does not touch it');
  const found = runDataChecks({ transactions: entries, accounts, invoices: [], bills: [], recurring: [], today: '2026-03-31', baseCurrency: 'USD', stockMoves: edited, stockClosings: [closing] }, STOCK_INVARIANT_CHECKS);
  assert.deepEqual(found.map(f => f.checkId).sort(), ['stock-closing-stale', 'stock-vs-books']);
});

describe('EG-7 stock closing on a real database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg7_${crypto.randomBytes(4).toString('hex')}`;
  const id = (s: string) => `${ws}_${s}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const send = async (uid: string, method: string, path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const adjust = async (body: Record<string, unknown>) => {
    const r = await send('owner', 'POST', '/api/v1/inventory/adjust', { workspaceId: ws, inventoryAccountId: id('inv'), offsetAccountId: id('equity'), ...body });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const read = async (asOf?: string) => {
    const r = await send('view', 'GET', `/api/v1/inventory/stock-closing?workspaceId=${ws}${asOf ? `&asOf=${asOf}` : ''}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner', name: 'EG-7 Co', currency: 'USD', timezone: 'UTC', members: ['owner', 'acct', 'view'], roles: { acct: 'accountant', view: 'viewer' } });
    const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, ...fields });
    await account('inv', { type: 'asset', category: 'Inventory', code: '1300', name: 'Inventory' });
    await account('equity', { type: 'equity', category: 'Equity', code: '3900', name: 'Opening Balance Equity' });
    const item = (name: string, cost: number) => db.collection('inventory').doc(id(name)).set({ workspaceId: ws, name, sku: name.toUpperCase(), quantityAtHand: 0, unitCostCents: cost, unitPriceCents: 5_000, reorderPoint: 0 });
    await item('widget', 1_000);
    await item('gizmo', 500);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/inventory', (await import('../server/routes/inventoryRoutes')).inventoryRouter);
    app.use('/api/v1/transactions', (await import('../server/routes/transactionRoutes')).transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'inventory', 'chartAccounts', 'stockMoves', 'stockClosings', 'periodBalances', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.terminate();
  });

  test('buy 10 @ 10.00, buy 10 @ 20.00, take out 5 → 15 @ 15.00 = 225.00; the closing equals the Inventory account', async () => {
    await adjust({ itemId: id('widget'), quantityChange: 10, unitCostCents: 1_000, type: 'purchase', date: '2026-01-10' });
    await adjust({ itemId: id('widget'), quantityChange: 10, unitCostCents: 2_000, type: 'purchase', date: '2026-02-10' });
    await adjust({ itemId: id('widget'), quantityChange: -5, type: 'adjustment', date: '2026-03-05' });
    assert.equal((await db.collection('inventory').doc(id('widget')).get()).data()?.unitCostCents, 1_500);
    const early = await send('owner', 'POST', '/api/v1/inventory/stock-closing', { workspaceId: ws, asOf: '2026-03-31' });
    assert.equal(early.status, 409, 'not locked yet');
    const closeYear = await send('owner', 'POST', '/api/v1/transactions/close-year', { workspaceId: ws, closingDate: '2026-03-31', lockPeriod: true });
    assert.equal(closeYear.status, 200, JSON.stringify(closeYear.body));
    assert.equal((await send('acct', 'POST', '/api/v1/inventory/stock-closing', { workspaceId: ws })).status, 403, 'owners only');
    const r = await send('owner', 'POST', '/api/v1/inventory/stock-closing', { workspaceId: ws });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const c = r.body.closing;
    assert.deepEqual([c.asOf, c.stockValueCents, c.inventoryBalanceCents, c.differenceCents, c.moveCount], ['2026-03-31', 22_500, 22_500, 0, 3]);
    assert.deepEqual(c.rows.map((x: { itemId: string; locationId: string; quantity: number; valueCents: number; moveCount: number }) => [x.itemId, x.locationId, x.quantity, x.valueCents, x.moveCount]), [[id('widget'), '', 15, 22_500, 3]]);
    const stored = (await db.collection('stockClosings').doc(`${ws}_2026-03-31`).get()).data();
    assert.equal(stored?.checksum, c.checksum);
    const got = await read();
    assert.deepEqual([got.closing.fresh, got.books.ok, got.books.differenceCents, got.negative.ok], [true, true, 0, true]);
    assert.equal((await send('owner', 'POST', '/api/v1/inventory/stock-closing', { workspaceId: ws, asOf: '2026-06-30' })).status, 409, 'after the lock date');
  });

  test('(a) a manual journal of 10.00 to Inventory: the books are 10.00 more than the stock, put on that journal', async () => {
    await db.collection('transactions').doc(id('journal')).set({
      workspaceId: ws, uid: 'owner', date: '2026-04-15', description: 'Manual inventory journal', status: 'completed', type: 'journal', currency: 'USD', totalAmountCents: 1_000,
      lines: [{ accountId: id('inv'), amountCents: 1_000 }, { accountId: id('equity'), amountCents: -1_000 }],
    });
    const got = await read('2026-04-30');
    assert.deepEqual([got.books.stockValueCents, got.books.inventoryBalanceCents, got.books.differenceCents], [22_500, 23_500, -1_000]);
    assert.deepEqual(got.books.unattributed.map((u: { transactionId: string; differenceCents: number }) => [u.transactionId, u.differenceCents]), [[id('journal'), -1_000]]);
    assert.deepEqual(got.books.byItem, []);
    assert.match(got.books.message, /books have 10\.00 more than the stock/);
  });

  test('(b) a move dated back takes gizmo below zero on 2026-05-01', async () => {
    await adjust({ itemId: id('gizmo'), quantityChange: 5, unitCostCents: 500, type: 'purchase', date: '2026-05-10' });
    await adjust({ itemId: id('gizmo'), quantityChange: -3, type: 'adjustment', date: '2026-05-01' });
    const got = await read('2026-05-31');
    assert.equal(got.negative.ok, false);
    assert.deepEqual(got.negative.items.map((i: { itemId: string; date: string; quantity: number }) => [i.itemId, i.date, i.quantity]), [[id('gizmo'), '2026-05-01', -3]]);
    assert.match(got.negative.message, /2026-05-01/);
  });

  test('(c) a move edited in the closed period makes the closing stale', async () => {
    const moves = (await db.collection('stockMoves').where('workspaceId', '==', ws).where('itemId', '==', id('widget')).get()).docs;
    const out = moves.find(d => d.data().date === '2026-03-05');
    assert.ok(out);
    await db.collection('stockMoves').doc(out.id).update({ quantity: -6, quantityAfter: 14, valueCents: -9_000 });
    const got = await read('2026-03-31');
    assert.equal(got.closing.fresh, false);
    assert.equal(got.closing.changedItems.length, 1);
    assert.match(got.closing.freshness, /stale/);
  });
});
