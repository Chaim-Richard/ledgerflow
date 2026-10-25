/**
 * L-123 step 3c: the balance-type screens that sum entries themselves read the server's balances through the oldest
 * loaded day (useLedgerStore.serverOpening, src/lib/serverBalances.ts balanceEntries) plus the loaded entries after it:
 * TrialBalanceView (browser-side sum), BalanceSheetView (browser-side sum), AccountBalancesAsOfView, PettyCashView
 * (the box's balance).
 *
 * Hand-worked case (cents). Accounts: Cash (asset 1000), Petty cash box (asset 1015, Cash), Sales (income 4000),
 * Rent (expense 6000); no account openings. The whole history (what the server has):
 *   E1 2026-01-10  Cash +100,000 / Sales −100,000
 *   E2 2026-01-20  Box   +20,000 / Cash   −20,000
 *   E3 2026-02-05  Rent  +30,000 / Cash   −30,000
 *   E4 2026-02-05  Rent   +1,500 / Box     −1,500
 *   E5 2026-03-01  Cash  +50,000 / Sales   −50,000
 *   E6 2026-03-15  Rent   +2,000 / Box     −2,000
 * The browser holds E4, E5, E6 (the loading cap cut 2026-02-05 part-way: E3 is not loaded).
 * Cut-off = oldest loaded day = 2026-02-05. The server through it (E1…E4):
 *   Cash 100,000 − 20,000 − 30,000 = 50,000 · Box 20,000 − 1,500 = 18,500 · Sales −100,000 · Rent 31,500
 * Loaded after it (E5, E6): Cash +50,000 · Box −2,000 · Sales −50,000 · Rent +2,000
 * Shown = every entry: Cash 100,000 · Box 16,500 · Sales 150,000 (credit) · Rent 33,500
 *   Trial balance: debits 100,000 + 16,500 + 33,500 = 150,000 = credits 150,000
 *   Balance sheet at 2026-03-31: assets 116,500; net income 150,000 − 33,500 = 116,500
 *   Petty cash box: 16,500 ($165.00)
 * The loaded entries alone (before this step): Cash 50,000 · Box −3,500 · Sales 50,000 · Rent 3,500
 *   Trial balance 53,500 / 53,500 · assets 46,500 · box −$35.00
 * A balance dated before the cut-off (2026-01-31) cannot use the server's sum (it covers through 2026-02-05), so it
 * stays the loaded entries' figure (nothing loaded is that old: 0).
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import TrialBalanceView from '../components/ledger/TrialBalanceView';
import BalanceSheetView from '../components/ledger/BalanceSheetView';
import PettyCashView from '../components/finance/PettyCashView';
import { AccountBalancesAsOfView } from '../components/reporting/EverydayReportViews';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { balanceEntries, openingCutoff, type ServerOpening } from '../lib/serverBalances';
import { accountBalancesAsOf } from '../lib/everydayReports';
import { formatCurrency } from '../lib/utils';
import type { ChartAccount, Transaction } from '../types';

const ws = 'component-workspace';
const chart: ChartAccount[] = [
  { id: 'cash', workspaceId: ws, code: '1000', name: 'Cash', type: 'asset', category: 'Cash', openingBalanceCents: 0 } as ChartAccount,
  { id: 'box', workspaceId: ws, code: '1015', name: 'Petty cash box', type: 'asset', category: 'Cash', openingBalanceCents: 0 } as ChartAccount,
  { id: 'sales', workspaceId: ws, code: '4000', name: 'Sales', type: 'income', category: 'Sales', openingBalanceCents: 0 } as ChartAccount,
  { id: 'rent', workspaceId: ws, code: '6000', name: 'Rent', type: 'expense', category: 'Rent', openingBalanceCents: 0 } as ChartAccount,
];
const entry = (id: string, date: string, debit: string, credit: string, cents: number): Transaction => ({
  id, workspaceId: ws, uid: 'test-user', date, description: id, totalAmountCents: cents, currency: 'USD', status: 'completed', type: 'journal',
  lines: [{ accountId: debit, amountCents: cents }, { accountId: credit, amountCents: -cents }],
} as Transaction);
const loaded = [
  entry('E4', '2026-02-05', 'rent', 'box', 1_500),
  entry('E5', '2026-03-01', 'cash', 'sales', 50_000),
  entry('E6', '2026-03-15', 'rent', 'box', 2_000),
];
const opening: ServerOpening = { workspaceId: ws, asOf: '2026-02-05', accounts: { cash: 50_000, box: 18_500, sales: -100_000, rent: 31_500 } };
const text = () => document.body.textContent || '';
const realFetch = globalThis.fetch;

describe('L-123 step 3c: balance screens read the server opening', () => {
  beforeEach(() => {
    try { localStorage.clear(); localStorage.setItem(`lf_petty_cash_${ws}`, JSON.stringify({ boxAccountId: 'box' })); } catch { /* no storage */ }
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('accounts', 'transactions', 'journalEntries', 'loans');
    useLedgerStore.setState({ accounts: chart, transactions: loaded, journalEntries: [], serverOpening: opening, truncatedCollections: { transactions: true } });
    // the server's reports are unavailable, so the screens show their browser-side sums
    globalThis.fetch = (async () => new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = realFetch;
    useLedgerStore.setState({ serverOpening: null, truncatedCollections: {} });
  });

  test('the hand-worked figures: balanceEntries folds the server in only for a date on or after the cut-off', () => {
    assert.equal(openingCutoff(loaded), '2026-02-05');
    const at = (date: string) => new Map(accountBalancesAsOf(chart, balanceEntries(loaded, opening, date, ws), date).map(r => [r.id, r.cents]));
    assert.deepEqual([...at('2026-03-31')], [['cash', 100_000], ['box', 16_500], ['sales', 150_000], ['rent', 33_500]]);
    assert.deepEqual([...at('2026-02-05')], [['cash', 50_000], ['box', 18_500], ['sales', 100_000], ['rent', 31_500]]);
    assert.equal(balanceEntries(loaded, opening, '2026-01-31', ws), loaded, 'before the cut-off: the loaded entries');
    assert.equal(balanceEntries(loaded, { ...opening, asOf: '2026-02-04' }, '2026-03-31', ws), loaded, 'an answer for another cut-off is not used');
    assert.equal(balanceEntries(loaded, opening, '2026-03-31', 'other-workspace'), loaded, 'nor one for another workspace');
  });

  test('trial balance: 150,000 / 150,000 with the server (53,500 from the loaded entries alone)', async () => {
    render(<TrialBalanceView accounts={chart} formatCurrency={formatCurrency} onDrillDown={() => {}} />);
    await waitFor(() => assert.ok(screen.getByTestId('tb-balances-source')));
    assert.match(screen.getByTestId('tb-balances-source').textContent || '', /through 2026-02-05/);
    for (const cents of [100_000, 16_500, 33_500, 150_000]) assert.ok(text().includes(formatCurrency(cents)), `${formatCurrency(cents)} shown`);
    cleanup();
    useLedgerStore.setState({ serverOpening: null });
    render(<TrialBalanceView accounts={chart} formatCurrency={formatCurrency} onDrillDown={() => {}} />);
    await waitFor(() => assert.ok(text().includes(formatCurrency(53_500))));
    assert.ok(!text().includes(formatCurrency(150_000)));
    assert.equal(screen.queryByTestId('tb-balances-source'), null);
  });

  test('balance sheet at 2026-03-31: assets 116,500 and net income 116,500 (46,500 loaded alone)', async () => {
    render(<BalanceSheetView accounts={chart} formatCurrency={formatCurrency} asOfDate="2026-03-31" />);
    await waitFor(() => assert.ok(screen.getByTestId('bs-balances-source')));
    assert.ok(text().includes(formatCurrency(116_500)), 'assets / net income 116,500');
    assert.ok(text().includes(formatCurrency(100_000)) && text().includes(formatCurrency(16_500)), 'Cash 100,000, box 16,500');
    assert.ok(!text().includes(formatCurrency(46_500)));
    cleanup();
    useLedgerStore.setState({ serverOpening: null });
    render(<BalanceSheetView accounts={chart} formatCurrency={formatCurrency} asOfDate="2026-03-31" />);
    await waitFor(() => assert.ok(text().includes(formatCurrency(46_500))));
    assert.equal(screen.queryByTestId('bs-balances-source'), null);
  });

  test('account balances as of 2026-03-31 with 2026-01-31 compared: the server for the first, loaded for the second', async () => {
    render(<AccountBalancesAsOfView asOfDate="2026-03-31" compareEndDate="2026-01-31" />);
    await waitFor(() => assert.ok(screen.getByTestId('balances-asof-source')));
    const row = (name: string) => screen.getByRole('rowheader', { name }).closest('tr')!.textContent || '';
    assert.ok(row('Cash').includes(`${formatCurrency(100_000)}${formatCurrency(0)} / ${formatCurrency(100_000)}`), row('Cash'));
    assert.ok(row('Petty cash box').startsWith(`1015Petty cash boxasset${formatCurrency(16_500)}`), row('Petty cash box'));
    assert.ok(row('Sales').includes(formatCurrency(150_000)), row('Sales'));
    assert.ok(row('Rent').includes(formatCurrency(33_500)), row('Rent'));
    // the server covers the cap, so the "incomplete" alert is not shown
    assert.equal(screen.queryByText(/These balances are provisional/), null);
  });

  test('petty cash: the box holds $165.00 by the books (−$35.00 from the loaded entries alone)', async () => {
    render(<PettyCashView />);
    await waitFor(() => assert.ok(text().includes(formatCurrency(16_500, 'USD'))));
    cleanup();
    useLedgerStore.setState({ serverOpening: null });
    render(<PettyCashView />);
    await waitFor(() => assert.ok(text().includes(formatCurrency(-3_500, 'USD'))));
    assert.ok(!text().includes(formatCurrency(16_500, 'USD')));
  });
});
