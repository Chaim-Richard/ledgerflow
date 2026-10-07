/**
 * The group summary (Z-20): one of a person's groups of books for a period, each member's profit and
 * loss and balance sheet side by side, read under the person's own access, and the total only when
 * all members use one currency. Members the person can no longer open are left out and counted;
 * someone else's group, a reversed period and an API key are refused. Each figure opens the member's
 * own report. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GroupSummaryReportView from '../components/reporting/GroupSummaryReportView';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { getSupabase } from '../lib/db/client';

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const tag = crypto.randomBytes(4).toString('hex');
  const ann = `ann_gs_${tag}`;
  const bob = `bob_gs_${tag}`;
  const [ws1, ws2, ws3] = ['one', 'two', 'eur'].map(n => `ws_gs_${n}_${tag}`);
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  let sameCurrency = '';
  let mixed = '';
  const call = async (path: string, uid: string, init: { method?: string; body?: unknown; apiKey?: string } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method: init.method || 'GET',
      headers: { 'content-type': 'application/json', 'x-test-uid': uid, ...(init.apiKey ? { 'x-test-key': init.apiKey } : {}) },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const summary = (groupId: string, uid = ann, apiKey?: string) => call(`/api/v1/reports/group-summary?groupId=${groupId}&startDate=2026-01-01&endDate=2026-12-31`, uid, { apiKey });

  /** A company with a sale (income) and a cost, both paid in cash, and the owner's opening capital. */
  const company = async (ws: string, name: string, currency: string, owner: string, members: string[], saleCents: number, costCents: number) => {
    await db.collection('workspaces').doc(ws).set({ uid: owner, name, currency, members });
    const acc = (id: string, type: string, accName: string, extra: Record<string, unknown> = {}) =>
      db.collection('chartAccounts').doc(`${ws}_${id}`).set({ workspaceId: ws, name: accName, type, code: id, ...extra });
    await acc('cash', 'asset', 'Cash', { category: 'Cash' });
    await acc('sales', 'income', 'Sales');
    await acc('rent', 'expense', 'Rent');
    await acc('capital', 'equity', 'Capital');
    const entry = (id: string, date: string, debit: string, credit: string, cents: number) => db.collection('transactions').doc(`${ws}_${id}`).set({
      workspaceId: ws, date, description: id, status: 'completed', type: 'actual', currency, totalAmountCents: cents,
      lines: [{ accountId: `${ws}_${debit}`, amountCents: cents }, { accountId: `${ws}_${credit}`, amountCents: -cents }],
    });
    await entry('capital', '2025-12-01', 'cash', 'capital', 100000);
    await entry('sale', '2026-03-01', 'cash', 'sales', saleCents);
    await entry('rent', '2026-03-02', 'rent', 'cash', costCents);
    await entry('next-year', '2027-01-05', 'cash', 'sales', 99999);
  };

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { accountRouter } = await import('../server/routes/accountRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await company(ws1, 'Holding', 'USD', ann, [ann], 50000, 20000);
    await company(ws2, 'Daughter', 'USD', bob, [bob, ann], 30000, 5000);
    await company(ws3, 'Euro Co', 'EUR', ann, [ann], 10000, 1000);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { user: Record<string, unknown> }).user = { uid: String(req.header('x-test-uid')), ...(req.header('x-test-key') ? { developerWorkspaceId: req.header('x-test-key') } : {}) };
      next();
    });
    app.use('/api/v1/reports', reportRouter);
    app.use('/api/v1/account', accountRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    sameCurrency = String(((await call('/api/v1/account/groups', ann, { method: 'POST', body: { name: 'Family', workspaceIds: [ws1, ws2] } })).body.group as { id: string }).id);
    mixed = String(((await call('/api/v1/account/groups', ann, { method: 'POST', body: { name: 'Abroad', workspaceIds: [ws1, ws3] } })).body.group as { id: string }).id);
  });

  after(async () => {
    server?.close();
    await db.pool.query(`delete from public."workspaceGroups" where data->>'ownerUid' in ($1, $2)`, [ann, bob]);
    for (const ws of [ws1, ws2, ws3]) {
      for (const table of ['transactions', 'chartAccounts']) await db.pool.query(`delete from public."${table}" where workspace_id = $1`, [ws]);
      await db.pool.query('delete from public.workspaces where id = $1', [ws]);
    }
    await db.terminate();
  });

  test('each member side by side, from its own books, and the total when they share a currency', async () => {
    const res = await summary(sameCurrency);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const members = res.body.members as Array<Record<string, unknown>>;
    assert.deepEqual(members.map(m => [m.name, m.income, m.expense, m.netIncome, m.totalAssets, m.totalEquity, m.isBalanced]), [
      ['Holding', 50000, 20000, 30000, 130000, 130000, true],
      ['Daughter', 30000, 5000, 25000, 125000, 125000, true],
    ], 'next year is left out of the profit; the balance sheet balances');
    assert.deepEqual(res.body.total, { currency: 'USD', income: 80000, cogs: 0, grossProfit: 80000, expense: 25000, netIncome: 55000, totalAssets: 255000, totalLiabilities: 0, totalEquity: 255000 });
    assert.equal(res.body.notIncluded, 0);
  });

  test('different currencies: side by side, no total', async () => {
    const res = await summary(mixed);
    assert.equal(res.status, 200);
    assert.deepEqual((res.body.members as Array<{ currency: string }>).map(m => m.currency), ['USD', 'EUR']);
    assert.equal(res.body.total, null);
  });

  test('a member no longer open is left out and counted; other people, reversed periods and API keys are refused', async () => {
    await db.collection('workspaces').doc(ws2).update({ members: [bob] });
    const res = await summary(sameCurrency);
    assert.deepEqual((res.body.members as Array<{ name: string }>).map(m => m.name), ['Holding']);
    assert.equal(res.body.notIncluded, 1);
    assert.equal((res.body.total as { netIncome: number }).netIncome, 30000);
    assert.equal((await summary(sameCurrency, bob)).status, 404);
    assert.equal((await call(`/api/v1/reports/group-summary?groupId=${sameCurrency}&startDate=2026-12-31&endDate=2026-01-01`, ann)).status, 400);
    assert.equal((await call(`/api/v1/reports/group-summary?groupId=${sameCurrency}`, ann)).status, 400);
    assert.equal((await summary(sameCurrency, ann, ws1)).status, 403);
  });
});

