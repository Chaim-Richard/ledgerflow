/**
 * Buying stock on a bill (J-08), through the app's own bill posting and the real server: a bill line
 * that names an item and its units posts to Inventory; the stock comes in with the bill's entry, at
 * the value that line posted, the item's average cost moves with it, and the purchase is in the
 * stock history with its bill. Editing the bill takes the old units out and the new ones in; voiding
 * it takes them out. A line with an item and no units is refused before anything is posted.
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import type { Bill, ChartAccount, Transaction, Workspace } from '../types';
// the browser's posting host (stores + upload), as LedgerPostService registers it in the app (L-94)
import '../services/ledgerPost/postingKit';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Buying stock on a bill', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_billstock_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  const billId = `${ws}_bill1`;
  const itemId = `${ws}_chair`;
  let server: Server;
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const accounts: ChartAccount[] = [];
  const context = async (): Promise<LedgerPostContext> => ({
    accounts, lockDate: null, uid: OWNER, inventory: [],
    transactions: (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as Transaction),
    workspaces: [{ id: ws, uid: OWNER, name: 'Shop', currency: 'USD' } as Workspace],
  });
  const bill = (splits: Bill['splits'], status: Bill['status'] = 'pending'): Partial<Bill> => ({
    id: billId, workspaceId: ws, number: 'B-1', vendorName: 'Furniture Co', date: '2026-04-01', dueDate: '2026-05-01', status, currency: 'USD',
    amountCents: (splits || []).reduce((s, x) => s + x.amountCents, 0), splits,
  });
  const post = async (data: Partial<Bill>) => postBillLedger(billId, data, ws, OWNER, { collection: 'bills', docId: billId, action: 'update', data }, await context());
  const item = async () => (await db.collection('inventory').doc(itemId).get()).data()!;
  const balance = async (accountId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs
    .map(d => d.data() as Transaction).filter(t => t.status === 'completed').flatMap(t => t.lines || []).filter(l => l.accountId === accountId).reduce((s, l) => s + l.amountCents, 0);

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Shop', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    for (const [id, name, type, code] of [['ap', 'Accounts Payable', 'liability', '2000'], ['inv', 'Inventory', 'asset', '1300'], ['office', 'Office expenses', 'expense', '6000'], ['cash', 'Checking', 'asset', '1000']]) {
      const data = { workspaceId: ws, name, type, code, ...(id === 'ap' ? { category: 'Payables' } : {}), ...(id === 'inv' ? { category: 'Inventory', role: 'inventory' } : {}), ...(id === 'cash' ? { category: 'Cash', role: 'cash' } : {}) };
      await db.collection('chartAccounts').doc(`${ws}_${id}`).set(data);
      accounts.push({ ...data, id: `${ws}_${id}` } as unknown as ChartAccount);
    }
    await db.collection('inventory').doc(itemId).set({ workspaceId: ws, name: 'Chair', sku: 'CH', quantityAtHand: 2, unitCostCents: 1000, uid: OWNER });
    await db.collection('bills').doc(billId).set({ workspaceId: ws, number: 'B-1', status: 'draft', amountCents: 0, uid: OWNER });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@shop.test' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'bills', 'inventory', 'stockMoves', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('3 chairs at 36.00 come in with the bill, at the value posted to Inventory; the average cost moves', async () => {
    await post(bill([
      { amountCents: 3600, accountId: `${ws}_office`, description: 'Chairs', itemId, quantity: 3 },
      { amountCents: 1000, accountId: `${ws}_office`, description: 'Delivery fee' },
    ]));
    const chair = await item();
    assert.deepEqual([chair.quantityAtHand, chair.unitCostCents], [5, 1120], '(2 × 10.00 + 36.00) / 5');
    assert.equal(await balance(`${ws}_inv`), 3600, 'the item line went to Inventory, whatever account was on it');
    assert.equal(await balance(`${ws}_office`), 1000);
    assert.equal(await balance(`${ws}_ap`), -4600);
    const moves = (await db.collection('stockMoves').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    assert.deepEqual(moves.map(m => [m.kind, m.quantity, m.quantityAfter, m.valueCents, m.documentType, m.documentId]), [['purchase', 3, 5, 3600, 'bill', billId]]);
  });

  test('editing the bill takes the old units out and the new ones in; voiding it takes them out', async () => {
    await post(bill([{ amountCents: 4000, accountId: `${ws}_office`, description: 'Chairs', itemId, quantity: 4 }]));
    let chair = await item();
    assert.deepEqual([chair.quantityAtHand, chair.unitCostCents], [6, 1000], 'back to 2 at 10.00, then 4 at 10.00');
    assert.equal(await balance(`${ws}_inv`), 4000);
    await post(bill([{ amountCents: 4000, accountId: `${ws}_office`, description: 'Chairs', itemId, quantity: 4 }], 'void'));
    chair = await item();
    assert.deepEqual([chair.quantityAtHand, chair.unitCostCents], [2, 1000]);
    assert.equal(await balance(`${ws}_inv`), 0);
    const kinds = (await db.collection('stockMoves').where('workspaceId', '==', ws).get()).docs.map(d => d.data()).sort((a, b) => String(a.seq).localeCompare(String(b.seq))).map(m => m.kind);
    assert.deepEqual(kinds, ['purchase', 'purchase-reversal', 'purchase', 'purchase-reversal']);
  });

  test('freight spread over the items adds to what they cost and goes to Inventory (BA-03)', async () => {
    await post(bill([
      { amountCents: 2000, accountId: `${ws}_office`, description: 'Chairs', itemId, quantity: 2 },
      { amountCents: 500, accountId: `${ws}_office`, description: 'Freight', landedCost: true },
      { amountCents: 300, accountId: `${ws}_office`, description: 'Stationery' },
    ]));
    const chair = await item();
    assert.deepEqual([chair.quantityAtHand, chair.unitCostCents], [4, 1125], '(2 × 10.00 + 20.00 + 5.00 freight) / 4');
    assert.equal(await balance(`${ws}_inv`), 2500);
    assert.equal(await balance(`${ws}_office`), 300);
    const last = (await db.collection('stockMoves').where('workspaceId', '==', ws).get()).docs.map(d => d.data()).sort((a, b) => String(b.seq).localeCompare(String(a.seq)))[0];
    assert.deepEqual([last.kind, last.quantity, last.valueCents], ['purchase', 2, 2500]);
    await post(bill([{ amountCents: 2000, accountId: `${ws}_office`, itemId, quantity: 2 }], 'void'));
    assert.equal((await item()).quantityAtHand, 2);
  });

  test('deleting a bill takes its units out again', async () => {
    await post(bill([{ amountCents: 3000, accountId: `${ws}_office`, itemId, quantity: 3 }]));
    assert.equal((await item()).quantityAtHand, 5);
    const { deletePostings } = await import('../services/ledgerPost/deletePostings');
    await deletePostings(billId, 'billId', ws, { collection: 'bills', docId: billId, action: 'delete' }, await context());
    assert.equal((await item()).quantityAtHand, 2);
    assert.equal(await balance(`${ws}_inv`), 0);
  });

  test('an item line without units is refused before anything is posted', async () => {
    const before = (await db.collection('transactions').where('workspaceId', '==', ws).get()).size;
    await assert.rejects(post(bill([{ amountCents: 500, accountId: `${ws}_office`, itemId }])), /how many units came in/);
    assert.equal((await db.collection('transactions').where('workspaceId', '==', ws).get()).size, before);
  });
});
