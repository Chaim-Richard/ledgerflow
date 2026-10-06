/**
 * R-09 close comparison (AI #3, A-1): the month being closed beside the previous month and the
 * same month last year, with the big-move flag. Every number below is worked out by hand.
 *
 * The fixture books (whole cents, all postable except the draft):
 *   Sales:  2026-09 150,000 · 2026-08 40,000 · 2025-09 10,000
 *   Rent:   2026-09  20,000 · 2026-08 10,000 · 2025-09  5,000
 *   Cash:   2026-09  20,000 · 2026-08 −10,000 · 2025-09 0   (no opening balance)
 *   A/R:    2026-09 150,000 · 2026-08  50,000 · 2025-09 10,000
 *   A/P:    2026-09   5,000 · 2026-08   5,000 · 2025-09  5,000
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOSE_COMPARISON_PERCENT,
  CLOSE_COMPARISON_THRESHOLD_CENTS,
  buildCloseComparison,
  isBigMove,
  thresholdFromInput,
} from '../lib/closeComparison';
import type { CloseComparisonResult, CloseComparisonRow } from '../lib/closeComparison';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { ChartAccount, Transaction } from '../types';

const cash = makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' });
const ar = makeChartAccount({ id: 'ar', code: '1100', name: 'Accounts receivable', type: 'asset', category: 'Receivables' });
const ap = makeChartAccount({ id: 'ap', code: '2000', name: 'Accounts payable', type: 'liability', category: 'Payables' });
const capital = makeChartAccount({ id: 'capital', code: '3000', name: 'Capital', type: 'equity', category: 'Equity' });
const sales = makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'revenue', category: 'Revenue' });
const rent = makeChartAccount({ id: 'rent', code: '5000', name: 'Rent', type: 'expense', category: 'Expenses' });
const utilities = makeChartAccount({ id: 'utilities', code: '5100', name: 'Utilities', type: 'expense', category: 'Expenses' });

const accounts: ChartAccount[] = [cash, ar, ap, capital, sales, rent, utilities];

const line = (accountId: string, amountCents: number) => ({ id: `${accountId}-${amountCents}`, accountId, amountCents });
const tx = (id: string, date: string, lines: Array<{ id: string; accountId: string; amountCents: number }>, status: Transaction['status'] = 'completed'): Transaction =>
  makeTransaction({ id, date, status, lines: lines as Transaction['lines'] });

const transactions: Transaction[] = [
  // September 2026: sale on credit, cash sale, rent paid.
  tx('t1', '2026-09-10', [line('ar', 100_000), line('sales', -100_000)]),
  tx('t3', '2026-09-20', [line('cash', 50_000), line('sales', -50_000)]),
  tx('t2', '2026-09-15', [line('rent', 20_000), line('cash', -20_000)]),
  // August 2026.
  tx('t4', '2026-08-10', [line('ar', 40_000), line('sales', -40_000)]),
  tx('t5', '2026-08-15', [line('rent', 10_000), line('cash', -10_000)]),
  // September 2025: rent was owed, not paid, so it sits in accounts payable.
  tx('t6', '2025-09-10', [line('ar', 10_000), line('sales', -10_000)]),
  tx('t7', '2025-09-15', [line('rent', 5_000), line('ap', -5_000)]),
  // A draft must never move a figure.
  tx('t8', '2026-09-30', [line('ar', 999_900), line('sales', -999_900)], 'draft'),
];

const build = (overrides: Partial<Parameters<typeof buildCloseComparison>[0]> = {}): CloseComparisonResult =>
  buildCloseComparison({ month: '2026-09', accounts, transactions, ...overrides });

const values = (comparisonRow: CloseComparisonRow) => [comparisonRow.current, comparisonRow.previousMonth, comparisonRow.previousYear];

const row = (result: CloseComparisonResult, statement: 'profitAndLoss' | 'balanceSheet', id: string): CloseComparisonRow => {
  const found = result[statement].rows.find(r => r.id === id);
  assert.ok(found, `${statement} should have a ${id} row`);
  return found;
};

describe('close comparison: periods and rows', () => {
  test('the three periods are this month, the month before and the same month last year', () => {
    const result = build();
    assert.equal(result.previousMonth, '2026-08');
    assert.equal(result.previousYearMonth, '2025-09');
    assert.deepEqual(
      { start: result.periods.current.startDate, end: result.periods.current.endDate },
      { start: '2026-09-01', end: '2026-09-30' },
    );
    assert.equal(result.periods.previousMonth.endDate, '2026-08-31');
    assert.equal(result.periods.previousYear.endDate, '2025-09-30');
    const january = build({ month: '2026-01' });
    assert.equal(january.previousMonth, '2025-12');
    assert.equal(january.previousYearMonth, '2025-01');
  });

  test('February is a real February: 2024-03 looks back at the 29th, 2027-03 at the 28th', () => {
    assert.equal(build({ month: '2024-03' }).periods.previousMonth.endDate, '2024-02-29');
    assert.equal(build({ month: '2027-03' }).periods.previousMonth.endDate, '2027-02-28');
  });

  test('the P&L shows this month’s activity, the balance sheet a closing snapshot', () => {
    const result = build();
    const salesRow = row(result, 'profitAndLoss', 'account:sales');
    assert.deepEqual([salesRow.current, salesRow.previousMonth, salesRow.previousYear], [150_000, 40_000, 10_000]);
    assert.equal(row(result, 'profitAndLoss', 'total:income').current, 150_000);
    assert.equal(row(result, 'profitAndLoss', 'total:cogs').current, 0);
    assert.equal(row(result, 'profitAndLoss', 'total:grossProfit').current, 150_000);
    assert.equal(row(result, 'profitAndLoss', 'account:rent').current, 20_000);
    assert.equal(row(result, 'profitAndLoss', 'total:expense').current, 20_000);
    // P&L net income is this month's activity (150,000 − 20,000), not the year to date.
    assert.deepEqual(values(row(result, 'profitAndLoss', 'total:netIncome')), [130_000, 30_000, 5_000]);
    // The balance sheet closes at each month end and carries earlier months forward.
    assert.deepEqual(values(row(result, 'balanceSheet', 'account:cash')), [20_000, -10_000, 0]);
    assert.deepEqual(values(row(result, 'balanceSheet', 'account:ar')), [150_000, 50_000, 10_000]);
    assert.equal(row(result, 'balanceSheet', 'total:assets').current, 170_000);
    assert.equal(row(result, 'balanceSheet', 'total:liabilities').current, 5_000);
    // Current earnings are the year-to-date earnings at that month end, counted once.
    assert.equal(row(result, 'balanceSheet', 'total:retainedEarnings').current, 165_000);
    assert.equal(row(result, 'balanceSheet', 'total:equity').current, 165_000);
    assert.equal(row(result, 'balanceSheet', 'total:claims').current, 170_000);
    assert.equal(
      row(result, 'balanceSheet', 'total:claims').current,
      row(result, 'balanceSheet', 'total:assets').current,
      'assets equal liabilities plus equity when the books balance',
    );
  });

  test('drafts never move a figure, and quiet accounts stay out of the tables', () => {
    const result = build();
    assert.equal(row(result, 'profitAndLoss', 'account:sales').current, 150_000, 'the draft is ignored');
    assert.equal(result.profitAndLoss.rows.some(r => r.id === 'account:utilities'), false);
    assert.equal(result.balanceSheet.rows.some(r => r.id === 'account:capital'), false, 'no activity in any period');
    assert.equal(result.profitAndLoss.rows.some(r => r.id === 'total:netIncome'), true, 'totals always stay');
  });
});

describe('close comparison: big moves', () => {
  test('the rule is money and percent together, and a move from zero is measured by money', () => {
    assert.equal(isBigMove(20_000, 100_000, 20_000, CLOSE_COMPARISON_PERCENT), true, 'exactly 20% and exactly the amount counts');
    assert.equal(isBigMove(20_000, 100_000, 20_001, 20), false, 'below the amount does not count');
    assert.equal(isBigMove(19_999, 100_000, 10_000, 20), false, 'below the percent does not count');
    assert.equal(isBigMove(-50_000, 100_000, 10_000, 20), true, 'a fall of 50% is a move');
    assert.equal(isBigMove(50_000, 0, 10_000, 20), true, 'from zero: the amount decides');
    assert.equal(isBigMove(0, 100_000, 1, 20), false, 'no change is no move');
  });

  test('with the default $1,000 the September sale and the totals are flagged against both periods', () => {
    const result = build();
    assert.equal(result.thresholdCents, CLOSE_COMPARISON_THRESHOLD_CENTS);
    assert.equal(result.percent, CLOSE_COMPARISON_PERCENT);
    const salesRow = row(result, 'profitAndLoss', 'account:sales');
    // +110,000 vs 40,000 (275%) and +140,000 vs 10,000 (1,400%).
    assert.equal(salesRow.changePreviousMonth, 110_000);
    assert.equal(salesRow.percentPreviousMonth, 275);
    assert.equal(salesRow.changePreviousYear, 140_000);
    assert.equal(salesRow.percentPreviousYear, 1_400);
    assert.equal(salesRow.bigMove, true);
    assert.equal(salesRow.bigMoveYear, true);
    // Rent moved +10,000: the same 100% jump, but under the amount, so no flag.
    const rentRow = row(result, 'profitAndLoss', 'account:rent');
    assert.equal(rentRow.percentPreviousMonth, 100);
    assert.equal(rentRow.bigMove, false);
    assert.equal(rentRow.bigMoveYear, false);
    // Biggest change across either comparison first: the balance sheet totals move 160,000
    // against last year, the sale 110,000 against last month, and net income 125,000 last year.
    assert.deepEqual(result.bigMoves.map(r => r.label), [
      'Total assets', 'Current earnings', 'Total equity', 'Total liabilities and equity',
      'Sales', 'Total income', 'Gross profit', 'Accounts receivable', 'Net income',
    ]);
    assert.equal(row(result, 'balanceSheet', 'total:assets').bigMove, true, '+130,000 vs 40,000');
  });

  test('an amount higher than any move flags nothing', () => {
    const quiet = build({ thresholdCents: 200_000 });
    assert.deepEqual(quiet.bigMoves, []);
  });

  test('a move from a zero base is measured by the amount alone', () => {
    // Cash is 0 in September 2025 and 20,000 in September 2026: there is no percentage of nothing.
    const result = build({ thresholdCents: 10_000, percent: 100 });
    const cashRow = row(result, 'balanceSheet', 'account:cash');
    assert.equal(cashRow.previousYear, 0);
    assert.equal(cashRow.percentPreviousYear, null);
    assert.equal(cashRow.bigMoveYear, true);
    // A higher ask hides the same move entirely.
    const quiet = build({ thresholdCents: 25_000, percent: 100 });
    assert.equal(row(quiet, 'balanceSheet', 'account:cash').bigMoveYear, false);
  });

  test('the amount typed is parsed as whole cents, and nonsense is refused', () => {
    assert.equal(thresholdFromInput('1,000'), 100_000);
    assert.equal(thresholdFromInput('1000.50'), 100_050);
    assert.equal(thresholdFromInput('250'), 25_000);
    assert.equal(thresholdFromInput('0'), null);
    assert.equal(thresholdFromInput(''), null);
    assert.equal(thresholdFromInput('-5'), null);
    assert.equal(thresholdFromInput('abc'), null);
    assert.equal(thresholdFromInput('1,00'), null);
  });
});
