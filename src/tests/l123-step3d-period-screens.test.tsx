/**
 * L-123 step 3d: the period and trend screens read the server's balances through the oldest loaded day
 * (useLedgerStore.serverOpening, src/lib/serverBalances.ts balanceEntries / periodEntries) plus the loaded entries
 * after it: FinancialRatiosReportView, FinancialChartsDashboard (cash and runway), CloseComparisonPanel.
 *
 * Hand-worked case (cents). Accounts: Cash (asset 1000, Cash), Receivables (asset 1200, Receivables),
 * Payables (liability 2000, Payables), Sales (income 4000), Rent (expense 6000); no account openings.
 * The whole history (what the server has):
 *   E1 2026-01-10  Cash +100,000 / Sales −100,000
 *   E2 2026-01-20  AR    +40,000 / Sales  −40,000
 *   E3 2026-02-05  Rent  +30,000 / AP     −30,000
 *   E4 2026-02-05  Cash  +10,000 / AR     −10,000
 *   E5 2026-03-10  AR    +20,000 / Sales  −20,000
 *   E6 2026-03-20  Rent   +5,000 / Cash    −5,000
 * The browser holds E4, E5, E6 (the loading cap cut 2026-02-05 part-way: E3 is not loaded). Cut-off 2026-02-05.
 * The server through it (E1…E4): Cash 110,000 · AR 30,000 · AP −30,000 · Sales −140,000 · Rent 30,000.
 *
 * Ratios for March 2026 (starts after the cut-off, so the server's sums are folded in) = the whole history:
 *   closing 03-31: Cash 105,000 · AR 50,000 → current assets 155,000; AP 30,000 → current ratio 155/30 = 5.17,
 *   quick 5.17 (no inventory); equity = cumulative profit 160,000 − 35,000 = 125,000 → debt-to-equity 0.24;
 *   March revenue 20,000, rent 5,000 → gross margin 100.00 %, net margin 75.00 %;
 *   DSO: AR at 02-28 30,000 and 03-31 50,000, average 40,000 ÷ 20,000 × 31 days = 62.00 days; DPO undefined (no COGS).
 *   The loaded entries alone: Cash 5,000 · AR 10,000 · AP 0 → current ratio undefined, debt-to-equity 0.00,
 *   DSO (−10,000 + 10,000)/2 → 0.00 days.
 * A period starting on or before the cut-off (2026-02-01…) keeps the loaded entries.
 *
 * Charts: cash 105,000 (whole history; 5,000 loaded alone). The months stay the loaded entries: only 2026-03
 * (revenue 20,000, expenses 5,000), burn 5,000 → runway 105,000 ÷ 5,000 = 21 months (1 month loaded alone).
 *
 * Close comparison for 2026-03: balance sheet at 03-31 (assets 155,000, liabilities 30,000) and at 02-28
 * (Cash 110,000, AR 30,000 → assets 140,000; liabilities 30,000) equal the whole history; 2025-03-31 is before the
 * cut-off: loaded entries (0), as the whole history (0). March P&L (net income 15,000) equals the whole history;
 * February starts before the cut-off and keeps the loaded entries (net income 0; the whole history has −30,000).
 * With the list capped, those loaded-only columns are incomplete: P&L February and March 2025, balance sheet
 * 2025-03-31. Their changes are "Not comparable" and never a big move: Cash 105,000 vs 0 at 2025-03-31 (+105,000,
 * a big move against the $1,000 threshold when the column is taken at face value) is not flagged; Cash vs
 * 2026-02-28 (105,000 − 110,000 = −5,000, both columns served by the server) is still compared.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import FinancialRatiosReportView from '../components/reporting/FinancialRatiosReportView';
import FinancialChartsDashboard from '../components/finance/FinancialChartsDashboard';
import CloseComparisonPanel from '../components/ledger/CloseComparisonPanel';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { balanceEntries, periodEntries, type ServerOpening } from '../lib/serverBalances';
import { financialRatiosReport } from '../lib/financialRatiosReport';
import { computeChartsData } from '../lib/chartsData';
import { buildCloseComparison } from '../lib/closeComparison';
import { formatCurrency } from '../lib/utils';
import type { ChartAccount, Transaction } from '../types';

const ws = 'component-workspace';
const acc = (id: string, code: string, name: string, type: string, category: string) =>
  ({ id, workspaceId: ws, code, name, type, category, openingBalanceCents: 0 }) as ChartAccount;
const chart: ChartAccount[] = [
  acc('cash', '1000', 'Cash', 'asset', 'Cash'),
  acc('ar', '1200', 'Receivables', 'asset', 'Receivables'),
  acc('ap', '2000', 'Payables', 'liability', 'Payables'),
  acc('sales', '4000', 'Sales', 'income', 'Sales'),
  acc('rent', '6000', 'Rent', 'expense', 'Rent'),
];
const entry = (id: string, date: string, debit: string, credit: string, cents: number): Transaction => ({
  id, workspaceId: ws, uid: 'test-user', date, description: id, totalAmountCents: cents, currency: 'USD', status: 'completed', type: 'journal',
  lines: [{ accountId: debit, amountCents: cents }, { accountId: credit, amountCents: -cents }],
} as Transaction);
const all = [
  entry('E1', '2026-01-10', 'cash', 'sales', 100_000),
  entry('E2', '2026-01-20', 'ar', 'sales', 40_000),
  entry('E3', '2026-02-05', 'rent', 'ap', 30_000),
  entry('E4', '2026-02-05', 'cash', 'ar', 10_000),
  entry('E5', '2026-03-10', 'ar', 'sales', 20_000),
  entry('E6', '2026-03-20', 'rent', 'cash', 5_000),
];
const loaded = all.filter(tx => tx.id !== 'E1' && tx.id !== 'E2' && tx.id !== 'E3');
const opening: ServerOpening = { workspaceId: ws, asOf: '2026-02-05', accounts: { cash: 110_000, ar: 30_000, ap: -30_000, sales: -140_000, rent: 30_000 } };
const march = { startDate: '2026-03-01', endDate: '2026-03-31' };
const text = () => document.body.textContent || '';
const values = (rows: Array<{ id: string; value: number | null }>) => Object.fromEntries(rows.map(r => [r.id, r.value === null ? null : Number(r.value.toFixed(2))]));
const realFetch = globalThis.fetch;
globalThis.ResizeObserver = window.ResizeObserver;

describe('L-123 step 3d: period and trend screens read the server opening', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('accounts', 'transactions', 'journalEntries');
    useLedgerStore.setState({ accounts: chart, transactions: loaded, journalEntries: [], serverOpening: opening, truncatedCollections: { transactions: true } });
    globalThis.fetch = (async () => new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = realFetch;
    useLedgerStore.setState({ serverOpening: null, truncatedCollections: {} });
  });

  test('ratios: the server figures equal the whole-history client fold (5.17 / 0.24 / 62 days)', () => {
    const server = values(financialRatiosReport(chart, periodEntries(loaded, opening, march.startDate, ws), march));
    const whole = values(financialRatiosReport(chart, all, march));
    assert.deepEqual(server, whole);
    assert.deepEqual(server, { current: 5.17, quick: 5.17, 'debt-equity': 0.24, gross: 100, net: 75, dso: 62, dpo: null });
    assert.deepEqual(values(financialRatiosReport(chart, loaded, march)), { current: null, quick: null, 'debt-equity': 0, gross: 100, net: 75, dso: 0, dpo: null });
    assert.equal(periodEntries(loaded, opening, '2026-02-01', ws), loaded, 'a period starting before the cut-off keeps the loaded entries');
    assert.equal(periodEntries(loaded, opening, '2026-02-05', ws), loaded, 'nor one starting on it');
    assert.equal(periodEntries(loaded, opening, march.startDate, 'other-workspace'), loaded, 'nor for another workspace');
  });

  test('ratios screen: March shows 5.17 times and 62.00 days, with the source note', async () => {
    render(<FinancialRatiosReportView startDate="2026-03-01" endDate="2026-03-31" />);
    await waitFor(() => assert.ok(screen.getByTestId('ratios-balances-source')));
    assert.ok(text().includes('5.17 times') && text().includes('0.24 times') && text().includes('62.00 days'), text());
    assert.equal(screen.queryByText(/These ratios are provisional/), null);
    cleanup();
    render(<FinancialRatiosReportView startDate="2026-02-01" endDate="2026-03-31" />);
    await waitFor(() => assert.ok(screen.getByText(/These ratios are provisional/)));
    assert.equal(screen.queryByTestId('ratios-balances-source'), null);
  });

  test('charts: cash 105,000 as the whole history; months from the loaded entries; runway 21', () => {
    const server = computeChartsData(loaded, chart, 12, balanceEntries(loaded, opening, undefined, ws));
    assert.equal(server.totalCashCents, computeChartsData(all, chart, 12).totalCashCents);
    assert.equal(server.totalCashCents, 105_000);
    assert.deepEqual(server.months.map(m => [m.month, m.revenueCents, m.expenseCents]), [['2026-03', 20_000, 5_000]]);
    assert.equal(server.avgBurnCents, 5_000);
    assert.equal(server.runwayMonths, 21);
    const alone = computeChartsData(loaded, chart, 12);
    assert.equal(alone.totalCashCents, 5_000);
    assert.equal(alone.runwayMonths, 1);
  });

  test('charts screen shows the server cash total', async () => {
    render(<FinancialChartsDashboard />);
    await waitFor(() => assert.ok(screen.getByTestId('charts-balances-source')));
    assert.ok(text().includes(formatCurrency(105_000)) || text().includes(formatCurrency(105_000, 'USD')), 'cash 105,000');
  });

  test('close comparison 2026-03: balance sheets and March P&L equal the whole history; February stays loaded', () => {
    const server = buildCloseComparison({ month: '2026-03', accounts: chart, transactions: loaded, opening, workspaceId: ws });
    const whole = buildCloseComparison({ month: '2026-03', accounts: chart, transactions: all });
    const total = (r: typeof server, statement: 'balanceSheet' | 'profitAndLoss', id: string) => {
      const row = r[statement].rows.find(x => x.id === id);
      assert.ok(row, `${statement} ${id}`);
      return { current: row.current, previousMonth: row.previousMonth, previousYear: row.previousYear };
    };
    assert.deepEqual(total(server, 'balanceSheet', 'total:assets'), total(whole, 'balanceSheet', 'total:assets'));
    assert.deepEqual(total(server, 'balanceSheet', 'total:assets'), { current: 155_000, previousMonth: 140_000, previousYear: 0 });
    assert.deepEqual(total(server, 'balanceSheet', 'total:liabilities'), { current: 30_000, previousMonth: 30_000, previousYear: 0 });
    assert.equal(total(server, 'profitAndLoss', 'total:netIncome').current, total(whole, 'profitAndLoss', 'total:netIncome').current);
    assert.equal(total(server, 'profitAndLoss', 'total:netIncome').current, 15_000);
    assert.equal(total(server, 'profitAndLoss', 'total:netIncome').previousMonth, 0, 'February starts before the cut-off: loaded entries');
    assert.equal(total(whole, 'profitAndLoss', 'total:netIncome').previousMonth, -30_000);
  });

  test('close comparison with a capped list: February P&L and the year-ago columns are incomplete, their moves not flagged', () => {
    const capped = buildCloseComparison({ month: '2026-03', accounts: chart, transactions: loaded, opening, workspaceId: ws, capped: true });
    assert.deepEqual(capped.profitAndLoss.incomplete, { current: false, previousMonth: true, previousYear: true });
    assert.deepEqual(capped.balanceSheet.incomplete, { current: false, previousMonth: false, previousYear: true });
    const cash = capped.balanceSheet.rows.find(r => r.id === 'account:cash')!;
    assert.equal(cash.previousYear, 0);
    assert.equal(cash.comparablePreviousYear, false);
    assert.equal(cash.bigMoveYear, false);
    assert.equal(cash.percentPreviousYear, null);
    assert.equal(cash.comparablePreviousMonth, true);
    assert.equal(cash.changePreviousMonth, -5_000);
    for (const row of capped.profitAndLoss.rows) assert.ok(!row.comparablePreviousMonth && !row.bigMove && !row.bigMoveYear, row.id);
    assert.ok(capped.bigMoves.every(r => r.comparablePreviousMonth || r.comparablePreviousYear));
    assert.ok(!capped.bigMoves.some(r => r.id === 'account:cash' && r.bigMoveYear));
    // taken at face value (not capped) the year-ago cash move is a big move
    const uncapped = buildCloseComparison({ month: '2026-03', accounts: chart, transactions: loaded, opening, workspaceId: ws });
    assert.equal(uncapped.balanceSheet.rows.find(r => r.id === 'account:cash')!.bigMoveYear, true);
    assert.deepEqual(uncapped.profitAndLoss.incomplete, { current: false, previousMonth: false, previousYear: false });
    // capped without the server's answer: every column is incomplete
    const noServer = buildCloseComparison({ month: '2026-03', accounts: chart, transactions: loaded, capped: true });
    assert.deepEqual(noServer.balanceSheet.incomplete, { current: true, previousMonth: true, previousYear: true });
    assert.equal(noServer.bigMoves.length, 0);
  });

  test('close comparison panel labels the incomplete columns', async () => {
    render(<CloseComparisonPanel month="2026-03" currency="USD" />);
    await waitFor(() => assert.ok(screen.getByTestId('close-comparison-incomplete')));
    assert.ok(screen.getByTestId('close-comparison-incomplete-pl-previousMonth'));
    assert.ok(screen.getByTestId('close-comparison-incomplete-bs-previousYear'));
    assert.equal(screen.queryByTestId('close-comparison-incomplete-bs-previousMonth'), null);
    assert.ok(text().includes('Not comparable'));
    cleanup();
    useLedgerStore.setState({ truncatedCollections: {} });
    render(<CloseComparisonPanel month="2026-03" currency="USD" />);
    await waitFor(() => assert.ok(text().includes(formatCurrency(155_000, 'USD'))));
    assert.equal(screen.queryByTestId('close-comparison-incomplete'), null);
  });

  test('close comparison panel shows assets 155,000 at 2026-03-31', async () => {
    render(<CloseComparisonPanel month="2026-03" currency="USD" />);
    await waitFor(() => assert.ok(text().includes(formatCurrency(155_000, 'USD'))));
    assert.ok(text().includes(formatCurrency(140_000, 'USD')));
  });
});
