/**
 * Stock per location (W-01): no second quantity field, only the stock history added up by location
 * (a Location label value). Sales and returns are where their invoice line says, adjustments and
 * counts where they are told, and "Move stock" moves units between locations without posting (the
 * total and the books don't change). A count at a location is compared with what is there. Stock from
 * before the history, or without a location, is "No location". The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import { commitAsServer } from './helpers/serverCommit';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NO_LOCATION, stockByLocation, transferProblem, type StockMove } from '../lib/stockMoves';
import { planInvoiceCogs } from '../services/invoiceCogs';
import { planReturnEntries, returnableLines } from '../lib/salesReturns';
import StockHistoryDialog from '../components/inventory/StockHistoryDialog';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeInvoice } from './fixtures';
import { getSupabase } from '../lib/db/client';
import type { InventoryItem, Invoice, Transaction } from '../types';

const move = (over: Partial<StockMove>): StockMove => ({
  workspaceId: 'w', itemId: 'i', date: '2026-05-01', kind: 'adjustment', quantity: 0, quantityBefore: 0, quantityAfter: 0, unitCostCents: 400, valueCents: 0, seq: '1', uid: 'u', createdAt: '', ...over,
});

describe('Where the units are', () => {
  test('the history added up by location; stock from before it is "no location"', () => {
    const at = stockByLocation([
      move({ seq: '1', kind: 'purchase', quantity: 6, quantityBefore: 4, quantityAfter: 10, locationId: 'TLV' }),
      move({ seq: '2', kind: 'transfer-out', quantity: -2, quantityBefore: 10, quantityAfter: 8, locationId: 'TLV' }),
      move({ seq: '3', kind: 'transfer-in', quantity: 2, quantityBefore: 8, quantityAfter: 10, locationId: 'HFA' }),
      move({ seq: '4', kind: 'sale', quantity: -1, quantityBefore: 10, quantityAfter: 9 }),
    ]);
    assert.deepEqual(Object.fromEntries(at), { [NO_LOCATION]: 3, TLV: 4, HFA: 2 });
    assert.equal(transferProblem({ quantity: 5, from: 'TLV', to: 'HFA' }, at), 'Only 4 at TLV');
    assert.equal(transferProblem({ quantity: 1, from: 'TLV', to: 'TLV' }, at), 'Choose two different locations');
    assert.equal(transferProblem({ quantity: 0, from: 'TLV', to: 'HFA' }, at), 'Enter how many to move (more than zero)');
    assert.equal(transferProblem({ quantity: 3, from: NO_LOCATION, to: 'HFA' }, at), null);
    assert.equal(transferProblem({ quantity: 4, from: NO_LOCATION, to: 'HFA' }, at), 'Only 3 without a location');
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_locs_${crypto.randomBytes(4).toString('hex')}`;
  const item = `${ws}_chair`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const call = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': 'owner-1' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const at = async () => Object.fromEntries(stockByLocation((await db.collection('stockMoves').where('workspaceId', '==', ws).where('itemId', '==', item).get()).docs.map(d => d.data() as StockMove)));
  const onHand = async () => (await db.collection('inventory').doc(item).get()).data()?.quantityAtHand;
  const accounts = { inventoryAccountId: `${ws}_inv`, offsetAccountId: `${ws}_obe` };
  const sold: Invoice = makeInvoice({ id: `${ws}_inv1`, items: [{ id: 'l1', itemId: item, description: 'Chair', quantity: 3, rateCents: 9000, amountCents: 27000, accountId: 'sales', unitCostCents: 400, dimensions: { location: 'TLV' } }] });
  const sale = () => ({ ...planInvoiceCogs({ invoiceId: sold.id, invoice: sold, date: '2026-05-05', uid: 'owner-1', workspaceId: ws, baseCurrency: 'USD',
    inventoryAccount: { id: `${ws}_inv`, name: 'Inventory' }, cogsAccount: { id: `${ws}_cogs`, name: 'COGS' }, items: [{ id: item, name: 'Chair', unitCostCents: 400 }] }).entries[0], id: `${ws}_sale` });

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Chairs', currency: 'USD', members: ['owner-1'] });
    await db.collection('chartAccounts').doc(`${ws}_inv`).set({ workspaceId: ws, name: 'Inventory', type: 'asset', category: 'Inventory', code: '1300' });
    await db.collection('chartAccounts').doc(`${ws}_cogs`).set({ workspaceId: ws, name: 'COGS', type: 'expense', category: 'COGS', code: '5000' });
    await db.collection('chartAccounts').doc(`${ws}_obe`).set({ workspaceId: ws, name: 'Opening Balance Equity', type: 'equity', category: 'Equity', code: '3200' });
    await db.collection('inventory').doc(item).set({ workspaceId: ws, name: 'Chair', sku: 'CH-1', unitCostCents: 400, unitPriceCents: 9000, quantityAtHand: 0 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    app.use('/api/v1/inventory', inventoryRouter);
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

  test('opening stock at TLV, a sale from TLV, a move to HFA, a count at HFA, a return to TLV', async () => {
    assert.equal((await call('/api/v1/inventory/adjust', { workspaceId: ws, itemId: item, quantityChange: 10, type: 'opening', ...accounts, date: '2026-05-01', locationId: 'TLV' })).status, 200);
    assert.deepEqual(await at(), { TLV: 10 });
    assert.equal((await commitAsServer(db, 'owner-1', { workspaceId: ws, transactions: [sale()] })).status, 200);
    assert.deepEqual(await at(), { TLV: 7 }, 'sold from where the invoice line says');

    const entriesBefore = (await db.collection('transactions').where('workspaceId', '==', ws).get()).size;
    const moved = await call('/api/v1/inventory/transfer', { workspaceId: ws, itemId: item, from: 'TLV', to: 'HFA', quantity: 4, date: '2026-05-06' });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.deepEqual(await at(), { TLV: 3, HFA: 4 });
    assert.equal(await onHand(), 7, 'the total doesn\'t change');
    assert.equal((await db.collection('transactions').where('workspaceId', '==', ws).get()).size, entriesBefore, 'nothing is posted');
    const tooMany = await call('/api/v1/inventory/transfer', { workspaceId: ws, itemId: item, from: 'TLV', to: 'HFA', quantity: 5, date: '2026-05-06' });
    assert.equal(tooMany.status, 400);
    assert.equal(tooMany.body.error, 'Only 3 at TLV');

    const count = await call('/api/v1/inventory/count', { workspaceId: ws, inventoryAccountId: `${ws}_inv`, offsetAccountId: `${ws}_cogs`, date: '2026-05-07', locationId: 'HFA', counts: [{ itemId: item, counted: 3 }] });
    assert.equal(count.status, 200, JSON.stringify(count.body));
    assert.deepEqual(await at(), { TLV: 3, HFA: 3 }, 'counted at HFA against what HFA had');
    assert.equal(await onHand(), 6);

    const lines = returnableLines({ ...sold, workspaceId: ws } as Invoice, [{ ...sale(), status: 'completed' } as unknown as Transaction]);
    const [back] = planReturnEntries({ creditNote: { id: `${ws}_cn`, invoiceId: sold.id, date: '2026-05-08', returnedGoods: [{ invoiceLineId: 'l1', itemId: item, quantity: 1 }] },
      lines, uid: 'owner-1', workspaceId: ws, baseCurrency: 'USD', inventoryAccount: { id: `${ws}_inv`, name: 'Inventory' }, cogsAccount: { id: `${ws}_cogs`, name: 'COGS' } });
    assert.equal((await commitAsServer(db, 'owner-1', { workspaceId: ws, transactions: [{ ...back, id: `${ws}_back` }] })).status, 200);
    assert.deepEqual(await at(), { TLV: 4, HFA: 3 }, 'the return comes back to where it left from');
    assert.equal(await onHand(), 7);
  });
});

describe('In the Stock history window', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });
  const chair = { id: 'chair', name: 'Chair', quantityAtHand: 7 } as InventoryItem;

  test('where the units are, and "Move stock" asks the server to move them', async () => {
    setComponentWorkspace('bookkeeper');
    const calls: Array<{ url: string; body: unknown }> = [];
    const rows = [
      move({ seq: '1', kind: 'opening', quantity: 10, quantityBefore: 0, quantityAfter: 10, locationId: 'TLV', itemId: 'chair' }),
      move({ seq: '2', kind: 'transfer-out', quantity: -3, quantityBefore: 10, quantityAfter: 7, locationId: 'TLV', itemId: 'chair' }),
      move({ seq: '3', kind: 'transfer-in', quantity: 3, quantityBefore: 7, quantityAfter: 10, locationId: 'HFA', itemId: 'chair' }),
      move({ seq: '4', kind: 'sale', quantity: -3, quantityBefore: 10, quantityAfter: 7, locationId: 'TLV', itemId: 'chair' }),
    ].map((m, i) => ({ id: `m${i}`, updated_at: '2026-05-01T00:00:00Z', data: m }));
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const body = url.includes('/rest/v1/stockMoves') ? rows : { status: 'ok' };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<StockHistoryDialog item={chair} workspaceId="component-workspace" currency="USD" onClose={() => {}} />);
    await waitFor(() => assert.ok(screen.getByRole('list', { name: 'By location' })));
    assert.match(screen.getByRole('list', { name: 'By location' }).textContent || '', /TLV: 4.*HFA: 3/);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'TLV' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'HFA' } });
    fireEvent.change(screen.getByLabelText('How many'), { target: { value: '5' } });
    assert.equal(screen.getByRole('status').textContent, 'Only 4 at TLV');
    fireEvent.change(screen.getByLabelText('How many'), { target: { value: '2' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Move' })); });
    const post = calls.find(c => c.url === '/api/v1/inventory/transfer')!;
    assert.deepEqual({ ...(post.body as Record<string, unknown>), date: 'x' }, { workspaceId: 'component-workspace', itemId: 'chair', from: 'TLV', to: 'HFA', quantity: 2, date: 'x' });
  });
});
