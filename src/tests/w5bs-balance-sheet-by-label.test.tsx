/**
 * W5-BS: the balance sheet of one label value, from the real report (src/server/reports/byLabel.ts and the
 * /reports/balance-sheet-by-label route), with AI #3's A-210 ledger (a210-label-worked-figures.test.ts). Cents.
 *
 * The ledger: invoice INV-1 30,000 (tax 3,000) split A 10,000 : B 17,000; receipt 20,000; bill BILL-1 15,000
 * (tax 1,500) split A 5,000 : B 8,500; vendor payment 6,000. Each side is shared by the same weights, rounded:
 *   A  cash  20,000 × 10/27 = 7,407 in − 6,000 × 5/13.5 = 2,222 out           = 5,185
 *      A/R   30,000 × 10/27 = 11,111 − 7,407                                   = 3,704   → assets 8,889
 *      A/P   15,000 × 5/13.5 = 5,556 − 2,222                                   = 3,334
 *      tax   3,000 × 10/27 = 1,111 − 1,500 × 5/13.5 = 556                      =   555
 *      profit 10,000 − 5,000                                                   = 5,000   → claims 8,889
 *   B  cash 8,815 + A/R 6,296 = 15,111 = A/P 5,666 + tax 945 + profit 8,500
 *
 * Added, for what has no label (never shared out):
 *   owner pays in 1,000 (Cash / Owner's equity, no label); opening balances Cash 500 and Owner's equity 500
 *   → not labelled: assets 1,000 + 500 = 1,500; claims 1,000 + 500 = 1,500; 2 lines, 2 opening balances; A and B unchanged.
 *   a deposit of 2,000 whose cash line says A and whose A/P line has no label
 *   → A: assets 8,889 + 2,000 = 10,889, claims 8,889: does not balance by 2,000; not labelled: A/P 2,000.
 *   a line labelled C, a draft labelled A and an entry after 31 Jan: in none of A's figures.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { TransactionTemplates, type LineAccountWeight } from '../kernel/templates/TransactionTemplates';
import { balanceSheetByLabel } from '../server/reports/byLabel';
import { makeChartAccount, makeTransaction } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import LabelBalanceSheetReportView from '../components/reporting/LabelBalanceSheetReportView';
import type { ChartAccount, Transaction } from '../types';

const dimension = 'property';
const realFetch = globalThis.fetch;

/** AI #3's accounts and ledger, with the account ids under a prefix (the database test needs its own) */
function books(p = '') {
  const id = (s: string) => `${p}${s}`;
  const accounts: ChartAccount[] = [
    makeChartAccount({ id: id('cash'), code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
    makeChartAccount({ id: id('ar'), code: '1100', name: 'Accounts receivable', type: 'asset', category: 'Receivables' }),
    makeChartAccount({ id: id('ap'), code: '2100', name: 'Accounts payable', type: 'liability', category: 'Payables' }),
    makeChartAccount({ id: id('tax'), code: '2200', name: 'Net tax payable', type: 'liability', category: 'Payables' }),
    makeChartAccount({ id: id('owner'), code: '3000', name: "Owner's equity", type: 'equity', category: 'Equity' }),
    makeChartAccount({ id: id('revenue'), code: '4000', name: 'Rental income', type: 'income', category: 'Revenue' }),
    makeChartAccount({ id: id('repairs'), code: '6100', name: 'Repairs', type: 'expense', category: 'Expenses' }),
  ];
  const a = (s: string) => ({ id: id(s), name: s });
  const shares: LineAccountWeight[] = [
    { account: a('revenue'), weightCents: 10_000, dimensions: { [dimension]: 'A' } },
    { account: a('revenue'), weightCents: 17_000, dimensions: { [dimension]: 'B' } },
  ];
  const billShares: LineAccountWeight[] = [
    { account: a('repairs'), weightCents: 5_000, dimensions: { [dimension]: 'A' } },
    { account: a('repairs'), weightCents: 8_500, dimensions: { [dimension]: 'B' } },
  ];
  const tx = (txId: string, date: string, lines: Transaction['lines'], over: Partial<Transaction> = {}) => makeTransaction({ id: `${p}${txId}`, date, description: txId, lines, ...over });
  const ledger: Transaction[] = [
    tx('invoice-1', '2026-01-05', TransactionTemplates.buildInvoiceLines({
      invoiceNumber: 'INV-1', customerName: 'Tenant', totalCents: 30_000, taxCents: 3_000,
      arAccount: a('ar'), revenueAccount: a('revenue'), taxAccount: a('tax'), lineAccounts: shares,
    })),
    tx('receipt-1', '2026-01-12', TransactionTemplates.buildPaymentLines({
      documentNumber: 'INV-1', entityName: 'Tenant', amountCents: 20_000, cashAccount: a('cash'), offsetAccount: a('ar'), isReceipt: true, lineAccounts: shares,
    })),
    tx('bill-1', '2026-01-15', TransactionTemplates.buildBillLines({
      billNumber: 'BILL-1', vendorName: 'Repair vendor', totalCents: 15_000, taxCents: 1_500,
      apAccount: a('ap'), expenseAccount: a('repairs'), taxAccount: a('tax'), lineAccounts: billShares,
    })),
    tx('vendor-payment-1', '2026-01-22', TransactionTemplates.buildPaymentLines({
      documentNumber: 'BILL-1', entityName: 'Repair vendor', amountCents: 6_000, cashAccount: a('cash'), offsetAccount: a('ap'), isReceipt: false, lineAccounts: billShares,
    })),
  ];
  const ownerIn = tx('owner-in', '2026-01-02', [{ accountId: id('cash'), amountCents: 1_000 }, { accountId: id('owner'), amountCents: -1_000 }]);
  const halfLabelled = tx('deposit', '2026-01-25', [{ accountId: id('cash'), amountCents: 2_000, dimensions: { [dimension]: 'A' } }, { accountId: id('ap'), amountCents: -2_000 }]);
  const others = [
    tx('other-c', '2026-01-26', [{ accountId: id('cash'), amountCents: 700, dimensions: { [dimension]: 'C' } }, { accountId: id('owner'), amountCents: -700, dimensions: { [dimension]: 'C' } }]),
    tx('draft-a', '2026-01-27', [{ accountId: id('cash'), amountCents: 900, dimensions: { [dimension]: 'A' } }, { accountId: id('owner'), amountCents: -900, dimensions: { [dimension]: 'A' } }], { status: 'draft' }),
    tx('february-a', '2026-02-03', [{ accountId: id('cash'), amountCents: 400, dimensions: { [dimension]: 'A' } }, { accountId: id('owner'), amountCents: -400, dimensions: { [dimension]: 'A' } }]),
  ];
  const withOpenings = accounts.map(acc => (acc.id === id('cash') || acc.id === id('owner') ? { ...acc, openingBalanceCents: 500 } : acc));
  return { id, accounts, withOpenings, ledger, ownerIn, halfLabelled, others };
}

const figures = (r: ReturnType<typeof balanceSheetByLabel>, id: (s: string) => string) => ({
  cash: r.sheet.assets[id('cash')], ar: r.sheet.assets[id('ar')], ap: r.sheet.liabilities[id('ap')], tax: r.sheet.liabilities[id('tax')],
  profit: r.sheet.netIncome, assets: r.sheet.totalAssets, claims: r.sheet.totalClaims, balanced: r.sheet.isBalanced,
});

test('A-210 from the real report: A 8,889 = 8,889 and B 15,111 = 15,111 on 31 Jan, nothing unlabelled', () => {
  const { id, accounts, ledger } = books();
  const a = balanceSheetByLabel(accounts, ledger, dimension, 'A', '2026-01-31');
  assert.deepEqual(figures(a, id), { cash: 5_185, ar: 3_704, ap: 3_334, tax: 555, profit: 5_000, assets: 8_889, claims: 8_889, balanced: true });
  const b = balanceSheetByLabel(accounts, ledger, dimension, 'B', '2026-01-31');
  assert.deepEqual(figures(b, id), { cash: 8_815, ar: 6_296, ap: 5_666, tax: 945, profit: 8_500, assets: 15_111, claims: 15_111, balanced: true });
  assert.deepEqual([a.notLabelled.lines, a.notLabelled.openings, a.notLabelled.sheet.totalAssets], [0, 0, 0]);
  assert.deepEqual(a.rows.map(r => r.code), ['1000', '1100', '2100', '2200'], 'assets, then liabilities, by code');
});

test('what has no label is its own column, never shared out: 1,000 paid in + openings 500 → 1,500 = 1,500; A unchanged', () => {
  const { id, withOpenings, ledger, ownerIn, others } = books();
  const r = balanceSheetByLabel(withOpenings, [...ledger, ownerIn, ...others], dimension, 'A', '2026-01-31');
  assert.deepEqual(figures(r, id), { cash: 5_185, ar: 3_704, ap: 3_334, tax: 555, profit: 5_000, assets: 8_889, claims: 8_889, balanced: true }, 'the C line, the draft and February leave A as it was');
  const n = r.notLabelled;
  assert.deepEqual([n.lines, n.openings], [2, 2]);
  assert.deepEqual([n.sheet.assets[id('cash')], n.sheet.equity[id('owner')], n.sheet.totalAssets, n.sheet.totalClaims, n.sheet.isBalanced], [1_500, 1_500, 1_500, 1_500, true]);
  assert.ok(r.rows.some(row => row.id === id('owner') && row.type === 'equity'));
});

test('an entry labelled on one side only: A shows 10,889 against 8,889 and says it does not balance; the 2,000 A/P is not labelled', () => {
  const { id, accounts, ledger, halfLabelled } = books();
  const r = balanceSheetByLabel(accounts, [...ledger, halfLabelled], dimension, 'A', '2026-01-31');
  assert.deepEqual([r.sheet.assets[id('cash')], r.sheet.totalAssets, r.sheet.totalClaims, r.sheet.isBalanced], [7_185, 10_889, 8_889, false]);
  assert.deepEqual([r.notLabelled.lines, r.notLabelled.sheet.liabilities[id('ap')], r.notLabelled.sheet.totalClaims], [1, 2_000, 2_000]);
});

afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

test('the screen shows A\'s sheet beside the not labelled column, and says when it does not balance', async () => {
  const ws = setComponentWorkspace('viewer');
  useAuthStore.setState({ workspaces: [{ ...ws, dimensions: [{ id: dimension, name: 'Property' }] }] } as never);
  useLedgerStore.setState({ dimensionNodes: [{ id: 'A', dimensionId: dimension, description: 'Harbour flats' }, { id: 'B', dimensionId: dimension, description: 'Hill house' }] } as never);
  const { accounts, ledger, halfLabelled } = books();
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    const q = new URL(String(input), 'http://x').searchParams;
    const report = balanceSheetByLabel(accounts, [...ledger, halfLabelled], String(q.get('dimensionId')), String(q.get('value')), String(q.get('endDate')));
    return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  render(<LabelBalanceSheetReportView />);
  const card = await waitFor(() => screen.getByTestId('label-balance-sheet'));
  assert.match(asked[0], /dimensionId=property&value=A&endDate=/);
  const rows = within(card).getAllByRole('row').map(r => r.textContent || '');
  assert.ok(rows.some(t => /^1000 Cash\$71\.85$/.test(t)), rows.join(' | '));
  assert.ok(rows.some(t => /^2100 Accounts payable\$33\.34\$20\.00$/.test(t)), rows.join(' | '));
  assert.ok(rows.some(t => /^Total assets\$108\.89$/.test(t)), rows.join(' | '));
  assert.ok(rows.some(t => /^Total liabilities and equity\$88\.89\$20\.00$/.test(t)), rows.join(' | '));
  assert.match(within(card).getByRole('alert').textContent || '', /does not balance by \$20\.00/);
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('the route on a real database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_w5bs_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const { id, accounts, ledger, ownerIn } = books(`${ws}_`);

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Two properties', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set({ ...a, workspaceId: ws, uid: OWNER });
    for (const t of [...ledger, ownerIn]) await db.collection('transactions').doc(t.id).set({ ...t, workspaceId: ws, uid: OWNER });
    const app = express();
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: OWNER, email: 'owner@props.test' }; next(); });
    app.use('/api/v1/reports', reportRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
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

  test('GET /reports/balance-sheet-by-label gives A 8,889 and B 15,111; the 1,000 paid in is not labelled; a bad query is 400', async () => {
    const get = async (q: Record<string, string>) => {
      const res = await fetch(`${base}/api/v1/reports/balance-sheet-by-label?${new URLSearchParams({ workspaceId: ws, ...q })}`);
      return { status: res.status, body: await res.json() };
    };
    const a = await get({ dimensionId: dimension, value: 'A', endDate: '2026-01-31' });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.deepEqual(figures(a.body, id), { cash: 5_185, ar: 3_704, ap: 3_334, tax: 555, profit: 5_000, assets: 8_889, claims: 8_889, balanced: true });
    assert.deepEqual([a.body.notLabelled.lines, a.body.notLabelled.sheet.totalAssets, a.body.notLabelled.sheet.totalClaims], [2, 1_000, 1_000]);
    const b = await get({ dimensionId: dimension, value: 'B', endDate: '2026-01-31' });
    assert.deepEqual([b.body.sheet.totalAssets, b.body.sheet.totalClaims, b.body.sheet.isBalanced], [15_111, 15_111, true]);
    assert.equal((await get({ dimensionId: dimension, endDate: '2026-01-31' })).status, 400);
  });
});
