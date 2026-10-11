/**
 * The P&L's basis switch (N-08): cash asks the server for `basis=cash` and shows only its figures,
 * says what cash basis counts and how many entries it left out, and lists no entries behind a figure;
 * if the server can't be reached it says so instead of showing the accrual figures.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfitAndLossView from '../components/ledger/ProfitAndLossView';
import BalanceSheetView from '../components/ledger/BalanceSheetView';
import { getSupabase } from '../lib/db/client';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount, makeTransaction } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';

const chart = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' }),
];
const ledger = [makeTransaction({ id: 't1', date: '2026-05-05', status: 'completed', lines: [{ accountId: 'cash', amountCents: 100000 }, { accountId: 'sales', amountCents: -100000 }] } as never)];
const pl = (income: number, extra: Record<string, unknown> = {}) => ({
  income: { total: income, accounts: { sales: { name: 'Sales', code: '4000', balance: income } } }, cogs: { total: 0, accounts: {} }, expense: { total: 0, accounts: {} }, grossProfit: income, netIncome: income, ...extra,
});

describe('Cash or accrual on the P&L', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('cash asks the server for it, shows its figures and what it counts; no entries listed behind a figure', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts: chart, transactions: ledger });
    const asked: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      const body = url.includes('basis=cash') ? pl(60000, { basis: 'cash', leftOut: 2 }) : pl(100000);
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<ProfitAndLossView startDate="2026-05-01" endDate="2026-05-31" />);
    await waitFor(() => assert.ok(screen.getAllByText('$1,000.00').length > 0));
    await act(async () => { fireEvent.change(screen.getByLabelText('Basis'), { target: { value: 'cash' } }); });
    await waitFor(() => assert.match(screen.getByRole('status', { name: '' }).textContent || '', /Cash basis: invoices count when they are paid/));
    assert.ok(asked.some(u => u.includes('/api/v1/reports/profit-and-loss') && u.includes('basis=cash') && u.includes('startDate=2026-05-01')));
    assert.match(document.body.textContent || '', /2 entries on receivables or payables without cash/);
    assert.ok(screen.getAllByText('$600.00').length > 0);
    assert.equal(screen.queryAllByText('$1,000.00').length, 0, 'the accrual figure is not shown');
    await act(async () => { fireEvent.click(screen.getByTitle('Click to drill down into Sales')); });
    assert.equal(screen.queryByText(/Where this number comes from/), null);
    await act(async () => { fireEvent.change(screen.getByLabelText('Basis'), { target: { value: 'accrual' } }); });
    await waitFor(() => assert.ok(screen.getAllByText('$1,000.00').length > 0));
  });

  test('if the server can\'t be reached, cash basis says so and shows no accrual figures', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts: chart, transactions: ledger });
    globalThis.fetch = (async (input: RequestInfo | URL) => (String(input).includes('basis=cash')
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify(pl(100000)), { status: 200, headers: { 'Content-Type': 'application/json' } }))) as typeof fetch;
    render(<ProfitAndLossView startDate="2026-05-01" endDate="2026-05-31" />);
    await act(async () => { fireEvent.change(screen.getByLabelText('Basis'), { target: { value: 'cash' } }); });
    await waitFor(() => assert.match(document.body.textContent || '', /could not be reached/));
    assert.equal(screen.queryAllByText('$1,000.00').length, 0);
  });
});

describe('Cash or accrual on the balance sheet', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('cash asks the server for it, shows its figures, what it leaves out, and a payment not yet applied', async () => {
    setComponentWorkspace('owner');
    const sheet = [...chart, makeChartAccount({ id: 'ar', code: '1100', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' })];
    useLedgerStore.setState({ accounts: sheet, transactions: ledger });
    const asked: string[] = [];
    const bs = (cash: number, extra: Record<string, unknown> = {}) => ({ assets: { cash }, liabilities: {}, equity: {}, totalAssets: cash, totalLiabilities: 0, totalEquity: 0, netIncome: cash, totalClaims: cash, isBalanced: true, ...extra });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      const body = url.includes('basis=cash') ? bs(70000, { basis: 'cash', leftOut: 1, notApplied: 5000, totalLiabilities: 5000, netIncome: 65000 }) : bs(100000);
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<BalanceSheetView accounts={sheet} formatCurrency={(c: number) => `$${(c / 100).toFixed(2)}`} asOfDate="2026-05-31" />);
    await act(async () => { fireEvent.change(screen.getByLabelText('Basis'), { target: { value: 'cash' } }); });
    await waitFor(() => assert.match(document.body.textContent || '', /Cash basis: what customers owe and what is owed to vendors is not on it/));
    assert.ok(asked.some(u => u.includes('/api/v1/reports/balance-sheet') && u.includes('basis=cash')));
    assert.match(document.body.textContent || '', /1 entry on receivables or payables without cash/);
    assert.match(screen.getByText('Paid, not yet applied to an invoice or bill').parentElement!.textContent || '', /\$50\.00/);
  });
});
