/**
 * Price lists (M-11): the rules for a list; an item's price on it (its own, else less the discount,
 * whole cents); owners and accountants keep the lists through the server; on an invoice or estimate
 * for a customer on a list, picking an item fills the list's price; Settings → Price lists.
 */
import './helpers/dom';
import test, { after, afterEach, before, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { customerPricer, listForCustomer, listPrice, priceListsProblem, type PriceList } from '../lib/priceLists';
import { setLineDescription, type InvoiceLineDraft } from '../lib/invoiceLines';
import InvoiceModal from '../components/sales/InvoiceModal';
import { EstimateLinesEditor } from '../components/sales/EstimateLinesEditor';
import PriceListsSettings from '../components/platform/settings/PriceListsSettings';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { stubFetch, stubFetchWithBodies } from './helpers/dom';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount, makeCustomer } from './fixtures';
import type { Invoice, InventoryItem, Workspace } from '../types';

const chair = { id: 'chair', name: 'Chair', sku: 'CH', unitPriceCents: 5000, unitCostCents: 2000, quantityAtHand: 10 } as InventoryItem;
const desk = { id: 'desk', name: 'Desk', sku: 'DK', unitPriceCents: 19999, unitCostCents: 9000, quantityAtHand: 3 } as InventoryItem;
const wholesale: PriceList = { id: 'pl_aaaaaaaa', name: 'Wholesale', discountPercent: 10, prices: { chair: 4500 }, customerIds: ['c1'] };

