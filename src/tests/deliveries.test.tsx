/**
 * Deliveries (BF-08 step 2): an owner can choose that stock leaves with deliveries instead of with
 * the invoice. Then a delivery from an order lowers stock and books the cost of the units that left,
 * once (a retry changes nothing), never more than is left to deliver; undoing it puts them back; an
 * invoice books no cost (an invoice that shipped its goods before the switch keeps doing so when it
 * is edited); and going back to "the invoice" waits until no order is part-way.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { DELIVERY_COGS_TYPE, DELIVERY_RETURN_TYPE, deliveredByLine, deliveredUnitCost, deliveryLines, deliveryProblem, goodsLeaveWith, newDeliveryId, newReturnId, orderDeliveries, returnProblem, DELIVERY_ID, RETURN_ID } from '../lib/deliveries';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeChartAccount, makeTransaction } from './fixtures';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import OrderDeliveryDialog from '../components/sales/OrderDeliveryDialog';
import StockPolicySwitch from '../components/inventory/StockPolicySwitch';
import type { Estimate, Transaction } from '../types';

const order = { id: 'o1', lines: [
  { description: 'Chair', itemId: 'chair', quantity: 5, unitPriceCents: 9000 },
  { description: 'Setup', quantity: 1, unitPriceCents: 5000 },
  { description: 'Table', itemId: 'table', quantity: 2.5, unitPriceCents: 20000 },
] } as unknown as Estimate;
const delivered = (id: string, line: number, quantity: number, over: Partial<Transaction> = {}) => makeTransaction({
  id, date: '2026-10-05', status: 'completed', metadata: { type: DELIVERY_COGS_TYPE, orderId: 'o1', orderLine: line, deliveryId: `dlv_${id.padEnd(8, '0')}`, inventoryItemId: 'chair', quantity }, ...over,
} as Partial<Transaction>);

describe('The rules', () => {
  test('the invoice ships the goods unless the workspace chose deliveries', () => {
    assert.equal(goodsLeaveWith(undefined), 'invoice');
    assert.equal(goodsLeaveWith({ goodsLeaveWith: 'delivery' }), 'delivery');
    assert.equal(goodsLeaveWith({ goodsLeaveWith: 'something' }), 'invoice');
    assert.match(newDeliveryId(), DELIVERY_ID);
  });

  test('delivered units come from the entries in force; undone ones are left out', () => {
    const entries = [delivered('a', 0, 2), delivered('b', 0, 1), delivered('c', 2, 1.5), delivered('d', 0, 1, { status: 'void' }),
      delivered('e', 0, 4), makeTransaction({ id: 'e_undo', status: 'completed', metadata: { isReversal: true, reversesTxId: 'e' } } as Partial<Transaction>)];
    assert.deepEqual([...deliveredByLine(entries, 'o1')], [[0, 3], [2, 1.5]]);
    assert.deepEqual(deliveredByLine(entries, 'other').size, 0);
    const lines = deliveryLines(order, deliveredByLine(entries, 'o1'));
    assert.deepEqual(lines.map(l => [l.position, l.ordered, l.delivered, l.left]), [[0, 5, 3, 2], [2, 2.5, 1.5, 1]], 'only item lines');
    assert.deepEqual(orderDeliveries(entries, 'o1').map(d => d.lines.length), [1, 1, 1]);
  });

  test('goods that came back count against what was delivered, at the cost the deliveries booked', () => {
    const entries = [delivered('a', 0, 4, { totalAmountCents: 1600 } as Partial<Transaction>), delivered('b', 0, 1, { totalAmountCents: 500 } as Partial<Transaction>),
      makeTransaction({ id: 'r1', status: 'completed', metadata: { type: DELIVERY_RETURN_TYPE, orderId: 'o1', orderLine: 0, inventoryItemId: 'chair', quantity: 2 } } as Partial<Transaction>)];
    assert.deepEqual([...deliveredByLine(entries, 'o1')], [[0, 3]]);
    assert.equal(deliveredUnitCost(entries, 'o1').get(0), 420, '(1600 + 500) / 5 units');
    const lines = deliveryLines(order, deliveredByLine(entries, 'o1'));
    assert.equal(returnProblem(lines, [{ position: 0, quantity: 3 }]), null);
    assert.match(String(returnProblem(lines, [{ position: 0, quantity: 4 }])), /only 3 were delivered/);
    assert.match(String(returnProblem(lines, [{ position: 1, quantity: 1 }])), /item lines/);
    assert.match(newReturnId(), RETURN_ID);
  });

  test('never more than is left, item lines only, two decimals at most', () => {
    const lines = deliveryLines(order, new Map([[0, 3]]));
    assert.equal(deliveryProblem(lines, [{ position: 0, quantity: 2 }, { position: 2, quantity: 2.5 }]), null);
    assert.match(String(deliveryProblem(lines, [{ position: 0, quantity: 3 }])), /only 2 left to deliver of 5/);
    assert.match(String(deliveryProblem(lines, [{ position: 1, quantity: 1 }])), /item lines/);
    assert.match(String(deliveryProblem(lines, [{ position: 2, quantity: 0.125 }])), /two decimals/);
    assert.match(String(deliveryProblem(lines, [{ position: 0, quantity: -1 }])), /above zero/);
    assert.match(String(deliveryProblem(lines, [{ position: 0, quantity: 0 }])), /how many/);
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_dlv_${crypto.randomBytes(4).toString('hex')}`;
  const chair = `${ws}_chair`;
  const orderId = `${ws}_order`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const call = async (path: string, method: string, uid: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const stock = async () => (await db.collection('inventory').doc(chair).get()).data()?.quantityAtHand;
  const accounts = { inventoryAccountId: `${ws}_inv`, cogsAccountId: `${ws}_cogs` };
  const deliver = (uid: string, deliveryId: string, quantity: number, date = '2026-10-05') =>
    call('/api/v1/inventory/deliveries', 'POST', uid, { workspaceId: ws, orderId, deliveryId, date, lines: [{ position: 0, quantity }], ...accounts });
  const policy = (uid: string, goodsLeaveWith: string) => call('/api/v1/inventory/stock-policy', 'PUT', uid, { workspaceId: ws, goodsLeaveWith });
  const invoiceCogs = (id: string, invoiceId: string, extra: Record<string, unknown> = {}) => ({
    id: `${ws}_${id}`, workspaceId: ws, date: '2026-10-05', description: 'Cost of chairs', status: 'completed', type: 'actual', currency: 'USD', totalAmountCents: 400,
    metadata: { type: 'invoice-cogs-auto', invoiceId, cogsForInvoiceId: invoiceId, cogsForLineId: 'l1', inventoryItemId: chair, quantity: 1, ...extra },
    lines: [{ accountId: `${ws}_cogs`, amountCents: 400 }, { accountId: `${ws}_inv`, amountCents: -400 }],
  });
  const post = (transactions: unknown[]) => call('/api/v1/transactions/bulk', 'POST', 'owner-1', { workspaceId: ws, transactions });
  const d1 = 'dlv_aaaaaaaa11';
  const d2 = 'dlv_bbbbbbbb22';

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Chairs', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    await db.collection('chartAccounts').doc(`${ws}_inv`).set({ workspaceId: ws, name: 'Inventory', type: 'asset', category: 'Inventory', code: '1200' });
    await db.collection('chartAccounts').doc(`${ws}_cogs`).set({ workspaceId: ws, name: 'COGS', type: 'expense', category: 'COGS', code: '5000' });
    await db.collection('inventory').doc(chair).set({ workspaceId: ws, name: 'Chair', sku: 'CH-1', unitCostCents: 400, unitPriceCents: 9000, quantityAtHand: 10 });
    await db.collection('estimates').doc(orderId).set({
      workspaceId: ws, number: 'EST-0007', customerId: 'c1', customerName: 'Acme', date: '2026-10-01', status: 'accepted', orderedAt: '2026-10-02T09:00:00Z', currency: 'USD',
      amountCents: 50000, lines: [{ description: 'Chair', itemId: chair, quantity: 5, unitPriceCents: 9000, amountCents: 45000 }, { description: 'Setup', quantity: 1, unitPriceCents: 5000, amountCents: 5000 }],
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: `${req.header('x-test-uid')}@example.test` }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/inventory', inventoryRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'inventory', 'estimates', 'invoices', 'stockMoves', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('while the invoice ships the goods, delivering is refused; an invoice books its cost', async () => {
    const refused = await deliver('owner-1', d1, 2);
    assert.equal(refused.status, 409, JSON.stringify(refused.body));
    assert.match(String(refused.body.error), /the invoice ships the goods/);
    assert.equal((await post([invoiceCogs('old', `${ws}_inv1`)])).status, 200, 'an invoice of the invoice era');
    assert.equal(await stock(), 9);
  });

  test('only an owner chooses deliveries', async () => {
    assert.equal((await policy('book-1', 'delivery')).status, 403);
    assert.equal((await policy('owner-1', 'sometimes')).status, 400);
    const on = await policy('owner-1', 'delivery');
    assert.equal(on.status, 200, JSON.stringify(on.body));
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.goodsLeaveWith, 'delivery');
  });

  test('a delivery lowers stock and books the cost once; a retry changes nothing', async () => {
    assert.equal((await deliver('view-1', d1, 2)).status, 403, 'viewers read only');
    const first = await deliver('book-1', d1, 2);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(await stock(), 7);
    const entry = (await db.collection('transactions').doc(`${d1}_0`).get()).data()!;
    assert.equal(entry.metadata.type, DELIVERY_COGS_TYPE);
    assert.equal(entry.metadata.orderId, orderId);
    assert.equal(entry.totalAmountCents, 800);
    assert.deepEqual(entry.lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]), [[`${ws}_cogs`, 800], [`${ws}_inv`, -800]]);
    const again = await deliver('book-1', d1, 2);
    assert.equal(again.status, 200);
    assert.equal(again.body.repeated, true);
    assert.equal(await stock(), 7, 'not twice');
    const moves = await db.pool.query(`select data from public."stockMoves" where workspace_id = $1 and data->>'documentType' = 'delivery'`, [ws]);
    assert.equal(moves.rows[0]?.data.documentId, d1, 'the stock history names the delivery');
  });

  test('never more than is left to deliver', async () => {
    const tooMany = await deliver('owner-1', d2, 4);
    assert.equal(tooMany.status, 400);
    assert.match(String(tooMany.body.error), /only 3 left to deliver of 5/);
    assert.equal(await stock(), 7);
    assert.equal((await deliver('owner-1', d2, 3)).status, 200);
    assert.equal(await stock(), 4);
  });

  test('a new invoice books no cost now; an invoice that shipped before keeps doing so when edited', async () => {
    const fresh = await post([invoiceCogs('new', `${ws}_inv2`)]);
    assert.equal(fresh.status, 409, JSON.stringify(fresh.body));
    assert.match(String(fresh.body.error), /stock leaves with deliveries/);
    const edit = await post([
      { ...invoiceCogs('old_rev', `${ws}_inv1`), description: 'Reversal', metadata: { invoiceId: `${ws}_inv1`, isReversal: true, reversesTxId: `${ws}_old` }, lines: [{ accountId: `${ws}_cogs`, amountCents: -400 }, { accountId: `${ws}_inv`, amountCents: 400 }] },
      invoiceCogs('old_v2', `${ws}_inv1`),
    ]);
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.equal(await stock(), 4, 'one back, one out');
    const direct = await post([{ ...invoiceCogs('fake', `${ws}_inv3`), metadata: { type: DELIVERY_COGS_TYPE, orderId, orderLine: 0, deliveryId: 'dlv_cccccccc33', inventoryItemId: chair, quantity: 1 } }]);
    assert.equal(direct.status, 400);
    assert.match(String(direct.body.error), /Deliver goods from the order/);
  });

  test('going back to the invoice waits for part-way orders; undoing a delivery puts the units back', async () => {
    const early = await policy('owner-1', 'invoice');
    assert.equal(early.status, 409, JSON.stringify(early.body));
    assert.match(String(early.body.error), /Order EST-0007 is part-way/);
    const undo = await call(`/api/v1/inventory/deliveries/${d2}/undo`, 'POST', 'owner-1', { workspaceId: ws, orderId, date: '2026-10-06' });
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.equal(await stock(), 7);
    assert.equal((await call(`/api/v1/inventory/deliveries/${d2}/undo`, 'POST', 'owner-1', { workspaceId: ws, orderId, date: '2026-10-06' })).status, 404, 'once');
    assert.equal((await deliver('owner-1', 'dlv_dddddddd44', 3)).status, 200, 'the units can be delivered again');
    assert.equal(await stock(), 4);
    await call(`/api/v1/inventory/deliveries/dlv_dddddddd44/undo`, 'POST', 'owner-1', { workspaceId: ws, orderId, date: '2026-10-06' });
    await call(`/api/v1/inventory/deliveries/${d1}/undo`, 'POST', 'owner-1', { workspaceId: ws, orderId, date: '2026-10-06' });
    assert.equal(await stock(), 9);
    const back = await policy('owner-1', 'invoice');
    assert.equal(back.status, 200, JSON.stringify(back.body));
  });

  test('goods that came back: stock in, cost taken back at the delivered cost, never more than delivered; then no whole undo', async () => {
    assert.equal((await policy('owner-1', 'delivery')).status, 200);
    assert.equal((await deliver('owner-1', 'dlv_ffffffff66', 3)).status, 200);
    const before = await stock();
    const ret = (returnId: string, quantity: number, uid = 'book-1') =>
      call('/api/v1/inventory/deliveries/returns', 'POST', uid, { workspaceId: ws, orderId, returnId, date: '2026-10-07', lines: [{ position: 0, quantity }], ...accounts });
    assert.equal((await ret('ret_aaaaaaaa11', 1, 'view-1')).status, 403);
    const first = await ret('ret_aaaaaaaa11', 1);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(await stock(), before + 1);
    const entry = (await db.collection('transactions').doc('ret_aaaaaaaa11_0').get()).data()!;
    assert.equal(entry.metadata.type, DELIVERY_RETURN_TYPE);
    assert.deepEqual(entry.lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]), [[`${ws}_inv`, 400], [`${ws}_cogs`, -400]]);
    assert.equal((await ret('ret_aaaaaaaa11', 1)).body.repeated, true);
    assert.equal(await stock(), before + 1, 'not twice');
    const tooMany = await ret('ret_bbbbbbbb22', 3);
    assert.equal(tooMany.status, 400);
    assert.match(String(tooMany.body.error), /only 2 were delivered/);
    const undo = await call(`/api/v1/inventory/deliveries/dlv_ffffffff66/undo`, 'POST', 'owner-1', { workspaceId: ws, orderId, date: '2026-10-07' });
    assert.equal(undo.status, 409);
    assert.match(String(undo.body.error), /already came back/);
    const direct = await post([{ ...invoiceCogs('fake2', `${ws}_inv9`), metadata: { type: DELIVERY_RETURN_TYPE, orderId, orderLine: 0, inventoryItemId: chair, quantity: 1 } }]);
    assert.equal(direct.status, 400, 'only the return route makes these entries');
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('an owner chooses that stock leaves with deliveries', async () => {
    setComponentWorkspace('owner');
    const calls = stubFetchWithBodies(200, { status: 'ok', goodsLeaveWith: 'delivery' });
    render(<StockPolicySwitch />);
    const invoice = screen.getByRole('radio', { name: /^The invoice/ }) as HTMLInputElement;
    assert.equal(invoice.checked, true, 'the default');
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /^A delivery from the order/ })); });
    await waitFor(() => assert.equal((screen.getByRole('radio', { name: /^A delivery from the order/ }) as HTMLInputElement).checked, true));
    const put = calls.find(c => c.url === '/api/v1/inventory/stock-policy')!;
    assert.deepEqual(put.body, { workspaceId: 'component-workspace', goodsLeaveWith: 'delivery' });
    assert.equal(useAuthStore.getState().getCurrentWorkspace()?.goodsLeaveWith, 'delivery');
  });

  test('others are told that stock leaves with deliveries', () => {
    setComponentWorkspace('bookkeeper');
    useAuthStore.setState(s => ({ workspaces: s.workspaces.map(w => ({ ...w, goodsLeaveWith: 'delivery' as const })) }));
    stubFetchWithBodies(200, {});
    render(<StockPolicySwitch />);
    assert.equal(screen.queryByRole('radio'), null);
    assert.match(document.body.textContent || '', /Stock leaves with deliveries: deliver from the order/);
  });

  test('the delivery dialog shows what is left, refuses too many, and sends the units and accounts', async () => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('transactions', 'accounts');
    useLedgerStore.setState({
      accounts: [makeChartAccount({ id: 'inv', name: 'Inventory', type: 'asset', category: 'Inventory' }), makeChartAccount({ id: 'cogs', name: 'Cost of Goods Sold', type: 'expense', category: 'COGS' })],
      transactions: [delivered('a', 0, 2)],
    });
    const calls = stubFetchWithBodies(200, { status: 'ok', warnings: [] });
    let closed = false;
    render(<OrderDeliveryDialog order={order} canWrite onClose={() => { closed = true; }} />);
    const chairs = screen.getByLabelText('Deliver now: Chair') as HTMLInputElement;
    assert.equal(chairs.value, '3', 'what is left');
    assert.ok(screen.getByText(/Chair × 2/), 'the earlier delivery is listed');
    fireEvent.change(chairs, { target: { value: '4' } });
    assert.match(screen.getByRole('status').textContent || '', /only 3 left to deliver of 5/);
    assert.equal((screen.getByRole('button', { name: 'Deliver' }) as HTMLButtonElement).disabled, true);
    fireEvent.change(chairs, { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Deliver now: Table'), { target: { value: '' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deliver' })); });
    await waitFor(() => assert.equal(closed, true));
    const post = calls.find(c => c.url === '/api/v1/inventory/deliveries')!;
    const body = post.body as Record<string, unknown>;
    assert.equal(body.orderId, 'o1');
    assert.match(String(body.deliveryId), DELIVERY_ID);
    assert.deepEqual(body.lines, [{ position: 0, quantity: 3 }]);
    assert.equal(body.inventoryAccountId, 'inv');
    assert.equal(body.cogsAccountId, 'cogs');
  });

  test('undoing a delivery asks the server, dated like the delivery while its month is open', async () => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('transactions', 'accounts');
    useLedgerStore.setState({ accounts: [], transactions: [delivered('a', 0, 2)] });
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<OrderDeliveryDialog order={order} canWrite onClose={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Undo/ })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.startsWith('/api/v1/inventory/deliveries/'))));
    const undo = calls.find(c => c.url.startsWith('/api/v1/inventory/deliveries/'))!;
    assert.equal(undo.url, '/api/v1/inventory/deliveries/dlv_a0000000/undo');
    assert.deepEqual(undo.body, { workspaceId: 'component-workspace', orderId: 'o1', date: '2026-10-05' });
  });

  test('what came back is sent with the accounts; never more than was delivered', async () => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('transactions', 'accounts');
    useLedgerStore.setState({
      accounts: [makeChartAccount({ id: 'inv', name: 'Inventory', type: 'asset', category: 'Inventory' }), makeChartAccount({ id: 'cogs', name: 'Cost of Goods Sold', type: 'expense', category: 'COGS' })],
      transactions: [delivered('a', 0, 2)],
    });
    const calls = stubFetchWithBodies(200, { status: 'ok' });
    render(<OrderDeliveryDialog order={order} canWrite onClose={() => {}} />);
    const box = screen.getByLabelText('Came back: Chair');
    fireEvent.change(box, { target: { value: '3' } });
    assert.match(screen.getByRole('status').textContent || '', /only 2 were delivered/);
    fireEvent.change(box, { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record what came back' })); });
    const sent = calls.find(c => c.url === '/api/v1/inventory/deliveries/returns')!;
    const body = sent.body as Record<string, unknown>;
    assert.match(String(body.returnId), RETURN_ID);
    assert.deepEqual(body.lines, [{ position: 0, quantity: 1 }]);
    assert.equal(body.inventoryAccountId, 'inv');
    assert.equal(body.cogsAccountId, 'cogs');
  });

  test('a viewer sees the deliveries but cannot deliver or undo', () => {
    setComponentWorkspace('viewer');
    markComponentCollectionsLoaded('transactions', 'accounts');
    useLedgerStore.setState({ transactions: [delivered('a', 0, 2)] });
    stubFetchWithBodies(200, {});
    render(<OrderDeliveryDialog order={order} canWrite={false} onClose={() => {}} />);
    assert.equal(screen.queryByRole('button', { name: 'Deliver' }), null);
    assert.equal(screen.queryByRole('button', { name: /^Undo/ }), null);
    assert.equal((screen.getByLabelText('Deliver now: Chair') as HTMLInputElement).disabled, true);
  });
});
