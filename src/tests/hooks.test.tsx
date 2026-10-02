/**
 * src/hooks (H-28): the hooks themselves, rendered with React (the old hooks.test.ts re-implemented
 * their math instead of calling them). The ledger totals bar, amount sort and running balance;
 * the server report fetches; the role hook; timers, keyboard shortcuts and page-synced state.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import React from 'react';
import { useLedgerComputation } from '../hooks/useLedgerComputation';
import { useFinancialReporting } from '../hooks/useFinancialReporting';
import { hasRoleAtLeast, useCurrentRole } from '../hooks/useCurrentRole';
import { useTimeout } from '../hooks/useTimeout';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usePageSyncedState } from '../hooks/usePageSyncedState';
import { useAuthStore } from '../stores/useAuthStore';
import { useScenarioStore } from '../lib/scenarioStore';
import { useSavedViewsStore } from '../stores/useSavedViewsStore';
import { calculateFilteredTotals } from '../lib/txFilters';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Workspace } from '../types';

const bank = makeChartAccount({ id: 'bank', name: 'Operating', type: 'asset', category: 'Bank' });
const savings = makeChartAccount({ id: 'savings', name: 'Reserve', type: 'asset', category: 'Bank', code: '1010' });
const ar = makeChartAccount({ id: 'ar', name: 'Receivables', type: 'asset', category: 'Accounts Receivable', code: '1200' });
const ap = makeChartAccount({ id: 'ap', name: 'Payables', type: 'liability', category: 'Accounts Payable', code: '2000' });
const sales = makeChartAccount({ id: 'sales', name: 'Sales', type: 'income', category: 'Revenue', code: '4000' });
const rent = makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense', category: 'Operating Expenses', code: '6000' });
const accounts = [bank, savings, ar, ap, sales, rent];

const sale = makeTransaction({
  id: 'sale', date: '2026-03-01', totalAmountCents: 10000, type: 'income', createdAt: '2026-03-01T09:00:00Z',
  lines: [{ accountId: 'ar', amountCents: 10000 }, { accountId: 'sales', amountCents: -10000 }],
});
const rentEur = makeTransaction({
  id: 'rent-eur', date: '2026-03-02', totalAmountCents: 8000, currency: 'EUR', exchangeRate: 1.5, createdAt: '2026-03-02T09:00:00Z',
  lines: [{ accountId: 'rent', amountCents: 8000 }, { accountId: 'bank', amountCents: -8000 }],
});
const paymentIn = makeTransaction({
  id: 'payment-in', date: '2026-03-03', totalAmountCents: 6000, createdAt: '2026-03-03T09:00:00Z',
  lines: [{ accountId: 'bank', amountCents: 6000 }, { accountId: 'ar', amountCents: -6000 }],
});
const paymentOut = makeTransaction({
  id: 'payment-out', date: '2026-03-04', totalAmountCents: 2500, createdAt: '2026-03-04T09:00:00Z',
  lines: [{ accountId: 'ap', amountCents: 2500 }, { accountId: 'bank', amountCents: -2500 }],
});
const transfer = makeTransaction({
  id: 'transfer', date: '2026-03-05', totalAmountCents: 4000, isTransfer: true, createdAt: '2026-03-05T09:00:00Z',
  lines: [{ accountId: 'savings', amountCents: 4000 }, { accountId: 'bank', amountCents: -4000 }],
});
const unflaggedTransfer = makeTransaction({
  id: 'bank-to-bank', date: '2026-03-06', totalAmountCents: 1000, createdAt: '2026-03-06T09:00:00Z',
  lines: [{ accountId: 'bank', amountCents: 1000 }, { accountId: 'savings', amountCents: -1000 }],
});
const draft = makeTransaction({
  id: 'draft', date: '2026-03-07', status: 'draft', totalAmountCents: 99900, type: 'income',
  lines: [{ accountId: 'bank', amountCents: 99900 }, { accountId: 'sales', amountCents: -99900 }],
});
const ledger = [sale, rentEur, paymentIn, paymentOut, transfer, unflaggedTransfer, draft];

afterEach(() => cleanup());

describe('ledger totals bar (calculateFilteredTotals)', () => {
  test('a customer payment is money in, a supplier payment money out, transfers neither', () => {
    const totals = calculateFilteredTotals(ledger, accounts);
    // in: the sale 100.00 + the payment received 60.00; out: rent €80 at 1.5 = 120.00 + the payment made 25.00
    assert.equal(totals.inflowCents, 10000 + 6000);
    assert.equal(totals.outflowCents, 12000 + 2500);
    assert.equal(totals.postableCount, 6);
  });

  test('the search total is in the base currency', () => {
    const totals = calculateFilteredTotals([rentEur], accounts);
    assert.equal(totals.totalExposure, 12000); // not 8000 (the euro figure)
    const noLines = makeTransaction({ id: 'x', totalAmountCents: -2000, exchangeRate: 1.25, type: 'expense' });
    assert.equal(calculateFilteredTotals([noLines]).totalExposure, 2500);
  });
});

describe('useLedgerComputation', () => {
  beforeEach(() => {
    useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
    useSavedViewsStore.setState({ activeViewId: null }); // no saved view narrowing the list
  });

  test('totals, record count and the running balance skip drafts', () => {
    const { result } = renderHook(() => useLedgerComputation(ledger, null, '', accounts));
    assert.equal(result.current.stats.count, 7); // the list still shows the draft
    assert.equal(result.current.stats.inflowCents, 16000);
    assert.equal(result.current.stats.outflowCents, 14500);
    assert.equal(result.current.stats.discrepancies, 0);
    const balance = new Map(result.current.transactionsWithBalance.map(t => [t.id, t.balanceCents]));
    assert.equal(balance.get('sale'), 10000);
    assert.equal(balance.get('rent-eur'), 10000 - 12000);
    assert.equal(balance.get('draft'), 0); // not part of the books
  });

  test('sorting by amount uses the base currency', () => {
    const usd = makeTransaction({ id: 'usd', totalAmountCents: 10000, lines: [{ accountId: 'rent', amountCents: 10000 }, { accountId: 'bank', amountCents: -10000 }] });
    const { result } = renderHook(() => useLedgerComputation([usd, rentEur], null, '', accounts, { key: 'amount', direction: 'desc' }));
    // €80 at 1.5 = 120.00 is bigger than 100.00, although 8000 < 10000
    assert.deepEqual(result.current.smartFilteredTransactions.map(t => t.id), ['rent-eur', 'usd']);
  });

  test('a what-if scenario lists its entries when asked, but leaves the totals and checks alone', () => {
    useScenarioStore.setState({
      activeScenarioId: 's1',
      scenarios: [{ id: 's1', name: 'Hire', description: '', isActive: true, ghosts: [
        { id: 'g1', description: 'New hire', amountCents: 500000, date: '2026-04-01', frequency: 'once', isActive: true, type: 'expense' },
      ] }],
    });
    const hidden = renderHook(() => useLedgerComputation([sale], null, '', accounts)).result.current;
    assert.deepEqual(hidden.smartFilteredTransactions.map(t => t.id), ['sale']);
    const { result } = renderHook(() => useLedgerComputation([sale], { includeSimulations: true }, '', accounts));
    const ids = result.current.smartFilteredTransactions.map(t => t.id);
    assert.ok(ids.some(id => id.startsWith('ghost-g1')), 'the scenario entry is listed');
    assert.equal(result.current.stats.outflowCents, 0);
    assert.equal(result.current.stats.discrepancies, 0);
  });
});

describe('useFinancialReporting', () => {
  let urls: string[] = [];
  let status = 200;
  beforeEach(() => {
    urls = []; status = 200;
    useAuthStore.setState({ currentWorkspaceId: 'w 1', user: null });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ data: { netIncome: 4200 } }), { status, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  });

  test('asks the server for the period and returns its report', async () => {
    const { result } = renderHook(() => useFinancialReporting());
    let report: unknown;
    await act(async () => { report = await result.current.fetchPL('2026-01-01', '2026-03-31'); });
    assert.deepEqual(report, { netIncome: 4200 });
    assert.deepEqual(urls, ['/api/v1/reports/profit-and-loss?workspaceId=w+1&startDate=2026-01-01&endDate=2026-03-31']);
    assert.equal(result.current.loadingStates.profitAndLoss, false);
  });

  test('leaves out dates not given; each statement has its own address', async () => {
    const { result } = renderHook(() => useFinancialReporting());
    await act(async () => {
      await result.current.fetchBalanceSheet();
      await result.current.fetchTrialBalance('2026-06-30');
      await result.current.fetchCashFlow(undefined, '2026-06-30');
    });
    assert.deepEqual(urls, [
      '/api/v1/reports/balance-sheet?workspaceId=w+1',
      '/api/v1/reports/trial-balance?workspaceId=w+1&asOfDate=2026-06-30',
      '/api/v1/reports/cash-flow?workspaceId=w+1&endDate=2026-06-30',
    ]);
  });

  test('a failed request gives null (the screen keeps its own figures); no workspace asks nothing', async () => {
    status = 500;
    const { result } = renderHook(() => useFinancialReporting());
    let report: unknown = 'unset';
    const warn = console.warn; console.warn = () => {};
    try {
      await act(async () => { report = await result.current.fetchBalanceSheet('2026-06-30'); });
    } finally { console.warn = warn; }
    assert.equal(report, null);
    assert.equal(result.current.loadingStates.balanceSheet, false);

    act(() => useAuthStore.setState({ currentWorkspaceId: null }));
    urls = [];
    await act(async () => { report = await result.current.fetchPL(); });
    assert.equal(report, null);
    assert.deepEqual(urls, []);
  });
});

describe('useCurrentRole', () => {
  const ws = (roles: Record<string, string>) => ({ id: 'w1', name: 'W', uid: 'owner-1', roles } as unknown as Workspace);
  const as = (uid: string | null, workspace: Workspace) => {
    useAuthStore.setState({ user: uid ? ({ uid } as never) : null, currentWorkspaceId: 'w1', workspaces: [workspace] });
    return renderHook(() => useCurrentRole()).result.current;
  };

  test('owner by the workspace, others by their role, everyone else read-only', () => {
    const workspace = ws({ a1: 'accountant', b1: 'bookkeeper', old: 'admin' });
    assert.equal(as('owner-1', workspace), 'owner');
    assert.equal(as('a1', workspace), 'accountant');
    assert.equal(as('b1', workspace), 'bookkeeper');
    assert.equal(as('stranger', workspace), 'viewer');
    assert.equal(as('old', workspace), 'viewer'); // an unknown stored role gets nothing more than the server gives it
    assert.equal(as(null, workspace), 'viewer');
  });

  test('hasRoleAtLeast follows owner > accountant > bookkeeper > viewer', () => {
    assert.equal(hasRoleAtLeast('accountant', 'bookkeeper'), true);
    assert.equal(hasRoleAtLeast('bookkeeper', 'accountant'), false);
    assert.equal(hasRoleAtLeast('viewer', 'viewer'), true);
    assert.equal(hasRoleAtLeast('owner', 'accountant'), true);
  });
});

describe('useTimeout', () => {
  test('timers set through it never fire after the screen closes', async () => {
    let fired = 0;
    const { result, unmount } = renderHook(() => useTimeout());
    result.current.setSafeTimeout(() => { fired++; }, 5);
    const cancelled = result.current.setSafeTimeout(() => { fired += 10; }, 5);
    result.current.clearSafeTimeout(cancelled);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(fired, 1);
    result.current.setSafeTimeout(() => { fired++; }, 5);
    unmount();
    await new Promise(r => setTimeout(r, 20));
    assert.equal(fired, 1);
  });

  test('the declarative form runs once after the delay, and not without one', async () => {
    let fired = 0;
    renderHook(() => useTimeout(() => { fired++; }, 5));
    renderHook(() => useTimeout(() => { fired += 10; }, null));
    await new Promise(r => setTimeout(r, 20));
    assert.equal(fired, 1);
  });
});

describe('useKeyboardShortcuts', () => {
  function Screen({ log }: { log: string[] }) {
    useKeyboardShortcuts({ 'mod+k': () => log.push('search'), n: () => log.push('new'), '?': () => log.push('help'), escape: () => log.push('close') });
    return <input aria-label="Memo" />;
  }

  test('shortcuts work on the page but not while typing, except Escape', () => {
    const log: string[] = [];
    const { getByLabelText } = render(<Screen log={log} />);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'n' });
    fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
    fireEvent.keyDown(document.body, { key: 'n', altKey: true }); // not a shortcut
    const memo = getByLabelText('Memo');
    fireEvent.keyDown(memo, { key: 'n' });
    fireEvent.keyDown(memo, { key: 'Escape' });
    assert.deepEqual(log, ['search', 'new', 'help', 'close']);
  });
});

describe('usePageSyncedState', () => {
  test('a new page brings its value; edits survive ordinary rerenders', () => {
    const { result, rerender } = renderHook(({ page, value }) => usePageSyncedState(page, value, 'start'), {
      initialProps: { page: 'a', value: undefined as string | undefined },
    });
    assert.equal(result.current[0], 'start');
    act(() => result.current[1]('typed'));
    rerender({ page: 'a', value: undefined });
    assert.equal(result.current[0], 'typed');
    rerender({ page: 'b', value: 'from link' });
    assert.equal(result.current[0], 'from link');
    act(() => result.current[1](v => `${v}!`));
    assert.equal(result.current[0], 'from link!');
  });
});
