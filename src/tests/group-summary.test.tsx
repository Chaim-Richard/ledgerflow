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
import { averageFromTimeframe, parseRates, rateFromQuote } from '../lib/translationRates';
import { matchIntercompany, translate } from '../server/reports/groupReport';
import { makeTransaction } from './fixtures';
import { getLocalDateISO } from '../lib/utils';
import type { Transaction } from '../types';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { getSupabase } from '../lib/db/client';

describe('Translation (Z-17, Z-18)', () => {
  test('assets and liabilities at the closing rate, profit at the average, equity at the historical; the difference has its own line', () => {
    const eur = { income: 10000, cogs: 0, grossProfit: 10000, expense: 1000, netIncome: 9000, totalAssets: 109000, totalLiabilities: 0, totalEquity: 109000, equityAccounts: 100000, earlierProfit: 0 };
    const t = translate(eur, { closing: 1.2, average: 1.1, historical: 1 });
    assert.deepEqual(t, { income: 11000, cogs: 0, grossProfit: 11000, expense: 1100, netIncome: 9900, totalAssets: 130800, totalLiabilities: 0, totalEquity: 130800, cta: 20900 });
    assert.equal(t.totalAssets, t.totalLiabilities + t.totalEquity, 'still balances');
    assert.equal(translate(eur, null).cta, 0, 'its own currency: nothing to translate');
  });

  test('rates from the rate service (1 reporting currency = X), averaged over the days it has; never invented', () => {
    assert.equal(rateFromQuote({ USDEUR: 0.8 }, 'USD', 'EUR'), 1.25);
    assert.equal(rateFromQuote({}, 'USD', 'EUR'), undefined);
    assert.equal(averageFromTimeframe({ '2026-01-01': { USDEUR: 0.8 }, '2026-01-02': { USDEUR: 1 }, '2026-01-03': {} }, 'USD', 'EUR'), 1.125);
    assert.equal(averageFromTimeframe(undefined, 'USD', 'EUR'), undefined);
    assert.deepEqual(parseRates(['EUR'], { EUR: { closing: '1.2', average: '1.1', historical: '1' } }), { rates: { EUR: { closing: 1.2, average: 1.1, historical: 1 } } });
    assert.match((parseRates(['EUR'], { EUR: { closing: '1.2', average: '' } }) as { problem: string }).problem, /rates for EUR/);
  });
});

