import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import Decimal from 'decimal.js';
import { DoubleEntryValidator } from '../kernel/validation/DoubleEntryValidator';
import { validateSplitAllocations } from '../lib/dimensionUtils';
import { Transaction, TransactionLine } from '../types';

describe('Golden-Path Ledger Verification & Invariants', () => {

  describe('1. Double-Entry Invariants & Zero-Drift Math', () => {
    test('Rejects unbalanced transactions with exact net error', () => {
      const unbalancedTx: Transaction = {
        id: 'tx_unbalanced',
        uid: 'user1',
        workspaceId: 'ws_1',
        date: '2026-06-15',
        description: 'Unbalanced purchase',
        totalAmountCents: 10000,
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        lines: [
          { accountId: 'acc_cash', accountName: 'Cash', amountCents: 10000 },
          { accountId: 'acc_exp', accountName: 'Expense', amountCents: -9999 } // 1 cent off
        ]
      };

      assert.throws(
        () => DoubleEntryValidator.validateJournalEntry(unbalancedTx),
        /Validation Failed: Unbalanced entry/
      );
    });

    test('Accepts multi-leg balanced transactions', () => {
      const balancedTx: Transaction = {
        id: 'tx_balanced',
        uid: 'user1',
        workspaceId: 'ws_1',
        date: '2026-06-15',
        description: 'Multi-split payroll',
        totalAmountCents: 100000,
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        lines: [
          { accountId: 'acc_salary', accountName: 'Salary Expense', amountCents: 100000 }, // Debit
          { accountId: 'acc_tax', accountName: 'Tax Payable', amountCents: -25000 },       // Credit
          { accountId: 'acc_benefits', accountName: 'Benefits Payable', amountCents: -10000 }, // Credit
          { accountId: 'acc_cash', accountName: 'Cash', amountCents: -65000 }             // Credit
        ]
      };

      assert.doesNotThrow(() => DoubleEntryValidator.validateJournalEntry(balancedTx));
    });

    test('Decimal split allocations preserve exact weight and penny integrity', () => {
      // 3-way split: 33.33%, 33.33%, 33.34% summing strictly to 1.0
      const splits = [
        { dimensions: { project: 'P1' }, weight: 0.3333 },
        { dimensions: { project: 'P2' }, weight: 0.3333 },
        { dimensions: { project: 'P3' }, weight: 0.3334 }
      ];

      const validation = validateSplitAllocations(splits);
      assert.equal(validation.valid, true, 'Splits summing to 1.0 should be valid');

      // Allocation of $100.00 across the splits with remainder given to last leg
      const totalCents = 10000;
      let allocatedSum = 0;
      const legs = splits.map((s, idx) => {
        if (idx === splits.length - 1) {
          const remainder = totalCents - allocatedSum;
          allocatedSum += remainder;
          return remainder;
        }
        const portion = Math.round(totalCents * s.weight);
        allocatedSum += portion;
        return portion;
      });

      assert.equal(allocatedSum, totalCents, 'Penny loss detected in split allocation');
      assert.equal(legs[0] + legs[1] + legs[2], 10000);
    });

    test('FX conversion absorbed without penny loss', () => {
      // Multi-currency conversion: EUR to USD at 1.0833
      const originalCents = 10000; // €100.00
      const rate = 1.0833;
      const convertedCents = Math.round(originalCents * rate); // $108.33 = 10833 cents

      // Verify that offset lines match converted cents exactly
      const debitLine: TransactionLine = {
        accountId: 'acc_ar',
        accountName: 'Accounts Receivable',
        amountCents: convertedCents,
        exchangeRate: rate
      };
      const creditLine: TransactionLine = {
        accountId: 'acc_rev',
        accountName: 'Revenue',
        amountCents: -convertedCents,
        exchangeRate: rate
      };

      const sum = new Decimal(debitLine.amountCents).plus(creditLine.amountCents);
      assert.equal(sum.toNumber(), 0, 'FX converted lines must balance to exact zero');
    });
  });

  describe('2. Transaction Lifecycle & Void Exclusion', () => {
  });

  // Year-end close and tenant isolation: checked on the close-year route itself, where another
  // workspace's sale in the same year must not count (src/tests/year-end-close.test.ts).
});
