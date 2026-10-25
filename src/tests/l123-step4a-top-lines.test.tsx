/**
 * L-123 step 4a: a screen that lists single transaction lines ("Top Financial Line Items",
 * TopExpensesIncomeReportView) reads the whole list from the server (GET /api/v1/balances/top-lines,
 * src/lib/serverTopLines.ts, src/hooks/useServerTopLines.ts) when the loaded list is capped and the range reaches the
 * oldest loaded day: a list of the largest lines cannot be made from per-account sums.
 *
 * Hand-worked case (cents), year Y = this year. Accounts: Cash (asset), Sales (income), Rent and Fuel (expenses).
 *   E1 Y-01-05  Rent +900 / Cash −900
 *   E2 Y-01-12  Cash +1,500 / Sales −1,500
 *   E3 Y-02-03  Fuel +300 / Cash −300
 *   E4 Y-02-10  Rent +700 / Cash −700
 *   E5 Y-03-01  Cash +800 / Sales −800
 *   E6 Y-03-15  Fuel +200 / Cash −200
 *   E7 Y-04-02  Cash +300 / Fuel −300, a reversal of E3 (metadata.isReversal, reversesTxId E3)
 * Loaded (the newest four, capped): E4…E7; oldest loaded day Y-02-10.
 * Every entry, year Y (E3 and E7 cancel, so both are left out of the list):
 *   expenses  E1 Rent 900 · E4 Rent 700 · E6 Fuel 200
 *   income    E2 Sales 1,500 · E5 Sales 800
 * The loaded four alone: expenses E4 700 · E6 200; income E5 800 (E1 and E2 are missing).
 * Range Y-01-01…Y-03-31 on the server: the same three expenses — E7 is dated after the range but is still read, so
 *   E3 (300, inside the range) stays out. With limit 2: E1 900 · E4 700.
 */
import { stubFetch } from './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { setComponentWorkspace } from './helpers/componentFixtures';
import TopExpensesIncomeReportView from '../components/reporting/TopExpensesIncomeReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { formatCurrency, workspaceYearMonth } from '../lib/utils';
import { computeTopExpensesAndIncome, type TopLineItem } from '../lib/reportGenerators';
import { openingCutoff } from '../lib/serverBalances';
import { linesNeedServer, rangeRevision } from '../lib/serverTopLines';
import type { ChartAccount, Transaction } from '../types';
import type { Firestore } from '../server/db/pgFirestore';

