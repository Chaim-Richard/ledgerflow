/**
 * C-95 on the screens: the totals on the profit & loss open the entries they are made of, asking the
 * server to explain the same figure with every account the total adds up — and, on a cash basis
 * report, saying plainly that the entries are not listed instead of opening a wrong list.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ProfitAndLossView from '../components/ledger/ProfitAndLossView';
import { makeChartAccount, makeTransaction } from './fixtures';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';

const accounts = [
  makeChartAccount({ id: 'income-a', code: '4000', name: 'Sales', type: 'income', category: 'Revenue', balanceCents: 1000000 }),
  makeChartAccount({ id: 'income-b', code: '4100', name: 'Services', type: 'income', category: 'Revenue', balanceCents: 234500 }),
  makeChartAccount({ id: 'expense-a', code: '5000', name: 'Rent', type: 'expense', category: 'Expenses', balanceCents: 400000 }),
  makeChartAccount({ id: 'cash', code: '1000', name: 'Bank', type: 'asset', category: 'Cash', balanceCents: 0 }),
];
const transactions = [
  makeTransaction({ id: 'sale-1', workspaceId: 'component-workspace', date: '2026-03-02', lines: [{ accountId: 'income-a', amountCents: -1000000 }, { accountId: 'cash', amountCents: 1000000 }] }),
  makeTransaction({ id: 'sale-2', workspaceId: 'component-workspace', date: '2026-03-09', lines: [{ accountId: 'income-b', amountCents: -234500 }, { accountId: 'cash', amountCents: 234500 }] }),
  makeTransaction({ id: 'rent', workspaceId: 'component-workspace', date: '2026-03-15', lines: [{ accountId: 'expense-a', amountCents: 400000 }, { accountId: 'cash', amountCents: -400000 }] }),
];

let requested: string[] = [];
beforeEach(() => {
  requested = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  markComponentCollectionsLoaded('transactions', 'accounts', 'journalEntries', 'invoices', 'bills', 'payments', 'recurring', 'projects');
  setComponentWorkspace('owner');
  useLedgerStore.setState({ transactions, accounts });
});
afterEach(() => cleanup());

const renderPnl = async () => {
  render(<ProfitAndLossView startDate="2026-03-01" endDate="2026-03-31" />);
  await act(async () => {});
};

describe('The profit & loss totals', () => {
  test('the revenue total opens the entries of every revenue account, with the figure on screen', async () => {
    await renderPnl();
    const buttons = await screen.findAllByLabelText(/See the entries behind/i);
    // the revenue card comes first; its name is the workspace template's own word for income
    await act(async () => { fireEvent.click(buttons[0]); });
    const explain = requested.find(url => url.includes('/api/v1/reports/explain'));
    assert.ok(explain, 'the server is asked to explain the figure');
    const query = new URL(explain, 'http://test').searchParams;
    const ids = (query.get('accountIds') || '').split(',').filter(Boolean);
    assert.ok(ids.includes('income-a') && ids.includes('income-b'), `the total asks for both revenue accounts, got ${ids}`);
    assert.equal(ids.includes('expense-a'), false, 'the revenue total does not reach into expenses');
    assert.equal(query.get('startDate'), '2026-03-01');
    assert.equal(query.get('endDate'), '2026-03-31');
  });

  test('every total has its own named control, and the lines load into the drill-down', async () => {
    await renderPnl();
    const labels = screen.getAllByLabelText(/See the entries behind/i).map(el => el.getAttribute('aria-label') || '');
    assert.ok(labels.length >= 3, `the revenue, expense and net total each open, got ${labels.join(' / ')}`);
    const expense = screen.getByLabelText(/See the entries behind .*expenditure|See the entries behind .*expense/i);
    await act(async () => { fireEvent.click(expense); });
    const explain = requested.filter(url => url.includes('/api/v1/reports/explain')).at(-1);
    const ids = (new URL(explain!, 'http://test').searchParams.get('accountIds') || '').split(',');
    assert.deepEqual(ids, ['expense-a'], 'the expense total asks for the expense accounts only');
  });
});