describe('Dealings between the companies (Z-19)', () => {
  const ic = (id: string, amount: number, meta: Record<string, unknown>, over: Partial<Transaction> = {}) =>
    makeTransaction({ id, date: '2026-05-01', status: 'completed', description: id, totalAmountCents: amount, metadata: { isIntercompany: true, ...meta }, ...over } as Partial<Transaction>);
  const toB = (id: string, other: string, amount = 500, over: Partial<Transaction> = {}) => ic(id, amount, { targetWorkspaceId: 'B', targetTxId: other }, over);
  const fromA = (id: string, other: string, amount = 500, over: Partial<Transaction> = {}) => ic(id, amount, { sourceWorkspaceId: 'A', sourceTxId: other }, over);

  test('a pair found on both sides is matched once; the rest are listed with why', () => {
    const a = [toB('e1', 'b1'), toB('e2', 'b2'), toB('e3', 'b3'), toB('e4', 'b4'), ic('e5', 100, { targetWorkspaceId: 'C', targetTxId: 'c1' }),
      ic('e6', 100, { targetWorkspaceId: 'D', targetTxId: 'd1' }), toB('e7', 'b7', 500, { date: '2025-05-01' }), toB('e8', 'b8', 500, { reversalEventId: 'r8' } as Partial<Transaction>)];
    const b = [fromA('b1', 'e1'), fromA('b3', 'e3', 500, { status: 'void' }), fromA('b4', 'e4', 400), fromA('b7', 'e7', 500, { date: '2025-05-01' }), fromA('b8', 'e8')];
    const result = matchIntercompany([{ workspaceId: 'A', name: 'Holding', currency: 'USD', entries: a }, { workspaceId: 'B', name: 'Daughter', currency: 'USD', entries: b }], new Set(['A', 'B', 'C']), '2026-01-01', '2026-12-31');
    assert.equal(result.matched, 1);
    assert.deepEqual(result.unmatched.map(i => [i.transactionId, i.reason, i.withName, i.otherAmountCents]), [
      ['e2', 'missing', 'Daughter', undefined],
      ['e3', 'undone', 'Daughter', undefined],
      ['e4', 'amount', 'Daughter', 400],
      ['e5', 'outside-group', null, undefined],
      ['e6', 'not-open', null, undefined],
      ['b8', 'undone', 'Holding', undefined],
    ], 'a different amount is listed once; an entry of another period is not checked');
  });
});

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
    assert.deepEqual(res.body.total, { currency: 'USD', income: 80000, cogs: 0, grossProfit: 80000, expense: 25000, netIncome: 55000, totalAssets: 255000, totalLiabilities: 0, totalEquity: 255000, cta: 0, eliminated: { assets: 0, liabilities: 0, difference: 0, income: 0, cogs: 0, expense: 0, profitDifference: 0, investment: 0 } });
    assert.equal(res.body.notIncluded, 0);
  });

  test('different currencies: side by side, no total', async () => {
    const res = await summary(mixed);
    assert.equal(res.status, 200);
    assert.deepEqual((res.body.members as Array<{ currency: string }>).map(m => m.currency), ['USD', 'EUR']);
    assert.equal(res.body.total, null);
  });

  test('in one currency: the other is translated with the rates given, and the total has the translation difference', async () => {
    const rates = encodeURIComponent(JSON.stringify({ EUR: { closing: 1.2, average: 1.1, historical: 1 } }));
    const res = await call(`/api/v1/reports/group-summary?groupId=${mixed}&startDate=2026-01-01&endDate=2026-12-31&reportCurrency=USD&rates=${rates}`, ann);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.total, { currency: 'USD', income: 61000, cogs: 0, grossProfit: 61000, expense: 21100, netIncome: 39900, totalAssets: 260800, totalLiabilities: 0, totalEquity: 260800, cta: 20900, eliminated: { assets: 0, liabilities: 0, difference: 0, income: 0, cogs: 0, expense: 0, profitDifference: 0, investment: 0 } });
    const euro = (res.body.members as Array<{ name: string; income: number; translated: { cta: number } }>).find(m => m.name === 'Euro Co')!;
    assert.equal(euro.income, 10000, 'its own figures stay');
    assert.equal(euro.translated.cta, 20900);
    const missing = await call(`/api/v1/reports/group-summary?groupId=${mixed}&startDate=2026-01-01&endDate=2026-12-31&reportCurrency=USD`, ann);
    assert.equal(missing.status, 400);
    assert.match(String(missing.body.message), /rates for EUR/);
    assert.equal((await call(`/api/v1/reports/group-summary?groupId=${mixed}&startDate=2026-01-01&endDate=2026-12-31&reportCurrency=USD&rates=nope`, ann)).status, 400);
  });

  test('dealings between the members: matched pairs are counted, one without its match is listed', async () => {
    const put = (ws: string, id: string, meta: Record<string, unknown>, debit: string, credit: string) => db.collection('transactions').doc(id).set({
      workspaceId: ws, date: '2026-06-01', description: `Loan ${id}`, status: 'completed', type: 'actual', currency: 'USD', totalAmountCents: 700,
      metadata: { isIntercompany: true, ...meta }, lines: [{ accountId: `${ws}_${debit}`, amountCents: 700 }, { accountId: `${ws}_${credit}`, amountCents: -700 }],
    });
    // CB-26: what they owe each other sits on intercompany accounts
    await db.collection('chartAccounts').doc(`${ws1}_icfrom`).set({ workspaceId: ws1, name: 'Intercompany due from Daughter', type: 'asset', code: '1300' });
    await db.collection('chartAccounts').doc(`${ws2}_icto`).set({ workspaceId: ws2, name: 'Intercompany due to Holding', type: 'liability', code: '2300' });
    await put(ws1, `${ws1}_ic1`, { targetWorkspaceId: ws2, targetTxId: `${ws2}_ic1` }, 'icfrom', 'cash');
    await put(ws2, `${ws2}_ic1`, { sourceWorkspaceId: ws1, sourceTxId: `${ws1}_ic1` }, 'cash', 'icto');
    await put(ws1, `${ws1}_ic2`, { targetWorkspaceId: ws2, targetTxId: `${ws2}_gone` }, 'cash', 'cash');
    const res = await summary(sameCurrency);
    const dealings = res.body.intercompany as { matched: number; unmatched: Array<{ transactionId: string; reason: string }> };
    assert.equal(dealings.matched, 1);
    assert.deepEqual(dealings.unmatched.map(i => [i.transactionId, i.reason]), [[`${ws1}_ic2`, 'missing']]);
    const total = res.body.total as { totalAssets: number; totalLiabilities: number; totalEquity: number; eliminated: Record<string, number> };
    assert.deepEqual(total.eliminated, { assets: 700, liabilities: 700, difference: 0, income: 0, cogs: 0, expense: 0, profitDifference: 0, investment: 0 }, 'balances between the companies are taken out');
    assert.equal(total.totalLiabilities, 0);
    assert.equal(total.totalAssets, total.totalLiabilities + total.totalEquity, 'the group still balances');
  });

  let owned = '';
  test('with a parent, each company it owns is added in full and the other owners\' part is said (Z-16)', async () => {
    const made = await call('/api/v1/account/groups', ann, { method: 'POST', body: { name: 'Owned', workspaceIds: [ws1, ws2], parentId: ws1, ownership: { [ws2]: 80 } } });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    owned = String((made.body.group as { id: string }).id);
    const res = await summary(owned);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.parent, { workspaceId: ws1, name: 'Holding' });
    const members = res.body.members as Array<{ name: string; share: number; netIncome: number; totalEquity: number }>;
    assert.deepEqual(members.map(m => [m.name, m.share]), [['Holding', 100], ['Daughter', 80]]);
    const daughter = members[1];
    const total = res.body.total as { netIncome: number; totalEquity: number; otherOwners: { equity: number; netIncome: number } };
    assert.deepEqual(total.otherOwners, { equity: Math.round(daughter.totalEquity * 0.2), netIncome: Math.round(daughter.netIncome * 0.2) });
    assert.equal(total.otherOwners.netIncome, 5000, 'a fifth of the daughter\'s 25,000 profit');
    const plain = (await summary(sameCurrency)).body.total as { netIncome: number; totalEquity: number; otherOwners?: unknown };
    assert.deepEqual([total.netIncome, total.totalEquity], [plain.netIncome, plain.totalEquity], 'added in full');
    assert.equal(plain.otherOwners, undefined, 'a group without a parent says nothing about owners');
  });

  test('the parent\'s investment in a company is taken out of the total assets and equity (Z-16)', async () => {
    await db.collection('chartAccounts').doc(`${ws1}_invest`).set({ workspaceId: ws1, name: 'Shares in Daughter', type: 'asset', code: 'invest' });
    const pay = (ws: string, id: string, debit: string, credit: string) => db.collection('transactions').doc(`${ws}_${id}`).set({
      workspaceId: ws, date: '2026-02-01', description: id, status: 'completed', type: 'actual', currency: 'USD', totalAmountCents: 20000,
      lines: [{ accountId: `${ws}_${debit}`, amountCents: 20000 }, { accountId: `${ws}_${credit}`, amountCents: -20000 }],
    });
    await pay(ws1, 'buy-shares', 'invest', 'cash');
    await pay(ws2, 'issue-shares', 'cash', 'capital');
    const before = (await summary(owned)).body.total as { totalAssets: number; totalEquity: number; totalLiabilities: number; eliminated: { investment: number } };
    assert.equal(before.eliminated.investment, 0, 'nothing chosen yet');
    const set = await call(`/api/v1/account/groups/${owned}`, ann, { method: 'PUT', body: { investments: { [ws2]: `${ws1}_invest` } } });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    const after = (await summary(owned)).body.total as typeof before;
    assert.equal(after.eliminated.investment, 20000);
    assert.deepEqual([after.totalAssets, after.totalEquity], [before.totalAssets - 20000, before.totalEquity - 20000], 'the shares the parent holds and the capital the daughter got from it, both out');
    assert.equal(after.totalAssets, after.totalLiabilities + after.totalEquity);
    await call(`/api/v1/account/groups/${owned}`, ann, { method: 'PUT', body: { investments: { [ws2]: `${ws1}_sales` } } });
    const wrong = await summary(owned);
    assert.equal(wrong.status, 400);
    assert.match(String(wrong.body.error || wrong.body.message), /not an asset account of Holding/);
    assert.equal((await call(`/api/v1/account/groups/${owned}`, ann, { method: 'PUT', body: { investments: { [ws1]: `${ws1}_invest` } } })).status, 400, 'not for the parent itself');
    await call(`/api/v1/account/groups/${owned}`, ann, { method: 'PUT', body: { investments: { [ws2]: `${ws1}_invest` } } });
  });

  test('a group shared with someone: they see the companies they can open, and the rest are counted (DA-01)', async () => {
    await db.collection('workspaceGroups').doc(sameCurrency).update({ sharedWith: [bob] });
    try {
      const res = await summary(sameCurrency, bob);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual((res.body.members as Array<{ name: string }>).map(m => m.name), ['Daughter'], 'Bob can open the daughter, not the holding');
      assert.equal(res.body.notIncluded, 1);
    } finally {
      await db.collection('workspaceGroups').doc(sameCurrency).update({ sharedWith: [] });
    }
  });

  test('a member no longer open is left out and counted; other people, reversed periods and API keys are refused', async () => {
    await db.collection('workspaces').doc(ws2).update({ members: [bob] });
    const consolidation = await summary(owned);
    assert.equal(consolidation.status, 403, 'a group with a parent is refused, never quietly short');
    assert.match(String(consolidation.body.error || consolidation.body.message), /1 of them is not open to you/);
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
  const answer = (members: Array<Record<string, unknown>>, total: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => {
    const asked: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      const body = url.startsWith('/api/v1/account/groups') ? { status: 'success', groups } : { group: groups[0], members, total, notIncluded: 0, ...extra };
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

  test('with a parent: each company\'s share, and the other owners\' part of the profit and the equity (Z-16)', async () => {
    setComponentWorkspace('owner');
    answer([
      { workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, share: 100, ...figures(1000) },
      { workspaceId: 'ws-b', name: 'Daughter', currency: 'USD', isBalanced: true, share: 80, ...figures(2100) },
    ], { currency: 'USD', ...figures(3100), otherOwners: { equity: 1000, netIncome: 400 } }, { parent: { workspaceId: 'ws-a', name: 'Holding' } });
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByText('80% owned')));
    assert.ok(screen.getByText(/Parent: /));
    const row = (name: string) => screen.getByRole('rowheader', { name }).parentElement!.textContent || '';
    assert.match(row('of which net income of other owners'), /\$0\.00\$4\.00\$4\.00/);
    assert.match(row('of which equity of other owners'), /\$0\.00\$10\.00\$10\.00/);
  });

  test('sales between the companies taken out, and a difference between the two sides said (CB-26)', async () => {
    setComponentWorkspace('owner');
    answer([{ workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, ...figures(1000) }, { workspaceId: 'ws-b', name: 'Daughter', currency: 'USD', isBalanced: true, ...figures(2000) }],
      { currency: 'USD', ...figures(2600), eliminated: { assets: 0, liabilities: 0, difference: 0, income: 400, cogs: 0, expense: 300, profitDifference: 100 } });
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByText(/Sales between the companies taken out: \$4\.00 of income, and \$3\.00 of costs/)));
    assert.match(screen.getByRole('alert').textContent || '', /differ by \$1\.00/);
    assert.equal(screen.queryByText(/The parent's investment/), null, 'none chosen: nothing said');
  });

  test('in one currency: rates are asked for, filled from the rate service, and sent; the translation line shows', async () => {
    setComponentWorkspace('owner');
    const members = [
      { workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, ...figures(1000) },
      { workspaceId: 'ws-b', name: 'Euro Co', currency: 'EUR', isBalanced: true, ...figures(2000) },
    ];
    const asked: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      const body = url.startsWith('/api/v1/account/groups') ? { status: 'success', groups }
        : url.startsWith('/api/v1/currency/historical') ? { success: true, quotes: { USDEUR: 0.8 } }
          : url.startsWith('/api/v1/currency/timeframe') ? { success: true, quotes: { '2026-01-01': { USDEUR: 0.8 }, '2026-01-02': { USDEUR: 1 } } }
            : url.includes('reportCurrency=USD')
              ? { group: groups[0], members: members.map(m => ({ ...m, translated: { ...figures(2000), cta: m.currency === 'EUR' ? 150 : 0 } })), total: { currency: 'USD', ...figures(4000), cta: 150 }, notIncluded: 0 }
              : { group: groups[0], members, total: null, notIncluded: 0 };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByLabelText('In one currency')));
    fireEvent.change(screen.getByLabelText('In one currency'), { target: { value: 'USD' } });
    assert.match(screen.getByRole('status').textContent || '', /Enter the closing, average and historical rates for EUR to see the group in USD/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Fill from the rate service/ })); });
    await waitFor(() => assert.ok(asked.some(u => u.includes('reportCurrency=USD'))));
    const sent = new URLSearchParams(asked.find(u => u.includes('reportCurrency=USD'))!.split('?')[1]);
    assert.deepEqual(JSON.parse(sent.get('rates')!), { EUR: { closing: 1.25, average: 1.125, historical: 1.25 } });
    await waitFor(() => assert.ok(screen.getByRole('rowheader', { name: 'of which translation difference' })));
  });

  test('rates kept for the period fill in, and rates that worked are kept (Z-17)', async () => {
    setComponentWorkspace('owner');
    const today = getLocalDateISO();
    const start = `${today.slice(0, 4)}-01-01`;
    const keptGroups = [{ ...groups[0], rates: { [`USD:${start}:${today}`]: { EUR: { closing: 1.2, average: 1.1, historical: 1 } } } }];
    const members = [
      { workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, ...figures(1000) },
      { workspaceId: 'ws-b', name: 'Euro Co', currency: 'EUR', isBalanced: true, ...figures(2000) },
    ];
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const body = url === '/api/v1/account/groups' ? { status: 'success', groups: keptGroups }
        : url.endsWith('/rates') ? { status: 'success', group: keptGroups[0] }
          : url.includes('reportCurrency=USD')
            ? { group: groups[0], members: members.map(m => ({ ...m, translated: { ...figures(2000), cta: 0 } })), total: { currency: 'USD', ...figures(4000), cta: 0 }, notIncluded: 0 }
            : { group: groups[0], members, total: null, notIncluded: 0 };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByLabelText('In one currency')));
    await act(async () => { fireEvent.change(screen.getByLabelText('In one currency'), { target: { value: 'USD' } }); });
    await waitFor(() => assert.ok(calls.some(c => c.url.endsWith('/rates'))));
    const sent = new URLSearchParams(calls.find(c => c.url.includes('reportCurrency=USD'))!.url.split('?')[1]);
    assert.deepEqual(JSON.parse(sent.get('rates')!), { EUR: { closing: 1.2, average: 1.1, historical: 1 } }, 'no rates to type: the kept ones are used');
    const put = calls.find(c => c.url.endsWith('/rates'))!;
    assert.equal(put.url, '/api/v1/account/groups/grp_aaaaaaaa/rates');
    assert.deepEqual(put.body, { reportCurrency: 'USD', startDate: start, endDate: today, rates: { EUR: { closing: 1.2, average: 1.1, historical: 1 } } });
  });

  test('dealings without a match say why and open the entry in its own books', async () => {
    setComponentWorkspace('owner');
    const members = [{ workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, ...figures(1000) }];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.startsWith('/api/v1/account/groups') ? { status: 'success', groups } : {
        group: groups[0], members, total: { currency: 'USD', ...figures(1000), cta: 0 }, notIncluded: 0,
        intercompany: { matched: 2, unmatched: [{ workspaceId: 'ws-a', transactionId: 'tx-9', date: '2026-06-01', description: 'Loan', amountCents: 50000, currency: 'USD', withWorkspaceId: 'ws-b', withName: 'Daughter', reason: 'amount', otherAmountCents: 40000 }] },
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Dealings between the companies' })));
    assert.match(document.body.textContent || '', /2 matched on both sides; 1 without a match/);
    assert.ok(screen.getByText(/\$400\.00 in Daughter/));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /2026-06-01: Loan/ })); });
    assert.equal(useAuthStore.getState().currentWorkspaceId, 'ws-a');
    assert.deepEqual(useUIStore.getState().focusRecord, { type: 'transaction', id: 'tx-9' });
  });

  test('different currencies: no total, and why', async () => {
    setComponentWorkspace('owner');
    answer([
      { workspaceId: 'ws-a', name: 'Holding', currency: 'USD', isBalanced: true, ...figures(1000) },
      { workspaceId: 'ws-b', name: 'Euro Co', currency: 'EUR', isBalanced: false, ...figures(2000) },
    ], null);
    render(<GroupSummaryReportView />);
    await waitFor(() => assert.ok(screen.getByText(/No group total: these books are in USD, EUR. Choose one currency/)));
    assert.equal(screen.queryByRole('columnheader', { name: 'Group total' }), null);
    assert.match(screen.getByRole('alert').textContent || '', /balance sheet of Euro Co does not balance/);
  });
});
