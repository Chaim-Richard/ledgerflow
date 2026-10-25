/**
 * L-123 step 3e: screens that sum a month or a year read the server's activity per account per month
 * (GET /api/v1/balances/activity, src/lib/periodActivity.ts, src/hooks/useServerActivity.ts) for the months the capped
 * loaded list may miss: every month on or before the oldest loaded day's month.
 *
 * Hand-worked case (cents), year Y = this year. Accounts: Cash (asset, Cash), Sales (income), Sales Tax (liability),
 * Rent (expense).
 *   E1 Y-01-10  Cash +1,100 / Sales −1,000 / Sales Tax −100
 *   E2 Y-01-20  Rent +400 / Cash −400
 *   E3 Y-01-25  Rent +50 (one line: unbalanced)
 *   E4 Y-02-05  Cash +2,200 / Sales −2,000 / Sales Tax −200
 *   E5 Y-02-15  Sales +500 / Cash −500 (a refund)
 *   E6 Y-02-25  Rent +400 / Cash −400
 *   E7 Y-03-10  Cash +3,300 / Sales −3,000 / Sales Tax −300
 *   E8 Y-03-20  Rent +600 / Cash −600
 * Loaded (the newest four, capped): E5…E8; oldest loaded day Y-02-15, so January and February come from the server.
 * Every entry, per month:
 *   Jan  Cash net 700 (dr 1,100 cr 400) · Sales −1,000 (cr 1,000) · Tax −100 · Rent 450 (dr 450) · 3 entries, 1 unbalanced
 *   Feb  Cash net 1,300 (dr 2,200 cr 900) · Sales −1,500 (dr 500 cr 2,000) · Tax −200 · Rent 400 · 3 entries
 *   Mar  Cash net 2,700 · Sales −3,000 · Tax −300 · Rent 600 · 2 entries
 * The loaded four alone: Feb Cash −900 · Sales 500 (dr 500) · Rent 400 · 2 entries; Mar as above; no January.
 * Screens:
 *   TaxManager (year Y): gross income = Sales dr+cr = 1,000 + 2,500 + 3,000 = 6,500 (loaded: 3,500); expenses = Rent
 *     450 + 400 + 600 = 1,450 (loaded 1,000); sales tax = −600 (loaded −300)
 *   FiscalPeriodManager, February: 3 entries, net impact −(−1,500 + 400) = 1,100 (loaded: 2 entries, −900); January:
 *     3 entries, net impact −(−1,000 + 450) = 550, 1 unbalanced (loaded: nothing)
 *   CashFlowPredictor trend, February (the oldest loaded month): 1,300 (loaded −900)
 *   BudgetLeft, Rent with a quarterly budget of 2,000 from Y-01: spent 1,450, left 550 (loaded: spent 1,000, left 1,000)
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
import TaxManager from '../components/finance/TaxManager';
import { BudgetLeft } from '../components/common/BudgetLeft';
import { useLedgerStore } from '../stores/useLedgerStore';
import { formatCurrency, workspaceYearMonth } from '../lib/utils';
import { resolveAccountRole } from '../lib/accountUtils';
import { activityByMonth, countActivity, mergedActivity, sumActivity, type ActivityByMonth } from '../lib/periodActivity';
import { availableBudget } from '../lib/availableBudget';
import { openingCutoff } from '../lib/serverBalances';
import type { SavedBudget } from '../lib/budgetActual';
import type { ChartAccount, Transaction } from '../types';
import type { Firestore } from '../server/db/pgFirestore';

const Y = workspaceYearMonth().year;
const from = `${Y}-01-01`, to = `${Y}-12-31`;
const chart = (ws: string): ChartAccount[] => [
  { id: `${ws}_cash`, workspaceId: ws, uid: 'owner-1', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' } as ChartAccount,
  { id: `${ws}_sales`, workspaceId: ws, uid: 'owner-1', code: '4000', name: 'Sales', type: 'income', category: 'Sales' } as ChartAccount,
  { id: `${ws}_tax`, workspaceId: ws, uid: 'owner-1', code: '2200', name: 'Sales Tax Payable', type: 'liability', category: 'Tax' } as ChartAccount,
  { id: `${ws}_rent`, workspaceId: ws, uid: 'owner-1', code: '6000', name: 'Rent', type: 'expense', category: 'Rent' } as ChartAccount,
];
const LINES: Array<[string, Array<[string, number]>]> = [
  ['01-10', [['cash', 1100], ['sales', -1000], ['tax', -100]]],
  ['01-20', [['rent', 400], ['cash', -400]]],
  ['01-25', [['rent', 50]]],
  ['02-05', [['cash', 2200], ['sales', -2000], ['tax', -200]]],
  ['02-15', [['sales', 500], ['cash', -500]]],
  ['02-25', [['rent', 400], ['cash', -400]]],
  ['03-10', [['cash', 3300], ['sales', -3000], ['tax', -300]]],
  ['03-20', [['rent', 600], ['cash', -600]]],
];
const entries = (ws: string): Transaction[] => LINES.map(([day, lines], k) => ({
  id: `${ws}_e${k + 1}`, workspaceId: ws, uid: 'owner-1', date: `${Y}-${day}`, description: `E${k + 1}`,
  totalAmountCents: Math.max(...lines.map(([, c]) => Math.abs(c))), currency: 'USD', status: 'completed', type: 'journal',
  lines: lines.map(([a, amountCents]) => ({ accountId: `${ws}_${a}`, amountCents })),
}) as Transaction);
const loadedOf = (all: Transaction[]) => all.slice(4);

/** the hand-worked months above, for workspace `ws` */
const truth = (ws: string): ActivityByMonth => {
  const a = (net: number, debits: number, credits: number) => ({ net, debits, credits });
  return {
    [`${Y}-01`]: { entries: 3, unbalanced: 1, accounts: { [`${ws}_cash`]: a(700, 1100, 400), [`${ws}_sales`]: a(-1000, 0, 1000), [`${ws}_tax`]: a(-100, 0, 100), [`${ws}_rent`]: a(450, 450, 0) } },
    [`${Y}-02`]: { entries: 3, unbalanced: 0, accounts: { [`${ws}_cash`]: a(1300, 2200, 900), [`${ws}_sales`]: a(-1500, 500, 2000), [`${ws}_tax`]: a(-200, 0, 200), [`${ws}_rent`]: a(400, 400, 0) } },
    [`${Y}-03`]: { entries: 2, unbalanced: 0, accounts: { [`${ws}_cash`]: a(2700, 3300, 600), [`${ws}_sales`]: a(-3000, 0, 3000), [`${ws}_tax`]: a(-300, 0, 300), [`${ws}_rent`]: a(600, 600, 0) } },
  };
};
const answer = (body: unknown, urls: string[] = []) => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const target = String(input);
    urls.push(target);
    if (target.startsWith('/api/v1/balances/activity')) return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return urls;
};