describe('On screen', () => {
  const groups = [{ id: 'grp_aaaaaaaa', name: 'Family', workspaceIds: ['ws-a', 'ws-b'] }];
  const figures = (income: number) => ({ income, cogs: 0, grossProfit: income, expense: 100, netIncome: income - 100, totalAssets: 5000, totalLiabilities: 0, totalEquity: 5000 });
  const answer = (members: Array<Record<string, unknown>>, total: Record<string, unknown> | null) => {
    const asked: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      const body = url.startsWith('/api/v1/account/groups') ? { status: 'success', groups } : { group: groups[0], members, total, notIncluded: 0 };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    return asked;
  };
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the first group is shown for this year; a figure opens that company\'s own report', async () => {
    setComponentWorkspace('owner');
    const asked = answer([
      { workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, ...figures(1000) },
      { workspaceId: 'ws-b', name: 'Daughter', currency: 'USD', isBalanced: true, ...figures(2000) },
    ], { currency: 'USD', ...figures(3000) });
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByRole('columnheader', { name: 'Group total' })));
    const year = new Date().getFullYear();
    assert.ok(asked.some(u => u.startsWith(`/api/v1/reports/group-summary?groupId=grp_aaaaaaaa&startDate=${year}-01-01`)));
    assert.ok(screen.getByRole('columnheader', { name: 'Daughter' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Net income of Daughter/ })); });
    assert.equal(useAuthStore.getState().currentWorkspaceId, 'ws-b');
    assert.equal(useUIStore.getState().activeReportTab, 'pnl');
  });

  test('different currencies: no total, and why', async () => {
    setComponentWorkspace('owner');
    answer([
      { workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, ...figures(1000) },
      { workspaceId: 'ws-b', name: 'Euro Co', currency: 'EUR', isBalanced: false, ...figures(2000) },
    ], null);
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByText(/No group total: these books are in USD, EUR/)));
    assert.equal(screen.queryByRole('columnheader', { name: 'Group total' }), null);
    assert.match(screen.getByRole('alert').textContent || '', /balance sheet of Euro Co does not balance/);
  });
});
