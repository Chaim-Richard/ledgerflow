import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSampleBusinessYear,
  summarizeSampleBusinessYear,
  verifySampleBusinessYear,
} from '../lib/sampleBusinessYear';

describe('A-148: 12-month realistic small-business fixture generator', () => {
  test('generates all 12 months deterministically with strictly balanced double-entry and stock history', () => {
    const first = buildSampleBusinessYear({ year: 2026, scale: 1 });
    const second = buildSampleBusinessYear({ year: 2026, scale: 1 });

    assert.deepEqual(first.transactions, second.transactions, 'generator is deterministic');
    assert.deepEqual(first.invoices, second.invoices);
    assert.deepEqual(first.stockMoves, second.stockMoves);

    const check = verifySampleBusinessYear(first);
    assert.equal(check.ok, true, `unexpected fixture verification errors: ${check.failures.join('; ')}`);
    assert.equal(check.monthsCovered, 12);
    assert.ok(check.balancedTransactions >= 1000, `expected >= 1,000 balanced entries, got ${check.balancedTransactions}`);

    const monthly = summarizeSampleBusinessYear(first);
    assert.equal(monthly.length, 12);
    for (const row of monthly) {
      assert.ok(row.invoices >= 25, `${row.month} has invoices`);
      assert.ok(row.bills >= 15, `${row.month} has supplier bills`);
      assert.ok(row.purchaseOrders >= 6, `${row.month} has purchase orders`);
      assert.ok(row.payments >= 25, `${row.month} has payments`);
      assert.ok(row.stockMoves >= 20, `${row.month} has stock moves`);
      assert.ok(row.transactions >= 60, `${row.month} has balanced ledger entries`);
    }
  });

  test('supports scaled stress volumes cleanly without breaking accounting invariants', () => {
    const scaled = buildSampleBusinessYear({ year: 2026, scale: 2 });
    const check = verifySampleBusinessYear(scaled);
    assert.equal(check.ok, true, check.failures.join('; '));
    assert.equal(check.monthsCovered, 12);
    assert.ok(scaled.invoices.length >= 700);
    assert.ok(scaled.transactions.length >= 2400);
  });
});
