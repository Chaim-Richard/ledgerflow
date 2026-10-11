/**
 * Ask the books, verified (DA-03): a question is read into filters (accounts with their sub-accounts,
 * a label value by its code, description or alias, a period), said back in words; nothing it can't
 * place is filled in. The figure comes from the server's explanation (N-12) of those filters, on the
 * full history, posted entries only: the database part asks the example question from the roadmap and
 * checks the answer is exactly the posted electricity of Property 5 last year.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { answerCents, readPeriod, readQuestion } from '../lib/askBooks';
import AskBooksView from '../components/reporting/AskBooksView';
import { makeChartAccount } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import type { ChartAccount, DimensionDefinition, DimensionNode } from '../types';
import { getSupabase } from '../lib/db/client';

const accounts: ChartAccount[] = [
  makeChartAccount({ id: 'util', name: 'Utilities', type: 'expense' }),
  makeChartAccount({ id: 'elec', name: 'Electricity', type: 'expense', parentId: 'util' }),
  makeChartAccount({ id: 'water', name: 'Water', type: 'expense', parentId: 'util' }),
  makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense' }),
  makeChartAccount({ id: 'sales', name: 'Sales', type: 'income' }),
  makeChartAccount({ id: 'cash', name: 'Cash', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'old', name: 'Old rent', type: 'expense', isArchived: true }),
];
const dimensions: DimensionDefinition[] = [{ id: 'property', name: 'Property' }];
const nodes: DimensionNode[] = [
  { id: 'P5', dimensionId: 'property', description: 'Property 5', aliases: ['Ocean Ave'] },
  { id: 'P6', dimensionId: 'property', description: 'Property 6' },
];
const ctx = { accounts, dimensions, nodes, today: '2027-02-10' };

describe('Reading the question', () => {
  test('the roadmap\'s example: label, account, last year', () => {
    const r = readQuestion('How much did Property 5 spend on electricity last year?', ctx);
    assert.deepEqual(r.filter, { accountIds: ['elec'], startDate: '2026-01-01', endDate: '2026-12-31', label: { dimensionId: 'property', value: 'P5' } });
    assert.deepEqual(r.understood, { accounts: ['Electricity'], label: 'Property = Property 5', period: 'last year (2026-01-01 to 2026-12-31)' });
    assert.equal(r.sense, 'spent');
    assert.equal(r.problem, null);
  });

  test('an account takes in its sub-accounts; a label by its alias or code; archived accounts are not read', () => {
    assert.deepEqual(readQuestion('utilities at ocean ave in 2026', ctx).filter, { accountIds: ['util', 'elec', 'water'], startDate: '2026-01-01', endDate: '2026-12-31', label: { dimensionId: 'property', value: 'P5' } });
    assert.equal(readQuestion('rent for P6 this month', ctx).filter?.label?.value, 'P6');
    assert.deepEqual(readQuestion('old rent', ctx).filter?.accountIds, ['rent'], 'only the live "Rent" is named');
  });

  test('spending or income without an account means all of them; nothing to go on is said, not guessed', () => {
    assert.deepEqual(readQuestion('what did we spend in March 2026', ctx).filter?.accountIds.sort(), ['elec', 'rent', 'util', 'water']);
    const earned = readQuestion('income Q1 2026', ctx);
    assert.deepEqual([earned.filter?.accountIds, earned.filter?.startDate, earned.filter?.endDate, earned.sense], [['sales'], '2026-01-01', '2026-03-31', 'earned']);
    const lost = readQuestion('how are things', ctx);
    assert.equal(lost.filter, null);
    assert.match(String(lost.problem), /Name an account/);
    assert.match(String(readQuestion('rent per property', ctx).problem), /none of its values/);
  });

  test('periods, in the fiscal year when it starts later; none named is this year so far, and said', () => {
    assert.deepEqual(readPeriod('last month', '2027-01-15'), { startDate: '2026-12-01', endDate: '2026-12-31', said: 'last month (2026-12-01 to 2026-12-31)' });
    assert.equal(readPeriod('this month', '2027-02-10').startDate, '2027-02-01');
    assert.deepEqual([readPeriod('last fiscal year', '2027-02-10', 4).startDate, readPeriod('last fiscal year', '2027-02-10', 4).endDate], ['2025-04-01', '2026-03-31']);
    assert.deepEqual([readPeriod('this year', '2027-02-10', 4).startDate, readPeriod('this year', '2027-02-10', 4).endDate], ['2026-04-01', '2027-02-10']);
    assert.equal(readPeriod('feb 2024', '2027-02-10').endDate, '2024-02-29');
    assert.match(readPeriod('rent', '2027-02-10').said, /as no period was named/);
  });

  test('the answer reads money out or money in as positive', () => {
    assert.equal(answerCents(1200, 'spent'), 1200);
    assert.equal(answerCents(-5000, 'earned'), 5000);
    assert.equal(answerCents(-5000, 'net'), -5000);
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_ask_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Ask', members: ['owner-1'], dimensions });
    for (const acc of accounts) await db.collection('chartAccounts').doc(`${ws}_${acc.id}`).set({ ...acc, id: undefined, parentId: acc.parentId ? `${ws}_${acc.parentId}` : null, workspaceId: ws });
    const pay = (id: string, date: string, account: string, cents: number, property: string | null, status = 'completed') => db.collection('transactions').doc(`${ws}_${id}`).set({
      workspaceId: ws, date, description: id, status, type: 'actual', currency: 'USD',
      lines: [{ accountId: `${ws}_${account}`, amountCents: cents, ...(property ? { dimensions: { property } } : {}) }, { accountId: `${ws}_cash`, amountCents: -cents }],
    });
    await pay('jan', '2026-01-20', 'elec', 12000, 'P5');
    await pay('jul', '2026-07-20', 'elec', 9000, 'P5');
    await pay('other', '2026-07-21', 'elec', 4000, 'P6');
    await pay('water', '2026-07-22', 'water', 3000, 'P5');
    await pay('draft', '2026-08-01', 'elec', 777, 'P5', 'draft');
    await pay('thisyear', '2027-01-05', 'elec', 5000, 'P5');
    const app = express();
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/reports', reportRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'chartAccounts', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('"How much did Property 5 spend on electricity last year?" is exactly its posted electricity of 2026', async () => {
    const live = accounts.map(a => ({ ...a, id: `${ws}_${a.id}`, parentId: a.parentId ? `${ws}_${a.parentId}` : undefined }));
    const r = readQuestion('How much did Property 5 spend on electricity last year?', { ...ctx, accounts: live });
    const f = r.filter!;
    const query = new URLSearchParams({ workspaceId: ws, accountIds: f.accountIds.join(','), startDate: f.startDate, endDate: f.endDate, labelDimension: f.label!.dimensionId, labelValue: f.label!.value });
    const res = await fetch(`${base}/api/v1/reports/explain?${query}`, { headers: { 'x-test-uid': 'owner-1' } });
    const body = await res.json() as { totalCents: number; entries: number; lines: Array<{ description: string }> };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(answerCents(body.totalCents, r.sense), 21000, 'January and July; not Property 6, not water, not the draft, not this year');
    assert.deepEqual(body.lines.map(l => l.description), ['jan', 'jul']);
    // asked about utilities instead, water comes in
    const all = readQuestion('Property 5 utilities last year', { ...ctx, accounts: live }).filter!;
    const res2 = await fetch(`${base}/api/v1/reports/explain?${new URLSearchParams({ workspaceId: ws, accountIds: all.accountIds.join(','), startDate: all.startDate, endDate: all.endDate, labelDimension: 'property', labelValue: 'P5' })}`, { headers: { 'x-test-uid': 'owner-1' } });
    assert.equal(((await res2.json()) as { totalCents: number }).totalCents, 24000);
    assert.equal((await fetch(`${base}/api/v1/reports/explain?${query}`, { headers: { 'x-test-uid': 'stranger' } })).status, 403, 'only under your own access');
  });
});

describe('Reports → Ask the books', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('shows how the question was read, asks the server, and lists the entries behind the answer', async () => {
    setComponentWorkspace('owner');
    useAuthStore.setState(s => ({ workspaces: s.workspaces.map(w => ({ ...w, dimensions })) }));
    useLedgerStore.setState({ accounts, dimensionNodes: nodes });
    const calls = stubFetchWithBodies(200, { lines: [{ key: 'k1', date: '2026-01-20', description: 'January bill', accountName: 'Electricity', amountCents: 12000, document: { type: 'transaction', id: 't1' }, bankMatched: true, attachments: 1 }], totalCents: 12000, entries: 1 });
    render(<AskBooksView />);
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'How much did Property 5 spend on electricity in 2026?' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask' })); });
    assert.ok(screen.getByText('Electricity', { selector: 'summary' }));
    assert.equal((screen.getByLabelText('Label') as HTMLSelectElement).value, 'property\u0000P5');
    assert.equal((screen.getByLabelText('From') as HTMLInputElement).value, '2026-01-01');
    await waitFor(() => assert.match(document.body.textContent || '', /\$120\.00\s*spent · 1 entry/));
    const asked = new URL(calls.find(c => c.url.startsWith('/api/v1/reports/explain'))!.url, 'http://x');
    assert.deepEqual(Object.fromEntries(asked.searchParams), { workspaceId: 'component-workspace', accountIds: 'elec', startDate: '2026-01-01', endDate: '2026-12-31', labelDimension: 'property', labelValue: 'P5' });
    assert.match(document.body.textContent || '', /matched to the bank · 1 file/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /January bill/ })); });
    assert.deepEqual(useUIStore.getState().focusRecord, { type: 'transaction', id: 't1' });
  });

  test('changing what was understood asks again; a question with nothing to go on says so', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts, dimensionNodes: [] });
    const calls = stubFetchWithBodies(200, { lines: [], totalCents: 0, entries: 0 });
    render(<AskBooksView />);
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'how are things' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask' })); });
    assert.match(screen.getByRole('status').textContent || '', /Name an account/);
    assert.equal(calls.filter(c => c.url.startsWith('/api/v1/reports/explain')).length, 0, 'nothing asked of the server');
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'rent in 2026' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-30' } }); });
    await waitFor(() => assert.ok(calls.some(c => c.url.includes('endDate=2026-06-30'))));
  });
});
