/** The Charts screen's numbers (L-155): cents, signed lines, reversals cancel, nothing invented. */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeChartsData } from '../lib/chartsData';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { TransactionLine } from '../types';

const bank = makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Cash' });
const savings = makeChartAccount({ id: 'sav', name: 'Savings', type: 'asset', category: 'Bank' });
const sales = makeChartAccount({ id: 'sales', name: 'Sales', type: 'income', category: 'Revenue' });
const rent = makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense', category: 'Expense' });
const soft = makeChartAccount({ id: 'soft', name: 'Software', type: 'expense', category: 'Expense' });
const accounts = [bank, savings, sales, rent, soft];
const line = (accountId: string, amountCents: number): TransactionLine => ({ accountId, accountName: accountId, amountCents });
const tx = (id: string, date: string, lines: TransactionLine[], extra = {}) => makeTransaction({ id, date, lines, totalAmountCents: Math.abs(lines[0].amountCents), ...extra });

describe('computeChartsData', () => {
  test('revenue, expenses, cash and runway in cents', () => {
    const txs = [
      tx('s1', '2026-01-10', [line('bank', 500000), line('sales', -500000)]),   // sale 5,000.00
      tx('r1', '2026-01-15', [line('rent', 120000), line('bank', -120000)]),    // rent 1,200.00
      tx('s2', '2026-02-10', [line('bank', 300000), line('sales', -300000)]),
      tx('r2', '2026-02-15', [line('rent', 120000), line('bank', -120000)]),
      tx('w1', '2026-02-20', [line('soft', 30000), line('bank', -30000)]),     // software 300.00
      tx('t1', '2026-02-21', [line('sav', 100000), line('bank', -100000)]),    // transfer to savings
    ];
    const d = computeChartsData(txs, accounts, 6);
    assert.deepEqual(d.months, [
      { month: '2026-01', revenueCents: 500000, expenseCents: 120000, profitCents: 380000 },
      { month: '2026-02', revenueCents: 300000, expenseCents: 150000, profitCents: 150000 },
    ]);
    assert.equal(d.totalCashCents, 500000 - 120000 + 300000 - 120000 - 30000);   // 5,300.00 in both accounts
    assert.deepEqual(d.cash, [{ id: 'bank', name: 'Checking', cents: 430000 }, { id: 'sav', name: 'Savings', cents: 100000 }]);
    assert.deepEqual(d.expenses, [{ name: 'Rent', cents: 240000 }, { name: 'Software', cents: 30000 }]);
    assert.equal(d.avgBurnCents, 135000);
    assert.equal(d.runwayMonths, 3.9);                                            // 5,300 / 1,350
  });

  test('a reversed entry cancels instead of counting twice; drafts and voids are left out', () => {
    const txs = [
      tx('r1', '2026-03-01', [line('rent', 120000), line('bank', -120000)]),
      tx('r1-rev', '2026-03-02', [line('rent', -120000), line('bank', 120000)], { metadata: { isReversal: true, reversesTxId: 'r1' } }),
      tx('d1', '2026-03-03', [line('rent', 99900), line('bank', -99900)], { status: 'draft' }),
      tx('v1', '2026-03-04', [line('rent', 88800), line('bank', -88800)], { status: 'void' }),
    ];
    const d = computeChartsData(txs, accounts, 6);
    assert.deepEqual(d.months, [{ month: '2026-03', revenueCents: 0, expenseCents: 0, profitCents: 0 }]);
    assert.deepEqual(d.expenses, []);
  });

  test('foreign-currency lines count once, in the base currency', () => {
    const txs = [tx('e1', '2026-04-01', [line('sales', -10000), line('bank', 10000)], { exchangeRate: 1.1, currency: 'EUR' })];
    const d = computeChartsData(txs, accounts, 6);
    assert.equal(d.months[0].revenueCents, 11000);
    assert.equal(d.totalCashCents, 11000);
  });

  test('no data: empty lists, zero cash, no runway (nothing made up)', () => {
    const d = computeChartsData([], accounts, 12);
    assert.deepEqual(d, { months: [], cash: [], expenses: [], totalCashCents: 0, avgBurnCents: 0, runwayMonths: null });
  });

  test('only the last 6 or 12 months with activity are shown', () => {
    const txs = Array.from({ length: 14 }, (_, i) => {
      const month = `2025-${String((i % 12) + 1).padStart(2, '0')}`.replace(/^2025-(\d+)$/, (_m, mm) => (i >= 12 ? `2026-${mm}` : `2025-${mm}`));
      return tx(`x${i}`, `${month}-05`, [line('rent', 1000), line('bank', -1000)]);
    });
    assert.equal(computeChartsData(txs, accounts, 6).months.length, 6);
    assert.equal(computeChartsData(txs, accounts, 12).months.at(-1)?.month, '2026-02');
  });
});
