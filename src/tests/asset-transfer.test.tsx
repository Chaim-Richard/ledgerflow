/**
 * Moving a fixed asset (X-05): a move of place only is not posted; a move between accounts is one
 * balanced entry (cost to the new asset account, the depreciation posted so far to the new
 * accumulated depreciation account); bad accounts, nothing to change, a viewer and a closed period
 * are refused; undo takes the latest move back. The dialog says what will be posted first.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describeTransfer, transferLines } from '../lib/assetTransfer';
import FixedAssetsView from '../components/assets/FixedAssetsView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount } from './fixtures';
import type { Firestore } from '../server/db/pgFirestore';
import type { FixedAsset } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;
const acc = (id: string, name = id) => ({ id, name });

describe('The move entry', () => {
  test('cost to the new asset account, depreciation to the new accumulated account; place only posts nothing', () => {
    const lines = transferLines(1_200_000, 160_000, { asset: acc('vehicles'), accumulated: acc('accum-v') }, { asset: acc('equipment'), accumulated: acc('accum-e') });
    assert.deepEqual(lines.map(l => [l.accountId, l.amountCents]), [['equipment', 1_200_000], ['vehicles', -1_200_000], ['accum-v', 160_000], ['accum-e', -160_000]]);
    assert.deepEqual(transferLines(1_200_000, 160_000, { asset: acc('vehicles') }, { asset: acc('vehicles') }), []);
    assert.equal(describeTransfer('Van', { fromLocation: 'Depot', toLocation: 'Yard B', fromAsset: acc('v', 'Vehicles'), toAsset: acc('e', 'Equipment') }), 'Moved Van to Yard B, from Vehicles to Equipment');
    assert.equal(describeTransfer('Van', { fromLocation: 'Depot', toLocation: 'Depot' }), '');
  });
});

describe('Moving an asset (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_move_${crypto.randomBytes(4).toString('hex')}`;
  const id = (n: string) => `${ws}_${n}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const call = async (uid: string, method: string, body?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/assets/${id('van')}/transfer`, { method, headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as { message?: string; transactionId?: string | null; description?: string } };
  };
  const van = async () => (await db.collection('assets').doc(id('van')).get()).data()!;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Move Co', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    const account = (n: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(n)).set({ workspaceId: ws, uid: 'owner-1', balanceCents: 0, isActive: true, ...fields });
    await account('vehicles', { code: '1500', name: 'Vehicles', type: 'asset' });
    await account('equipment', { code: '1510', name: 'Equipment', type: 'asset' });
    await account('accum', { code: '1590', name: 'Accumulated Depreciation', type: 'asset' });
    await account('accum-e', { code: '1591', name: 'Accumulated Depreciation - Equipment', type: 'asset' });
    await account('rent', { code: '6100', name: 'Rent', type: 'expense' });
    await db.collection('assets').doc(id('van')).set({
      workspaceId: ws, uid: 'owner-1', name: 'Delivery van', purchaseDate: '2026-01-01', purchasePriceCents: 1_200_000, salvageValueCents: 0,
      usefulLifeYears: 5, depreciationMethod: 'straight-line', accumulatedDepreciationCents: 160_000, depreciatedThrough: '2026-09',
      status: 'active', createdAt: '2026-01-01T00:00:00Z', assetAccountId: id('vehicles'), location: 'Depot',
    });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'assets', 'chartAccounts', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('refused: a viewer, nothing to change, an account that is not an asset account, the same account twice', async () => {
    assert.equal((await call('view-1', 'POST', { date: '2026-10-05', location: 'Yard B' })).status, 403);
    assert.match(String((await call('book-1', 'POST', { date: '2026-10-05', location: 'Depot' })).body.message), /Nothing changes/);
    assert.match(String((await call('book-1', 'POST', { date: '2026-10-05', assetAccountId: id('rent') })).body.message), /asset accounts/);
    assert.match(String((await call('book-1', 'POST', { date: '2026-10-05', assetAccountId: id('accum') })).body.message), /different accounts/);
  });

  test('a move of place only is not posted', async () => {
    const res = await call('book-1', 'POST', { date: '2026-10-05', location: 'Yard B' });
    assert.equal(res.status, 200);
    assert.equal(res.body.transactionId, null);
    assert.equal((await van()).location, 'Yard B');
  });

  test('a move to Equipment posts cost and depreciation across in one balanced entry; undo takes it back, not in a closed period', async () => {
    const res = await call('book-1', 'POST', { date: '2026-10-06', assetAccountId: id('equipment'), accumulatedAccountId: id('accum-e') });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, 'Moved Delivery van from Vehicles to Equipment, depreciation to Accumulated Depreciation - Equipment');
    const entry = (await db.collection('transactions').doc(String(res.body.transactionId)).get()).data()!;
    const lines = Object.fromEntries((entry.lines as Array<{ accountId: string; amountCents: number }>).map(l => [l.accountId.replace(`${ws}_`, ''), l.amountCents]));
    assert.deepEqual(lines, { equipment: 1_200_000, vehicles: -1_200_000, accum: 160_000, 'accum-e': -160_000 });
    assert.deepEqual([(await van()).assetAccountId, (await van()).accumulatedAccountId], [id('equipment'), id('accum-e')]);

    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-10-31' });
    assert.equal((await call('book-1', 'DELETE')).status, 409);
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
    assert.equal((await call('book-1', 'DELETE')).status, 200);
    assert.equal((await db.collection('transactions').doc(String(res.body.transactionId)).get()).data()?.status, 'void');
    const v = await van();
    assert.deepEqual([v.assetAccountId, v.accumulatedAccountId ?? null, v.location, (v.transfers as unknown[]).length], [id('vehicles'), null, 'Yard B', 1]);
  });
});

describe('Move on the register', () => {
  afterEach(() => cleanup());

  test('the dialog says what will be posted, then asks the server', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} });
      return new Response(JSON.stringify({ status: 'success', transactionId: 'tx1', description: 'Moved' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    setComponentWorkspace('bookkeeper');
    const accounts = [
      makeChartAccount({ id: 'vehicles', code: '1500', name: 'Vehicles', type: 'asset', category: 'Fixed assets' }),
      makeChartAccount({ id: 'equipment', code: '1510', name: 'Equipment', type: 'asset', category: 'Fixed assets' }),
      makeChartAccount({ id: 'accum', code: '1590', name: 'Accumulated Depreciation', type: 'asset', category: 'Fixed assets' }),
    ];
    const asset = {
      id: 'van', uid: 'u', workspaceId: 'component-workspace', name: 'Delivery van', purchaseDate: '2026-01-01', purchasePriceCents: 1_200_000,
      salvageValueCents: 0, usefulLifeYears: 5, depreciationMethod: 'straight-line', accumulatedDepreciationCents: 160_000, status: 'active',
      createdAt: '2026-01-01', assetAccountId: 'vehicles', location: 'Depot',
    } as FixedAsset;
    useLedgerStore.setState({ assets: [asset], accounts } as never);
    markComponentCollectionsLoaded('assets');
    render(<FixedAssetsView />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Delivery van' }));
    const dialog = screen.getByRole('dialog', { name: 'Move Delivery van' });
    assert.equal(within(dialog).getByRole('status').textContent, 'Nothing changes yet.');
    fireEvent.change(within(dialog).getByLabelText('Asset account'), { target: { value: 'equipment' } });
    assert.equal(within(dialog).getByRole('status').textContent, 'Moved Delivery van from Vehicles to Equipment. Posted on that day: $12,000.00 into Equipment.');
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Move it' })); });
    await waitFor(() => assert.equal(calls.length, 1));
    assert.match(calls[0].url, /\/assets\/van\/transfer$/);
    assert.equal(calls[0].body.assetAccountId, 'equipment');
    assert.equal(calls[0].body.location, undefined, 'the place did not change');
  });
});