const Y = workspaceYearMonth().year;
const from = `${Y}-01-01`, to = `${Y}-12-31`;
const chart = (ws: string): ChartAccount[] => [
  { id: `${ws}_cash`, workspaceId: ws, uid: 'owner-1', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' } as ChartAccount,
  { id: `${ws}_sales`, workspaceId: ws, uid: 'owner-1', code: '4000', name: 'Sales', type: 'income', category: 'Sales' } as ChartAccount,
  { id: `${ws}_rent`, workspaceId: ws, uid: 'owner-1', code: '6000', name: 'Rent', type: 'expense', category: 'Rent' } as ChartAccount,
  { id: `${ws}_fuel`, workspaceId: ws, uid: 'owner-1', code: '6100', name: 'Fuel', type: 'expense', category: 'Fuel' } as ChartAccount,
];
const LINES: Array<[string, Array<[string, number]>]> = [
  ['01-05', [['rent', 900], ['cash', -900]]],
  ['01-12', [['cash', 1500], ['sales', -1500]]],
  ['02-03', [['fuel', 300], ['cash', -300]]],
  ['02-10', [['rent', 700], ['cash', -700]]],
  ['03-01', [['cash', 800], ['sales', -800]]],
  ['03-15', [['fuel', 200], ['cash', -200]]],
  ['04-02', [['cash', 300], ['fuel', -300]]],
];
const entries = (ws: string): Transaction[] => LINES.map(([day, lines], k) => ({
  id: `${ws}_e${k + 1}`, workspaceId: ws, uid: 'owner-1', date: `${Y}-${day}`, description: `E${k + 1}`,
  totalAmountCents: Math.max(...lines.map(([, c]) => Math.abs(c))), currency: 'USD', status: 'completed', type: 'journal',
  ...(k === 6 ? { metadata: { isReversal: true, reversesTxId: `${ws}_e3` } } : {}),
  lines: lines.map(([a, amountCents]) => ({ accountId: `${ws}_${a}`, amountCents })),
}) as Transaction);
const loadedOf = (all: Transaction[]) => all.slice(3);
const brief = (items: TopLineItem[]) => items.map(i => `${i.description} ${i.accountName} ${i.amountCents}`);
const TRUTH = { topExpenses: ['E1 Rent 900', 'E4 Rent 700', 'E6 Fuel 200'], topIncome: ['E2 Sales 1500', 'E5 Sales 800'] };

describe('L-123 step 4a: top lines (no database)', () => {
  const ws = 'component-workspace';
  const all = entries(ws), loaded = loadedOf(all), accounts = chart(ws);
  afterEach(() => { cleanup(); useLedgerStore.setState({ truncatedCollections: {} }); });

  test('every entry gives the hand-worked list; the loaded four do not; when the server is needed', () => {
    assert.equal(openingCutoff(loaded), `${Y}-02-10`);
    const full = computeTopExpensesAndIncome(accounts, all, 25, from, to);
    assert.deepEqual({ topExpenses: brief(full.topExpenses), topIncome: brief(full.topIncome) }, TRUTH);
    const own = computeTopExpensesAndIncome(accounts, loaded, 25, from, to);
    assert.deepEqual(brief(own.topExpenses), ['E4 Rent 700', 'E6 Fuel 200']);
    assert.deepEqual(brief(own.topIncome), ['E5 Sales 800']);
    assert.equal(linesNeedServer(true, `${Y}-02-10`, from), true);
    assert.equal(linesNeedServer(true, `${Y}-02-10`, `${Y}-02-10`), true, 'the cut-off day may be cut part-way');
    assert.equal(linesNeedServer(true, `${Y}-02-10`, `${Y}-02-11`), false, 'every entry after the cut-off day is loaded');
    assert.equal(linesNeedServer(false, `${Y}-02-10`, from), false);
    assert.equal(linesNeedServer(true, `${Y}-02-10`, undefined), true);
    const edited = loaded.map(t => t.id === `${ws}_e6` ? { ...t, lines: [{ accountId: `${ws}_fuel`, amountCents: 250 }, { accountId: `${ws}_cash`, amountCents: -250 }] } as Transaction : t);
    assert.notEqual(rangeRevision(edited, from), rangeRevision(loaded, from), 'an edit inside the range changes the revision');
    assert.equal(rangeRevision(edited, `${Y}-04-01`), rangeRevision(loaded, `${Y}-04-01`), 'an edit before the range does not');
  });

  test('screen: no request when not capped; the server\'s list when capped; the loaded list with a note when it fails', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts, transactions: loaded, truncatedCollections: {} } as never);
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const q = new URL(String(input), 'http://x').searchParams;
      const full = computeTopExpensesAndIncome(accounts, all, Number(q.get('limit')), q.get('from')!, q.get('to')!);
      return new Response(JSON.stringify({ status: 'success', ...full }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<TopExpensesIncomeReportView selectedYear={Y} />);
    assert.ok(document.body.textContent!.includes(formatCurrency(700)));
    assert.ok(!document.body.textContent!.includes(formatCurrency(900)));
    assert.equal(screen.queryByTestId('top-lines-source'), null);
    assert.equal(urls.length, 0, 'not capped: no request');
    cleanup();

    useLedgerStore.setState({ truncatedCollections: { transactions: true } });
    render(<TopExpensesIncomeReportView selectedYear={Y} />);
    await waitFor(() => assert.ok(document.body.textContent!.includes(formatCurrency(900)), document.body.textContent!), { timeout: 5000 });
    assert.ok(urls.includes(`/api/v1/balances/top-lines?workspaceId=${ws}&from=${from}&to=${to}&limit=25`), urls.join('\n'));
    assert.match(screen.getByTestId('top-lines-source').textContent || '', /read from every entry on the server/);
    cleanup();

    stubFetch(500);
    render(<TopExpensesIncomeReportView selectedYear={Y} />);
    await waitFor(() => assert.match(screen.getByTestId('top-lines-source').textContent || '', /loaded entries only/));
    assert.ok(!document.body.textContent!.includes(formatCurrency(900)));
    assert.ok(document.body.textContent!.includes(formatCurrency(700)));
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
const OWNER = 'owner-1';

describe('L-123 step 4a: GET /api/v1/balances/top-lines', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  let db: Firestore;
  let server: Server;
  let base = '';
  const realFetch = globalThis.fetch;
  const ws = `ws_l123f_${crypto.randomBytes(4).toString('hex')}`;
  const get = async (q: Record<string, string>, uid = OWNER) => {
    const res = await realFetch(`${base}/api/v1/balances/top-lines?${new URLSearchParams(q)}`, { headers: { 'x-test-uid': uid } });
    return { status: res.status, body: await res.json() as { topExpenses: TopLineItem[]; topIncome: TopLineItem[]; entriesRead: number } };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    const app = express();
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/balances', (await import('../server/routes/balanceRoutes')).balanceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'L-123 step 4a', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    await db.pool.query(`insert into public."chartAccounts" (id, data) select a->>'id', a from jsonb_array_elements($1::jsonb) a`, [JSON.stringify(chart(ws))]);
    await db.pool.query(`insert into public.transactions (id, data) select t->>'id', t from jsonb_array_elements($1::jsonb) t`, [JSON.stringify(entries(ws))]);
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'chartAccounts', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('every entry of the range: the hand-worked list, not the loaded four\'s; a reversal after the range counts; members only', async () => {
    const year = await get({ workspaceId: ws, from, to });
    assert.equal(year.status, 200);
    assert.equal(year.body.entriesRead, 7);
    assert.deepEqual({ topExpenses: brief(year.body.topExpenses), topIncome: brief(year.body.topIncome) }, TRUTH);
    const q1 = await get({ workspaceId: ws, from, to: `${Y}-03-31` });
    assert.deepEqual(brief(q1.body.topExpenses), TRUTH.topExpenses, 'E7 (April) still takes E3 out');
    assert.equal(q1.body.entriesRead, 7);
    assert.deepEqual(brief((await get({ workspaceId: ws, from, to, limit: '2' })).body.topExpenses), ['E1 Rent 900', 'E4 Rent 700']);
    assert.equal((await get({ workspaceId: ws, from, to }, 'stranger')).status, 403);
    assert.equal((await get({ workspaceId: ws, from: to, to: from })).status, 400);
    assert.equal((await get({ workspaceId: ws, from, to, limit: '0' })).status, 400);
    assert.equal((await get({ workspaceId: ws, from, to, limit: '101' })).status, 400);
    assert.equal((await get({ workspaceId: ws, from: '2010-01-01', to })).status, 400, 'more than three years');
    assert.equal((await get({ workspaceId: 'ws_missing_l123f', from, to })).status, 404);
  });
});
