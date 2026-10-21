/**
 * DIM-2 phase 3 (GitHub #132): where stock went, kept with the move. A sale keeps the customer, the invoice line it
 * was sold on and that line's labels (its project, property, …; the location is kept apart as before); a return keeps
 * the customer and the invoice line it came back against; a stock adjustment keeps why, as the person wrote it. The
 * Stock history shows them. The database part runs when LF_TEST_DATABASE_URL is set.
 *
 * Worked units: invoice INV-7 to Acme sells 5 chairs on line l1, labelled Project P1 and Location L1 → the sale's
 * move keeps Acme, line l1 and { project: P1 } (L1 stays its location). 2 come back on credit note CN-1 → the
 * return's move keeps Acme and line l1. 1 chair is written off with the reason "Damaged in transit" → that move keeps
 * the reason as its purpose. On hand: 10 − 5 + 2 − 1 = 6.
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { planReturnEntries } from '../lib/salesReturns';
import { planInvoiceCogs } from '../services/invoiceCogs';
import { orderedMoves, type StockMove } from '../lib/stockMoves';
import { stockTrail, type StockTrailDocs } from '../lib/stockTrail';
import { makeInvoice } from './fixtures';
import type { Invoice } from '../types';

const docs: StockTrailDocs = {
  bills: [], invoices: [], creditNotes: [], vendorCredits: [], orders: [], purchaseOrders: [], transactions: [], vendors: [],
  customers: [{ id: 'acme', name: 'Acme Ltd' }],
};
const move = (over: Partial<StockMove>): StockMove => ({
  workspaceId: 'w', itemId: 'chair', date: '2026-05-05', kind: 'sale', quantity: -5, quantityBefore: 10, quantityAfter: 5,
  unitCostCents: 400, valueCents: -2000, seq: '1', uid: 'u', createdAt: '', ...over,
});

test('the trail shows the labels and the purpose kept with the move, and the customer when the invoice is not found', () => {
  const [sold, written] = stockTrail([
    move({ documentType: 'invoice', documentId: 'gone', customerId: 'acme', documentLineId: 'l1', labels: { project: 'P1' } }),
    move({ kind: 'adjustment', quantity: -1, quantityBefore: 5, quantityAfter: 4, documentType: 'adjustment', purpose: 'Damaged in transit', seq: '2' }),
  ], docs).steps;
  assert.deepEqual([sold.origin, sold.party?.name, sold.labels], ['missing', 'Acme Ltd', { project: 'P1' }]);
  assert.deepEqual([written.origin, written.purpose], ['internal', 'Damaged in transit']);
});

describe('Where stock went, kept when it goes', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_dim2c_${crypto.randomBytes(4).toString('hex')}`;
  const item = `${ws}_chair`;
  const invId = `${ws}_inv`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const send = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': 'owner-1' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const moves = async () => orderedMoves((await db.collection('stockMoves').where('workspaceId', '==', ws).get()).docs.map(d => d.data() as StockMove));
  const invoice = (): Invoice => makeInvoice({
    id: invId, workspaceId: ws, customerId: 'acme', number: 'INV-7', status: 'sent', date: '2026-05-05', currency: 'USD',
    items: [{ id: 'l1', itemId: item, description: 'Chair', quantity: 5, rateCents: 9000, amountCents: 45000, accountId: 'sales', unitCostCents: 400, dimensions: { project: 'P1', location: 'L1' } }],
  });

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Chairs', currency: 'USD', members: ['owner-1'] });
    await db.collection('chartAccounts').doc(`${ws}_inv_acct`).set({ workspaceId: ws, name: 'Inventory', type: 'asset', category: 'Inventory', code: '1300' });
    await db.collection('chartAccounts').doc(`${ws}_cogs`).set({ workspaceId: ws, name: 'COGS', type: 'expense', category: 'COGS', code: '5000' });
    await db.collection('chartAccounts').doc(`${ws}_shrink`).set({ workspaceId: ws, name: 'Shrinkage', type: 'expense', code: '5100' });
    await db.collection('inventory').doc(item).set({ workspaceId: ws, name: 'Chair', sku: 'CH-1', unitCostCents: 400, unitPriceCents: 9000, quantityAtHand: 10 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
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

  test('the sale keeps Acme, line l1 and Project P1; Location L1 stays its location', async () => {
    const [sale] = planInvoiceCogs({
      invoiceId: invId, invoice: invoice(), date: '2026-05-05', uid: 'owner-1', workspaceId: ws, baseCurrency: 'USD',
      inventoryAccount: { id: `${ws}_inv_acct`, name: 'Inventory' }, cogsAccount: { id: `${ws}_cogs`, name: 'COGS' }, items: [{ id: item, name: 'Chair', unitCostCents: 400 }],
    }).entries.map(e => ({ ...e, id: `${ws}_sale` }));
    const res = await send('/api/v1/transactions/bulk', { workspaceId: ws, transactions: [sale] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [m] = await moves();
    assert.deepEqual([m.kind, m.quantity, m.customerId, m.documentLineId, m.labels, m.locationId], ['sale', -5, 'acme', 'l1', { project: 'P1' }, 'L1']);
  });

  test('2 come back on CN-1: the return keeps Acme and line l1', async () => {
    const [entry] = planReturnEntries({
      creditNote: { id: `${ws}_cn1`, number: 'CN-1', invoiceId: invId, date: '2026-05-10', customerId: 'acme', returnedGoods: [{ invoiceLineId: 'l1', itemId: item, quantity: 2 }] },
      lines: [{ invoiceLineId: 'l1', itemId: item, description: 'Chair', sold: 5, returned: 0, returnable: 5, unitCostCents: 400, unitPriceCents: 9000 }],
      uid: 'owner-1', workspaceId: ws, baseCurrency: 'USD', inventoryAccount: { id: `${ws}_inv_acct`, name: 'Inventory' }, cogsAccount: { id: `${ws}_cogs`, name: 'COGS' },
    });
    const res = await send('/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{ ...entry, id: `${ws}_ret` }] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const back = (await moves()).find(m => m.kind === 'return')!;
    assert.deepEqual([back.quantity, back.customerId, back.documentLineId], [2, 'acme', 'l1']);
  });

  test('1 written off "Damaged in transit" keeps the reason as its purpose; on hand 10 − 5 + 2 − 1 = 6', async () => {
    const res = await send('/api/v1/inventory/adjust', { workspaceId: ws, itemId: item, quantityChange: -1, type: 'adjustment', inventoryAccountId: `${ws}_inv_acct`, offsetAccountId: `${ws}_shrink`, reason: 'Damaged in transit', date: '2026-05-12' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const off = (await moves()).find(m => m.kind === 'adjustment')!;
    assert.deepEqual([off.quantity, off.purpose, off.quantityAfter], [-1, 'Damaged in transit', 6]);
  });
});