describe('L-123 step 3e: activity per month (no database)', () => {
  const ws = 'component-workspace';
  const all = entries(ws), loaded = loadedOf(all), accounts = chart(ws);
  const sales = (id: string) => id === `${ws}_sales`, rent = (id: string) => id === `${ws}_rent`;
  afterEach(() => { cleanup(); useLedgerStore.setState({ truncatedCollections: {} }); });

  test('the fold over every entry is the hand-worked figures; over the loaded four it is not', () => {
    assert.equal(openingCutoff(loaded), `${Y}-02-15`);
    assert.deepEqual(activityByMonth(all, from, to), truth(ws));
    const own = activityByMonth(loaded, from, to);
    assert.notDeepEqual(own, truth(ws));
    assert.equal(own[`${Y}-01`], undefined);
    assert.deepEqual(own[`${Y}-02`], { entries: 2, unbalanced: 0, accounts: { [`${ws}_cash`]: { net: -900, debits: 0, credits: 900 }, [`${ws}_sales`]: { net: 500, debits: 500, credits: 0 }, [`${ws}_rent`]: { net: 400, debits: 400, credits: 0 } } });
  });

  test('merged: January and February from the server, March from the loaded entries; no answer keeps the loaded fold', () => {
    const server = { workspaceId: ws, from, to, months: truth(ws) };
    const merged = mergedActivity(loaded, server, from, to, openingCutoff(loaded), ws);
    assert.deepEqual(merged, truth(ws));
    assert.deepEqual(mergedActivity(loaded, null, from, to, openingCutoff(loaded), ws), activityByMonth(loaded, from, to));
    assert.deepEqual(mergedActivity(loaded, { ...server, workspaceId: 'other' }, from, to, openingCutoff(loaded), ws), activityByMonth(loaded, from, to), 'another workspace\'s answer is not used');
    // the screens' figures from it
    const y = [`${Y}-01`, `${Y}-12`] as const;
    assert.equal(sumActivity(merged, ...y, sales, a => a.debits + a.credits), 6500, 'TaxManager gross income');
    assert.equal(sumActivity(activityByMonth(loaded, from, to), ...y, sales, a => a.debits + a.credits), 3500);
    assert.equal(sumActivity(merged, ...y, rent, a => a.debits + a.credits), 1450, 'TaxManager expenses');
    const profit = (id: string) => sales(id) || rent(id);
    assert.equal(-sumActivity(merged, `${Y}-02`, `${Y}-02`, profit, a => a.net), 1100, 'FiscalPeriodManager February net impact');
    assert.deepEqual(countActivity(merged, `${Y}-01`, `${Y}-01`), { entries: 3, unbalanced: 1 });
    assert.equal(-sumActivity(merged, `${Y}-01`, `${Y}-01`, profit, a => a.net), 550);
    assert.equal(resolveAccountRole(accounts[0]), 'cash');
    assert.equal(sumActivity(merged, `${Y}-02`, `${Y}-02`, id => id === `${ws}_cash`, a => a.net), 1300, 'CashFlowPredictor February');
  });

  const budget: SavedBudget = { id: 'b-rent', uid: 'u', targetId: `${ws}_rent`, targetType: 'account', period: 'quarterly', amountCents: 2000, createdAt: `${Y}-01-01`, name: 'Rent' } as SavedBudget;
  test('BudgetLeft: the quarter from the server (1,450 spent), the loaded entries without it (1,000); the edited entry is left out', () => {
    const base = { budgets: [budget], accounts, transactions: loaded, accountId: `${ws}_rent`, date: `${Y}-02-20` };
    const activity = mergedActivity(loaded, { workspaceId: ws, from, to, months: truth(ws) }, from, to, openingCutoff(loaded), ws);
    assert.equal(availableBudget(base)!.spentCents, 1000);
    assert.equal(availableBudget(base)!.leftCents, 1000);
    assert.equal(availableBudget({ ...base, activity })!.spentCents, 1450);
    assert.equal(availableBudget({ ...base, activity })!.leftCents, 550);
    assert.equal(availableBudget({ ...base, activity, excludeDocumentId: `${ws}_e6` })!.spentCents, 1050, 'E6 (rent 400) is the document being edited');
  });

  test('screens: TaxManager and BudgetLeft ask the server only when capped, and show its figures', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts, transactions: loaded, taxRates: [], budgets: [budget], truncatedCollections: {} } as never);
    const urls = answer({ status: 'success', workspaceId: ws, from, to, months: truth(ws) });
    render(<TaxManager />);
    await waitFor(() => assert.ok(document.body.textContent!.includes(formatCurrency(-300))));
    assert.ok(!urls.some(u => u.startsWith('/api/v1/balances/activity')), 'not capped: no request, the loaded figures');
    cleanup();

    useLedgerStore.setState({ truncatedCollections: { transactions: true } });
    render(<TaxManager />);
    await waitFor(() => assert.ok(document.body.textContent!.includes(formatCurrency(-600)), document.body.textContent!), { timeout: 5000 });
    assert.ok(urls.includes(`/api/v1/balances/activity?workspaceId=${ws}&from=${from}&to=${to}`), urls.join('\n'));
    cleanup();

    // BudgetLeft asks for its 23-month window; this answer holds the quarter's months
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const q = new URL(String(input), 'http://x').searchParams;
      return new Response(JSON.stringify({ status: 'success', workspaceId: ws, from: q.get('from'), to: q.get('to'), months: truth(ws) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<BudgetLeft accountId={`${ws}_rent`} date={`${Y}-02-20`} />);
    await waitFor(() => assert.match(screen.getByRole('status').textContent || '', new RegExp(`${formatCurrency(550).replace(/[$.]/g, '\\$&')} left`)), { timeout: 5000 });
    cleanup();
    stubFetch(404);
    render(<BudgetLeft accountId={`${ws}_rent`} date={`${Y}-02-20`} />);
    await waitFor(() => assert.match(screen.getByRole('status').textContent || '', new RegExp(`${formatCurrency(1000).replace(/[$.]/g, '\\$&')} left`)));
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
const OWNER = 'owner-1';

describe('L-123 step 3e: GET /api/v1/balances/activity', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  let db: Firestore;
  let server: Server;
  let base = '';
  const realFetch = globalThis.fetch;
  const ws = `ws_l123e_${crypto.randomBytes(4).toString('hex')}`;
  const get = async (q: Record<string, string>, uid = OWNER) => {
    const res = await realFetch(`${base}/api/v1/balances/activity?${new URLSearchParams(q)}`, { headers: { 'x-test-uid': uid } });
    return { status: res.status, body: await res.json() as { months: ActivityByMonth; entriesRead: number } };
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
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'L-123 step 3e', currency: 'USD', timezone: 'UTC', members: [OWNER] });
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

  test('every entry of the range, per month: the hand-worked figures, not the loaded four\'s; members only', async () => {
    const all = await get({ workspaceId: ws, from, to });
    assert.equal(all.status, 200);
    assert.equal(all.body.entriesRead, 8);
    assert.deepEqual(all.body.months, truth(ws));
    assert.deepEqual(all.body.months, activityByMonth(entries(ws), from, to), 'a fold over the full history');
    assert.notDeepEqual(all.body.months, activityByMonth(loadedOf(entries(ws)), from, to), 'not a fold over the loaded entries');
    const feb = await get({ workspaceId: ws, from: `${Y}-02-01`, to: `${Y}-02-20` });
    assert.deepEqual(Object.keys(feb.body.months), [`${Y}-02`]);
    assert.equal(feb.body.months[`${Y}-02`].entries, 2, 'E4 and E5: the range ends on the 20th');
    assert.equal((await get({ workspaceId: ws, from, to }, 'stranger')).status, 403);
    assert.equal((await get({ workspaceId: ws, from: to, to: from })).status, 400);
    assert.equal((await get({ workspaceId: ws, from: '2010-01-01', to })).status, 400, 'more than three years');
    assert.equal((await get({ workspaceId: 'ws_missing_l123e', from, to })).status, 404);
  });
});
