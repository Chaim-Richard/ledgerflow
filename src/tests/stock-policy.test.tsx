/**
 * Selling below zero (W-06). By default an invoice selling more than is on hand is recorded with a
 * warning and stock goes below zero. An owner can turn on "Refuse sales beyond stock": then such a
 * sale is refused and nothing of it is written, while sales within stock and putting stock back
 * (a reversal) still work. Only owners change it, through the server, with an audit line.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StockPolicySwitch from '../components/inventory/StockPolicySwitch';
import { planInvoiceCogs } from '../services/invoiceCogs';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { makeInvoice } from './fixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Against the database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const ws = `ws_stockpol_${suffix}`;
  const item = `${ws}_chair`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;

  const call = async (path: string, method: string, uid: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const stock = async () => (await db.collection('inventory').doc(item).get()).data()?.quantityAtHand;
  const sale = (id: string, quantity: number) => {
    const invoice = makeInvoice({ id: `${ws}_inv_${id}`, items: [{ id: 'l1', itemId: item, description: 'Chair', quantity, rateCents: 9000, amountCents: 9000 * quantity, accountId: 'sales', unitCostCents: 400 }] });
    const [entry] = planInvoiceCogs({ invoiceId: invoice.id, invoice, date: '2026-10-05', uid: 'owner-1', workspaceId: ws, baseCurrency: 'USD',
      inventoryAccount: { id: `${ws}_inv`, name: 'Inventory' }, cogsAccount: { id: `${ws}_cogs`, name: 'COGS' }, items: [{ id: item, name: 'Chair', unitCostCents: 400 }] }).entries;
    return { ...entry, id: `${ws}_${id}` };
  };
  const reversalOf = (id: string, target: ReturnType<typeof sale>) => ({
    ...target, id: `${ws}_${id}`, description: 'Reversal', metadata: { invoiceId: target.metadata.invoiceId, isReversal: true, reversesTxId: target.id },
    lines: target.lines.map(l => ({ ...l, amountCents: -l.amountCents, debitCents: l.creditCents, creditCents: l.debitCents })),
  });
  const policy = (uid: string, body: unknown) => call('/api/v1/inventory/stock-policy', 'PUT', uid, body);
  const post = (uid: string, transactions: unknown[]) => call('/api/v1/transactions/bulk', 'POST', uid, { workspaceId: ws, transactions });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Chairs', members: ['owner-1', 'acct-1'], roles: { 'acct-1': 'accountant' } });
    await db.collection('chartAccounts').doc(`${ws}_inv`).set({ workspaceId: ws, name: 'Inventory', type: 'asset', category: 'Inventory', code: '1200' });
    await db.collection('chartAccounts').doc(`${ws}_cogs`).set({ workspaceId: ws, name: 'COGS', type: 'expense', category: 'COGS', code: '5000' });
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
    for (const table of ['transactions', 'inventory', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('only an owner changes the setting; a wrong body is refused', async () => {
    assert.equal((await policy('acct-1', { workspaceId: ws, refuseNegativeStock: true })).status, 403);
    assert.equal((await policy('owner-1', { workspaceId: ws, refuseNegativeStock: 'yes' })).status, 400);
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.refuseNegativeStock, undefined);
    const on = await policy('owner-1', { workspaceId: ws, refuseNegativeStock: true });
    assert.equal(on.status, 200, JSON.stringify(on.body));
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.refuseNegativeStock, true);
    const audit = await db.pool.query(`select data from public."auditLogs" where workspace_id = $1 and data->>'action' = 'STOCK_POLICY_SET'`, [ws]);
    assert.equal(audit.rows.length, 1);
  });

  test('turned on: a sale beyond stock is refused and nothing is written; within stock it is recorded', async () => {
    const tooMany = await post('owner-1', [sale('s1', 12)]);
    assert.equal(tooMany.status, 409, JSON.stringify(tooMany.body));
    assert.match(String(tooMany.body.error || tooMany.body.message), /Only 10 of Chair in stock, and this needs 12/);
    assert.equal(await stock(), 10);
    assert.equal((await db.collection('transactions').doc(`${ws}_s1`).get()).exists, false);
    const four = sale('s2', 4);
    assert.equal((await post('owner-1', [four])).status, 200);
    assert.equal(await stock(), 6);
    // putting stock back is never refused
    assert.equal((await post('owner-1', [reversalOf('r2', four)])).status, 200);
    assert.equal(await stock(), 10);
  });

  test('turned off again: the same sale is recorded with a warning and stock goes below zero', async () => {
    assert.equal((await policy('owner-1', { workspaceId: ws, refuseNegativeStock: false })).status, 200);
    const res = await post('owner-1', [sale('s3', 12)]);
    assert.equal(res.status, 200);
    assert.match(String((res.body.warnings as string[])[0]), /Chair is now -2/);
    assert.equal(await stock(), -2);
  });
});

describe('On Inventory', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });
  const withPolicy = (refuse: boolean) => useAuthStore.setState(s => ({ workspaces: s.workspaces.map(w => ({ ...w, refuseNegativeStock: refuse })) }));

  test('an owner turns it on: the server is asked, and the switch shows it', async () => {
    setComponentWorkspace('owner');
    withPolicy(false);
    const calls = stubFetchWithBodies(200, { status: 'ok', refuseNegativeStock: true });
    render(<StockPolicySwitch />);
    const box = screen.getByRole('checkbox', { name: /Refuse sales beyond stock/ }) as HTMLInputElement;
    assert.equal(box.checked, false);
    await act(async () => { fireEvent.click(box); });
    await waitFor(() => assert.equal((screen.getByRole('checkbox', { name: /Refuse sales beyond stock/ }) as HTMLInputElement).checked, true));
    const put = calls.find(c => c.url === '/api/v1/inventory/stock-policy')!;
    assert.equal(put.method, 'PUT');
    assert.deepEqual(put.body, { workspaceId: 'component-workspace', refuseNegativeStock: true });
  });

  test('others have no switch; they are told when sales beyond stock are refused', () => {
    setComponentWorkspace('bookkeeper');
    withPolicy(false);
    stubFetchWithBodies(200, {});
    const view = render(<StockPolicySwitch />);
    assert.equal(screen.queryByRole('checkbox'), null);
    assert.equal(document.body.textContent, '');
    view.unmount();
    withPolicy(true);
    render(<StockPolicySwitch />);
    assert.match(document.body.textContent || '', /Sales beyond stock are refused/);
  });
});
