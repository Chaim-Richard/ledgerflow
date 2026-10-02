/**
 * Expense by category, income by source, top items, monthly averages and tags (src/lib/reportGenerators.ts).
 * L-157: a reversed entry and its reversal cancel, and a refund reduces the total, as in the P&L;
 * before, the negative half was skipped and reversed expenses still showed in full.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExpenseByCategory, computeIncomeBySource, computeMonthlyAverages, computeTagReport, computeTopExpensesAndIncome } from '../lib/reportGenerators';
import { accounts, ledger } from './helpers/reportLedger';

describe('report generators (L-157)', () => {
  test('expense by category nets reversals and refunds', () => {
    const rows = computeExpenseByCategory(accounts, ledger);
    assert.deepEqual(rows.map(r => [r.category, r.totalAmountCents, r.transactionCount]), [
      ['Occupancy', 200000, 2],
      ['Software', 40000, 2],            // 500 - 100 refund; the reversed 400 is gone
    ]);
    assert.equal(Math.round(rows[0].percentage), 83);
  });

  test('income by source nets credits back to the customer', () => {
    const rows = computeIncomeBySource(accounts, ledger);
    assert.deepEqual(rows.map(r => [r.source, r.totalAmountCents]), [['Acme', 450000], ['Bob', 100000]]);
  });

  test('top items leave out a reversed entry and its reversal', () => {
    const { topExpenses, topIncome } = computeTopExpensesAndIncome(accounts, ledger);
    assert.deepEqual(topExpenses.map(e => [e.id, e.amountCents]), [['rent-jan-rent', 100000], ['rent-feb-rent', 100000], ['soft-feb-soft', 50000]]);
    assert.deepEqual(topIncome.map(e => e.amountCents), [300000, 200000, 100000]);
  });

  test('monthly averages are net per month', () => {
    const s = computeMonthlyAverages(accounts, ledger, 2026);
    assert.equal(s.monthlyData[0].expenseCents, 100000);
    assert.equal(s.monthlyData[1].expenseCents, 100000 + 50000 - 10000);   // Feb: rent, software, refund
    assert.equal(s.monthlyData[1].incomeCents, 200000 + 100000 - 50000);
    assert.equal(s.monthlyAverageExpenseCents, 120000);
    assert.equal(s.monthlyAverageIncomeCents, 275000);
  });

  test('tags are net, and the reversed pair adds nothing', () => {
    const office = computeTagReport(accounts, ledger).find(t => t.tag === 'office')!;
    assert.equal(office.expenseCents, 200000);
    assert.equal(office.incomeCents, 200000);
    assert.equal(office.netCents, 0);
    assert.equal(office.count, 6);                                          // 3 entries x 2 lines, not the reversed pair
  });
});
