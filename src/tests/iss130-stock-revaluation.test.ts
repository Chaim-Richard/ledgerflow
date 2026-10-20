/**
 * ISS-130 (GitHub #130): POST /api/v1/inventory/revalue. Changing the unit cost of stock on hand posts the change in
 * value to Inventory against the chosen offset account, in the same database transaction as the new cost; a retry
 * posts nothing twice; the period lock, roles and workspaces are checked; the stock history keeps the change. The
 * browser side (the cost of stock on hand is refused outside the revaluation) is in supabase/tests/rls.test.sql.
 * Needs LF_TEST_DATABASE_URL.
 *
 * Worked figures (cents), the issue's own example:
 *   opening stock 10 widgets at 10.00            Inventory +10,000   (Opening balance −10,000)
 *   revalue to 12.00: 10 × 1,200 − 10 × 1,000 =  Inventory  +2,000   (Revaluation     −2,000)
 *   Inventory Valuation: 10 × 12.00 = 12,000 = the Inventory account 10,000 + 2,000 → they agree (difference 0)
 * A write-down of 3 gears from 3.33 to 2.50: 3 × 250 − 3 × 333 = 750 − 999 = −249.
 * Half units: 2.5 rods from 10.00 to 10.01: round(2.5 × 1,001) − 2.5 × 1,000 = 2,503 − 2,500 = +3.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { revaluationValueCents } from '../lib/inventoryAccounts';

const url = process.env.LF_TEST_DATABASE_URL;

test('ISS-130 worked figures: the value change is the stock at the new cost less the stock at the old cost', () => {
  assert.equal(revaluationValueCents(10, 1_000, 1_200), 2_000);
  assert.equal(revaluationValueCents(3, 333, 250), -249);
  assert.equal(revaluationValueCents(2.5, 1_000, 1_001), 3);
  assert.equal(revaluationValueCents(0, 1_000, 5_000), 0, 'nothing on hand: nothing to revalue');
});

describe('Stock revaluation', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_reval_${crypto.randomBytes(4).toString('hex')}`;
  const other = `${ws}_other`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = (uid: string, path: string, body: Record<string, unknown>) =>
    fetch(`${base}/api/v1/inventory/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ workspaceId: ws, inventoryAccountId: id('inv'), date: '2026-07-10', ...body }) });
  const revalue = (uid: string, body: Record<string, unknown>) =>
    call(uid, 'revalue', { offsetAccountId: id('reval'), reason: 'Supplier price list', requestId: `req-${crypto.randomBytes(6).toString('hex')}`, ...body });
  const item = async (name: string) => (await db.collection('inventory').doc(id(name)).get()).data();
  const entries = async () => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string; lines: Array<{ accountId: string; amountCents: number }>; metadata: Record<string, unknown> });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner', name: 'Reval Co', currency: 'USD', members: ['owner', 'acct', 'book', 'view'], roles: { acct: 'accountant', book: 'bookkeeper', view: 'viewer' } });
    await db.collection('workspaces').doc(other).set({ uid: 'x', name: 'Other', currency: 'USD', members: ['x'] });
    const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, name, ...fields });
    await account('inv', { type: 'asset', category: 'Inventory', code: '1300', name: 'Inventory' });
    await account('equity', { type: 'equity', category: 'Equity', code: '3900', name: 'Opening Balance Equity' });
    await account('reval', { type: 'expense', category: 'COGS', code: '5150', name: 'Inventory revaluation' });
    await account('bank', { type: 'asset', category: 'Bank', code: '1000', name: 'Checking' });
    await account('inv2', { type: 'asset', category: 'Inventory', code: '1310', name: 'Inventory 2' });
    const put = (name: string, fields: Record<string, unknown>) => db.collection('inventory').doc(id(name)).set({ workspaceId: ws, name, sku: name.toUpperCase(), unitPriceCents: 2_000, reorderPoint: 0, ...fields });
    await put('widgets', { quantityAtHand: 0, unitCostCents: 1_000 });
    await put('gears', { quantityAtHand: 3, unitCostCents: 333 });
    await put('rods', { quantityAtHand: 2.5, unitCostCents: 1_000 });
    await put('empty', { quantityAtHand: 0, unitCostCents: 500 });
    await put('bolts', { quantityAtHand: 4, unitCostCents: 1_000 });
    await put('dust', { quantityAtHand: 0.1, unitCostCents: 100 });
    await put('short', { quantityAtHand: -2, unitCostCents: 700 });
    await db.collection('inventory').doc(`${other}_item`).set({ workspaceId: other, name: 'theirs', quantityAtHand: 3, unitCostCents: 100 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/inventory', inventoryRouter);
    app.use('/api/v1/transactions', transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'inventory', 'chartAccounts', 'stockMoves', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]).catch(() => {});
    }
    await db.terminate();
  });

  test('the issue\'s example: 10 widgets at 10.00 revalued to 12.00 → Inventory +20.00, and the stock list still agrees with the books', async () => {
    const opening = await call('owner', 'adjust', { itemId: id('widgets'), quantityChange: 10, type: 'opening', offsetAccountId: id('equity') });
    assert.equal(opening.status, 200, await opening.clone().text());
    const res = await revalue('acct', { itemId: id('widgets'), newUnitCostCents: 1_200 });
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.deepEqual([body.quantity, body.oldUnitCostCents, body.newUnitCostCents, body.valueCents, body.replayed], [10, 1_000, 1_200, 2_000, false]);
    assert.equal((await item('widgets'))?.unitCostCents, 1_200);
    const tx = (await entries()).find(e => e.id === body.transactionId)!;
    assert.deepEqual(tx.lines.map(l => [l.accountId, l.amountCents]), [[id('inv'), 2_000], [id('reval'), -2_000]]);
    assert.deepEqual([tx.metadata.type, tx.metadata.reason], ['stock-revaluation', 'Supplier price list']);
    // the stock list (10 × 12.00) and the Inventory account (10,000 + 2,000) agree
    const { computeInventoryValuation } = await import('../server/reports/itemReports');
    const accounts = (await db.collection('chartAccounts').where('workspaceId', '==', ws).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const items = (await db.collection('inventory').where('workspaceId', '==', ws).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const valuation = computeInventoryValuation(items.filter(i => i.id === id('widgets')) as never, accounts as never, (await entries()) as never, '2026-07-31');
    assert.deepEqual([valuation.totalValueCents, valuation.ledgerValueCents, valuation.differenceCents], [12_000, 12_000, 0]);
    // the stock history keeps the change of value, with no units moved
    const moves = (await db.collection('stockMoves').where('workspaceId', '==', ws).where('itemId', '==', id('widgets')).get()).docs.map(d => d.data());
    const reval = moves.find(m => m.kind === 'revaluation');
    assert.deepEqual(reval && [reval.quantity, reval.quantityBefore, reval.quantityAfter, reval.valueCents, reval.transactionId], [0, 10, 10, 2_000, body.transactionId]);
  });

  test('a retry with the same request id posts nothing again and leaves the cost as the first call set it', async () => {
    const requestId = `retry-${crypto.randomBytes(6).toString('hex')}`;
    const first = await revalue('owner', { itemId: id('gears'), newUnitCostCents: 250, requestId });
    assert.equal(first.status, 200, await first.clone().text());
    const firstBody = await first.json();
    assert.equal(firstBody.valueCents, -249, '3 × 2.50 − 3 × 3.33 = 7.50 − 9.99');
    const before = (await entries()).length;
    const again = await revalue('owner', { itemId: id('gears'), newUnitCostCents: 999, requestId });
    assert.equal(again.status, 200, await again.clone().text());
    const againBody = await again.json();
    assert.deepEqual([againBody.replayed, againBody.transactionId, againBody.newUnitCostCents, againBody.valueCents], [true, firstBody.transactionId, 250, -249]);
    assert.equal((await entries()).length, before, 'no second entry');
    assert.equal((await item('gears'))?.unitCostCents, 250, 'the retry did not apply its own cost');
  });

  test('half units: 2.5 rods from 10.00 to 10.01 → +0.03, exact cents', async () => {
    const res = await revalue('owner', { itemId: id('rods'), newUnitCostCents: 1_001 });
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal((await res.json()).valueCents, 3);
  });

  test('refused: a bookkeeper or viewer, another workspace\'s item, no stock, the same cost, a locked period, no reason', async () => {
    assert.equal((await revalue('book', { itemId: id('rods'), newUnitCostCents: 900 })).status, 403);
    assert.equal((await revalue('view', { itemId: id('rods'), newUnitCostCents: 900 })).status, 403);
    assert.equal((await revalue('owner', { itemId: `${other}_item`, newUnitCostCents: 900 })).status, 404);
    const empty = await revalue('owner', { itemId: id('empty'), newUnitCostCents: 900 });
    assert.equal(empty.status, 400);
    assert.match((await empty.json()).error, /no stock on hand/);
    assert.match((await (await revalue('owner', { itemId: id('rods'), newUnitCostCents: 1_001 })).json()).error, /already costs that/);
    assert.equal((await revalue('owner', { itemId: id('rods'), newUnitCostCents: 900, reason: '' })).status, 400);
    assert.equal((await revalue('owner', { itemId: id('rods'), newUnitCostCents: 900, offsetAccountId: id('inv') })).status, 400);
    await db.collection('workspaces').doc(ws).set({ lockDate: '2026-06-30' }, { merge: true });
    const locked = await revalue('owner', { itemId: id('rods'), newUnitCostCents: 900, date: '2026-06-15' });
    assert.notEqual(locked.status, 200, 'a locked period takes no revaluation');
    assert.equal((await item('rods'))?.unitCostCents, 1_001, 'nothing changed by the refused calls');
  });

  // ---- #259 review ----
  test('refused: an offset that is cash or Inventory, a stock leg that is not Inventory, a date after today', async () => {
    const bad = async (body: Record<string, unknown>) => (await (await revalue('owner', { itemId: id('bolts'), newUnitCostCents: 1_100, ...body })).json()).error as string;
    assert.match(await bad({ offsetAccountId: id('bank') }), /cannot go to a bank or cash account/);
    assert.match(await bad({ offsetAccountId: id('inv2') }), /cannot go to an Inventory account/);
    assert.match(await bad({ inventoryAccountId: id('equity') }), /is not an Inventory account/);
    assert.match(await bad({ date: '2099-01-01' }), /cannot be dated after today/);
    assert.equal((await item('bolts'))?.unitCostCents, 1_000, 'nothing changed');
  });

  test('refused: a date before a later stock change of the item (today\'s quantity would be posted on an old date)', async () => {
    // widgets were opened on 2026-07-10: a revaluation dated 2026-07-01 would revalue units not yet there
    const res = await revalue('owner', { itemId: id('widgets'), newUnitCostCents: 1_300, date: '2026-07-01' });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /stock changed on 2026-07-10, after 2026-07-01/);
  });

  test('refused: a change worth less than a cent (0.1 unit from 1.00 to 1.01) — nothing changes, so a retry is the same answer', async () => {
    const requestId = `dust-${crypto.randomBytes(6).toString('hex')}`;
    const first = await revalue('owner', { itemId: id('dust'), newUnitCostCents: 101, requestId });
    assert.equal(first.status, 400);
    assert.match((await first.json()).error, /less than a cent/);
    assert.equal((await item('dust'))?.unitCostCents, 100);
    assert.equal((await revalue('owner', { itemId: id('dust'), newUnitCostCents: 101, requestId })).status, 400);
  });

  test('stock below zero has no value to revalue: refused here, its cost stays editable on the item', async () => {
    const res = await revalue('owner', { itemId: id('short'), newUnitCostCents: 800 });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /no stock on hand/);
  });

  test('a revaluation entry cannot be edited, voided, deleted or reversed through the generic paths', async () => {
    const reval = (await entries()).find(e => e.metadata?.type === 'stock-revaluation')!;
    const send = (method: string, path: string, body?: unknown) => fetch(`${base}/api/v1/transactions${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-test-uid': 'owner' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const voided = await send('PUT', `/${reval.id}`, { partialUpdate: { status: 'void' } });
    assert.equal(voided.status, 400);
    assert.match((await voided.json()).error, /This entry is a stock revaluation of \w+\. To undo it, revalue/);
    const edited = await send('PUT', `/${reval.id}`, { transaction: { ...reval, description: 'changed' } });
    assert.match((await edited.json()).error || '', /stock revaluation/);
    const deleted = await send('DELETE', `/${reval.id}?workspaceId=${ws}`);
    assert.ok([403, 409].includes(deleted.status), 'refused (a posted entry is never deleted; a revaluation is refused too)');
    const reversed = await send('POST', `/${reval.id}/reverse`, { workspaceId: ws, reversalDate: '2026-07-31', reason: 'undo' });
    assert.equal(reversed.status, 409);
    const still = (await db.collection('transactions').doc(reval.id).get()).data();
    assert.deepEqual([still?.status, still?.reversalEventId, still?.description], ['approved', undefined, reval.description]);
  });
});