describe('The lists', () => {
  test('an item\'s price: its own on the list, else less the discount in whole cents; a customer on no list keeps the item\'s', () => {
    assert.equal(listPrice(wholesale, chair), 4500);
    assert.equal(listPrice(wholesale, desk), 17999, '199.99 less 10% = 179.991');
    assert.equal(listForCustomer([wholesale], 'c1')?.name, 'Wholesale');
    assert.equal(customerPricer([wholesale], 'c2'), undefined);
    const line: InvoiceLineDraft = { id: 'l', description: '', quantity: 2, rateCents: 0, amountCents: 0, accountId: '' };
    const picked = setLineDescription(line, 'Desk', [chair, desk], customerPricer([wholesale], 'c1'));
    assert.deepEqual([picked.itemId, picked.rateCents, picked.amountCents], ['desk', 17999, 35998]);
    assert.equal(setLineDescription(line, 'Desk', [chair, desk]).rateCents, 19999, 'no list: the item\'s own price');
  });

  test('what a list needs', () => {
    assert.equal(priceListsProblem([wholesale]), null);
    assert.match(String(priceListsProblem([{ name: 'X' }])), /2 to 80/);
    assert.match(String(priceListsProblem([{ name: 'Empty' }])), /a discount or at least one/);
    assert.match(String(priceListsProblem([{ name: 'Free', discountPercent: 100 }])), /below 100/);
    assert.match(String(priceListsProblem([{ name: 'Odd', discountPercent: 2.555 }])), /two decimals/);
    assert.match(String(priceListsProblem([{ name: 'Bad', prices: { chair: 12.5 } }])), /0 or more/);
    assert.match(String(priceListsProblem([{ name: 'Bad', prices: { chair: null } }])), /0 or more/);
    assert.match(String(priceListsProblem([wholesale, { ...wholesale, id: undefined, name: 'Retail' }])), /on both "Wholesale" and "Retail"/);
    assert.match(String(priceListsProblem([wholesale, { ...wholesale, id: undefined, customerIds: [] }])), /twice/);
    assert.match(String(priceListsProblem([{ ...wholesale, id: 'nope' }])), /id is not/);
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_prices_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const put = async (uid: string, lists: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/price-lists`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ lists }) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Prices', members: ['owner-1', 'acct-1', 'book-1'], roles: { 'acct-1': 'accountant', 'book-1': 'bookkeeper' } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'x@example.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('owners and accountants keep the lists; new ones get ids, known ids stay; a bookkeeper and a bad list are refused', async () => {
    const { id: _id, ...fresh } = wholesale;
    assert.equal((await put('book-1', [fresh])).status, 403);
    assert.equal((await put('owner-1', [{ ...fresh, discountPercent: 150 }])).status, 400);
    const saved = await put('owner-1', [fresh]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const id = (saved.body.lists as PriceList[])[0].id;
    assert.match(id, /^pl_[0-9a-f]{12}$/);
    assert.equal((await put('acct-1', [{ ...fresh, id, name: 'Trade' }])).status, 200);
    const lists = (await db.collection('workspaces').doc(ws).get()).data()?.priceLists as PriceList[];
    assert.deepEqual(lists, [{ id, name: 'Trade', discountPercent: 10, prices: { chair: 4500 }, customerIds: ['c1'] }]);
    const audit = await db.pool.query(`select count(*)::int as n from public."auditLogs" where workspace_id = $1 and data->>'action' = 'PRICE_LISTS_SET'`, [ws]);
    assert.equal(audit.rows[0].n, 2);
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  describe('lines for a customer on a list', () => {
    beforeEach(() => {
      stubFetch(404);
      useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD', priceLists: [wholesale] } as Workspace] });
      useLedgerStore.setState({ inventory: [chair, desk], taxRates: [] });
    });

    test('an invoice: picking an item fills the customer\'s list price', async () => {
      const saved: Partial<Invoice>[] = [];
      render(<InvoiceModal isOpen onClose={() => {}} onSave={inv => { saved.push(inv); }} customers={[makeCustomer({ id: 'c1', name: 'Acme Ltd' }), makeCustomer({ id: 'c2', name: 'Walk-in' })]} accounts={[makeChartAccount({ id: 'rev', name: 'Sales', type: 'income' })]} />);
      fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Acme Ltd' } });
      fireEvent.change(screen.getByLabelText('Item / Description'), { target: { value: 'Chair' } });
      assert.equal((screen.getByLabelText(/^Rate/) as HTMLInputElement).value, '45');
      fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Walk-in' } });
      fireEvent.click(screen.getByText('Add Item'));
      fireEvent.change(screen.getAllByLabelText('Item / Description')[1], { target: { value: 'Chair' } });
      assert.equal((screen.getAllByLabelText(/^Rate/)[1] as HTMLInputElement).value, '50', 'not on a list: the item\'s price');
    });

    test('an estimate: the same', () => {
      let lines: Array<Record<string, unknown>> = [{ id: 'e1', description: '', quantity: 1, rateCents: 0, amountCents: 0, accountId: '', priceText: '' }];
      render(<EstimateLinesEditor lines={lines as never} onChange={next => { lines = next as never; }} currency="USD" customerId="c1" />);
      fireEvent.change(screen.getByLabelText('Item or description, line 1'), { target: { value: 'Desk' } });
      assert.deepEqual([lines[0].itemId, lines[0].rateCents, lines[0].priceText], ['desk', 17999, '179.99']);
    });
  });

  test('Settings → Price lists: an owner makes a list for a customer; the problem is said until it has a discount or a price', async () => {
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [{ ...ws, currency: 'USD', priceLists: [] }] });
    useLedgerStore.setState({ inventory: [chair, desk], customers: [makeCustomer({ id: 'c1', name: 'Acme Ltd' }), makeCustomer({ id: 'c2', name: 'Bolt Inc' })] });
    const calls = stubFetchWithBodies(200, { status: 'success', lists: [{ ...wholesale, prices: { chair: 4500 } }] });
    render(<PriceListsSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'New price list' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wholesale' } });
    assert.match(screen.getByRole('status').textContent || '', /a discount or at least one/);
    fireEvent.change(screen.getByLabelText('Discount on every item, %'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: "Add an item's price" }));
    fireEvent.change(screen.getByLabelText('Item 1'), { target: { value: 'chair' } });
    fireEvent.change(screen.getByLabelText('Item 1 price'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Ltd' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save price list' })); });
    const sent = calls.find(c => c.url === `/api/v1/workspaces/${ws.id}/price-lists`)!;
    assert.deepEqual(sent.body, { lists: [{ name: 'Wholesale', discountPercent: 10, prices: { chair: 4500 }, customerIds: ['c1'] }] });
    await waitFor(() => assert.ok(screen.getByText(/10% off every item · Chair \$45\.00 · for Acme Ltd/)));
  });
});
