/**
 * The stock-moves ledger (W-02): every change to an item's quantity on hand is recorded with the
 * change, in the same database transaction:
 * - opening stock, purchases, adjustments and counts;
 * - sales (invoice cost-of-goods-sold entries) and their reversals;
 * - imported opening stock.
 * Each record keeps the quantity before and after, so the history explains the quantity on hand; the
 * nightly check reports an item whose quantity its history does not explain. Undoing an import
 * removes its items' history, and keeps an item that was already sold. The Stock history window lists
 * them. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import { commitAsServer } from './helpers/serverCommit';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { planInvoiceCogs } from '../services/invoiceCogs';
import { orderedMoves, stockHistoryProblem, type StockMove } from '../lib/stockMoves';
import { DATA_CHECKS } from '../lib/dataChecks';
import StockHistoryDialog from '../components/inventory/StockHistoryDialog';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeInvoice } from './fixtures';
import { getSupabase } from '../lib/db/client';
import type { InventoryItem } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;
const move = (over: Partial<StockMove>): StockMove => ({
  workspaceId: 'w', itemId: 'i', date: '2026-05-01', kind: 'adjustment', quantity: 0, quantityBefore: 0, quantityAfter: 0,
  unitCostCents: 400, valueCents: 0, seq: '1', uid: 'u', createdAt: '', ...over,
});

describe('The history explains the quantity', () => {
  test('in order, each change starts where the last ended, and the last ends at the quantity on hand', () => {
    const moves = [
      move({ seq: '2', kind: 'sale', quantity: -3, quantityBefore: 10, quantityAfter: 7 }),
      move({ seq: '1', kind: 'opening', quantity: 10, quantityBefore: 0, quantityAfter: 10 }),
    ];
    assert.deepEqual(orderedMoves(moves).map(m => m.kind), ['opening', 'sale']);
    assert.equal(stockHistoryProblem({ name: 'Chair', quantityAtHand: 7 }, moves), null);
    assert.equal(stockHistoryProblem({ name: 'Chair', quantityAtHand: 9 }, moves), 'Chair: 9 on hand, but its history ends at 7');
    assert.match(stockHistoryProblem({ name: 'Chair', quantityAtHand: 7 }, [...moves, move({ seq: '3', quantityBefore: 6, quantityAfter: 7, date: '2026-05-09' })]) || '', /a change on 2026-05-09 starts at 6, but the one before it ended at 7/);
    assert.equal(stockHistoryProblem({ name: 'Old', quantityAtHand: 5 }, []), null, 'an item with no history has nothing to explain');
  });
});

describe('Recorded with each change (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_moves_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  const item = `${ws}_chair`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const call = async (method: string, path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': OWNER }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const history = async (itemId = item) => orderedMoves((await db.collection('stockMoves').where('workspaceId', '==', ws).where('itemId', '==', itemId).get()).docs.map(d => d.data() as StockMove));
  const onHand = async (itemId = item) => (await db.collection('inventory').doc(itemId).get()).data()?.quantityAtHand;
  const sale = (id: string, quantity: number) => {
    const invoice = makeInvoice({ id: `${ws}_inv_${id}`, items: [{ id: 'l1', itemId: item, description: 'Chair', quantity, rateCents: 9000, amountCents: 9000 * quantity, accountId: 'sales', unitCostCents: 400 }] });
    const [entry] = planInvoiceCogs({ invoiceId: invoice.id, invoice, date: '2026-05-05', uid: OWNER, workspaceId: ws, baseCurrency: 'USD',
      inventoryAccount: { id: `${ws}_inv`, name: 'Inventory' }, cogsAccount: { id: `${ws}_cogs`, name: 'COGS' }, items: [{ id: item, name: 'Chair', unitCostCents: 400 }] }).entries;
    return { ...entry, id: `${ws}_${id}` };
  };
  const sold = { first: sale('s1', 3) };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Chairs', currency: 'USD', members: [OWNER] });
    await db.collection('chartAccounts').doc(`${ws}_inv`).set({ workspaceId: ws, name: 'Inventory', type: 'asset', category: 'Inventory', code: '1300' });
    await db.collection('chartAccounts').doc(`${ws}_cogs`).set({ workspaceId: ws, name: 'COGS', type: 'expense', category: 'COGS', code: '5000' });
    await db.collection('chartAccounts').doc(`${ws}_obe`).set({ workspaceId: ws, name: 'Opening Balance Equity', type: 'equity', category: 'Equity', code: '3200' });
    await db.collection('chartAccounts').doc(`${ws}_shrink`).set({ workspaceId: ws, name: 'Shrinkage', type: 'expense', code: '6900' });
    await db.collection('inventory').doc(item).set({ workspaceId: ws, name: 'Chair', sku: 'CH-1', unitCostCents: 400, unitPriceCents: 9000, quantityAtHand: 0 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    app.use('/api/v1/inventory', inventoryRouter);
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'inventory', 'stockMoves', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('opening stock, then a sale, two sales together, a reversal and a count: one record each, in order', async () => {
    const opening = await call('POST', '/api/v1/inventory/adjust', { workspaceId: ws, itemId: item, quantityChange: 10, type: 'opening', inventoryAccountId: `${ws}_inv`, offsetAccountId: `${ws}_obe`, date: '2026-05-01' });
    assert.equal(opening.status, 200, JSON.stringify(opening.body));
    assert.equal((await commitAsServer(db, OWNER, { workspaceId: ws, transactions: [sold.first] })).status, 200);
    assert.equal((await commitAsServer(db, OWNER, { workspaceId: ws, transactions: [sale('s2', 2), sale('s3', 1)] })).status, 200);
    const reversal = { ...sold.first, id: `${ws}_r1`, description: 'Reversal', metadata: { invoiceId: sold.first.metadata.invoiceId, isReversal: true, reversesTxId: sold.first.id },
      lines: sold.first.lines.map(l => ({ ...l, amountCents: -l.amountCents, debitCents: l.creditCents, creditCents: l.debitCents })) };
    assert.equal((await commitAsServer(db, OWNER, { workspaceId: ws, transactions: [reversal] })).status, 200);
    const count = await call('POST', '/api/v1/inventory/count', { workspaceId: ws, inventoryAccountId: `${ws}_inv`, offsetAccountId: `${ws}_shrink`, date: '2026-05-20', counts: [{ itemId: item, counted: 9 }] });
    assert.equal(count.status, 200, JSON.stringify(count.body));

    const moves = await history();
    assert.deepEqual(moves.map(m => [m.kind, m.quantity, m.quantityBefore, m.quantityAfter, m.valueCents]), [
      ['opening', 10, 0, 10, 4000],
      ['sale', -3, 10, 7, -1200],
      ['sale', -2, 7, 5, -800],
      ['sale', -1, 5, 4, -400],
      ['sale-reversal', 3, 4, 7, 1200],
      ['count', 2, 7, 9, 800],
    ]);
    assert.equal(moves[1].transactionId, sold.first.id);
    assert.equal(moves[1].documentId, sold.first.metadata.invoiceId);
    assert.equal(moves[4].transactionId, `${ws}_r1`, 'the reversal is recorded with its own entry');
    assert.equal(await onHand(), 9);
    assert.equal(stockHistoryProblem({ name: 'Chair', quantityAtHand: await onHand() }, moves), null);
  });

  test('a quantity changed behind the history\'s back is reported by the nightly check', async () => {
    await db.collection('inventory').doc(item).update({ quantityAtHand: 12 });
    const check = DATA_CHECKS.find(c => c.id === 'stock-history')!;
    const found = check.run({ transactions: [], accounts: [], invoices: [], bills: [], recurring: [], today: '2026-10-07', baseCurrency: 'USD',
      inventory: [{ id: item, name: 'Chair', quantityAtHand: 12 }], stockMoves: await history() });
    assert.deepEqual(found.map(f => [f.title, f.record]), [['Chair: 12 on hand, but its history ends at 9', { type: 'item', id: item }]]);
    await db.collection('inventory').doc(item).update({ quantityAtHand: 9 });
  });

  test('imported opening stock starts an item\'s history; undo removes it, but keeps an item already sold', async () => {
    const res = await call('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'items', openingDate: '2026-05-02', rows: [
      { name: 'Table', sku: 'T-1', unitCostCents: '20.00', quantityAtHand: '4' },
      { name: 'Lamp', sku: 'L-1', unitCostCents: '5.00', quantityAtHand: '6' },
    ] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const items = (await db.collection('inventory').where('workspaceId', '==', ws).where('importBatchId', '==', res.body.batchId).get()).docs;
    const table = items.find(d => d.data().name === 'Table')!.id;
    const lamp = items.find(d => d.data().name === 'Lamp')!.id;
    assert.deepEqual((await history(table)).map(m => [m.kind, m.quantity, m.quantityAfter, m.valueCents, m.documentType, m.documentId]), [['opening', 4, 4, 8000, 'import', res.body.batchId]]);
    // the lamp is adjusted (one broke): now it is in use
    assert.equal((await call('POST', '/api/v1/inventory/adjust', { workspaceId: ws, itemId: lamp, quantityChange: -1, type: 'adjustment', inventoryAccountId: `${ws}_inv`, offsetAccountId: `${ws}_shrink`, date: '2026-05-03' })).status, 200);
    const undo = await call('POST', `/api/v1/workspaces/${ws}/import-records/${res.body.batchId}/undo`, {});
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.equal((await db.collection('inventory').doc(table).get()).exists, false);
    assert.equal((await history(table)).length, 0, 'the removed item\'s history goes with it');
    assert.equal((await db.collection('inventory').doc(lamp).get()).exists, true, 'the adjusted lamp is kept');
    assert.deepEqual((await history(lamp)).map(m => m.kind), ['opening', 'adjustment']);
  });
});

describe('The Stock history window', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });
  const chair = { id: 'chair', name: 'Chair', quantityAtHand: 7 } as InventoryItem;
  const rows = (moves: Partial<StockMove>[]) => moves.map((m, i) => ({ id: `m${i}`, updated_at: '2026-05-01T00:00:00Z', data: move({ seq: String(i), itemId: 'chair', ...m }) }));
  const stub = (body: unknown) => { globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch; };

  test('lists each change, oldest first, with the entry it belongs to', async () => {
    setComponentWorkspace('viewer');
    stub(rows([
      { kind: 'sale', quantity: -3, quantityBefore: 10, quantityAfter: 7, valueCents: -1200, date: '2026-05-05', transactionId: 't2' },
      { kind: 'opening', quantity: 10, quantityBefore: 0, quantityAfter: 10, valueCents: 4000, date: '2026-05-01', transactionId: 't1' },
    ]).map((r, i) => ({ ...r, data: { ...r.data, seq: String(1 - i) } })));
    render(<StockHistoryDialog item={chair} workspaceId="component-workspace" currency="USD" onClose={() => {}} />);
    await waitFor(() => assert.ok(screen.getByText('Opening stock')));
    const cells = screen.getAllByRole('row').slice(1).map(r => r.textContent);
    assert.match(cells[0] || '', /Opening stock\+1010\$40\.00/);
    assert.match(cells[1] || '', /Sold-37-\$12\.00/);
    assert.equal(screen.getAllByRole('button', { name: /^Entry of/ }).length, 2);
    assert.equal(screen.queryByRole('alert'), null);
  });

  test('says when the history does not end at the quantity on hand', async () => {
    setComponentWorkspace('owner');
    stub(rows([{ kind: 'opening', quantity: 10, quantityBefore: 0, quantityAfter: 10, valueCents: 4000 }]));
    render(<StockHistoryDialog item={chair} workspaceId="component-workspace" currency="USD" onClose={() => {}} />);
    await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /Chair: 7 on hand, but its history ends at 10/));
  });
});
