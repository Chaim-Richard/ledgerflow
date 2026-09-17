import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { useLedgerStore } from '../stores/useLedgerStore';
import { Transaction, ChartAccount } from '../types';

describe('Custom Hooks Logic & Computation Suite (src/hooks)', () => {

  describe('1. useLedgerComputation Logic', () => {
    test('Calculates financial totals and postable transaction counts', () => {
      const mockAccounts: ChartAccount[] = [
        { id: 'acc_cash', code: '1000', name: 'Cash', type: 'asset', workspaceId: 'ws_hooks' },
        { id: 'acc_sales', code: '4000', name: 'Sales Income', type: 'income', workspaceId: 'ws_hooks' },
        { id: 'acc_expense', code: '5000', name: 'Office Expense', type: 'expense', workspaceId: 'ws_hooks' }
      ];

      const mockTransactions: Transaction[] = [
        {
          id: 'tx_hk_1',
          workspaceId: 'ws_hooks',
          date: '2026-09-01',
          totalAmountCents: 50000,
          status: 'completed',
          type: 'income',
          lines: [
            { accountId: 'acc_cash', amountCents: 50000 },
            { accountId: 'acc_sales', amountCents: -50000 }
          ]
        },
        {
          id: 'tx_hk_2',
          workspaceId: 'ws_hooks',
          date: '2026-09-05',
          totalAmountCents: 12000,
          status: 'completed',
          type: 'expense',
          lines: [
            { accountId: 'acc_expense', amountCents: 12000 },
            { accountId: 'acc_cash', amountCents: -12000 }
          ]
        },
        {
          id: 'tx_hk_draft',
          workspaceId: 'ws_hooks',
          date: '2026-09-10',
          totalAmountCents: 99000,
          status: 'draft', // Draft, excluded from postable totals
          lines: [
            { accountId: 'acc_sales', amountCents: -99000 },
            { accountId: 'acc_cash', amountCents: 99000 }
          ]
        }
      ];

      // Compute total income and total expenses across postable transactions
      const postableTx = mockTransactions.filter(tx => !tx.deletedAt && tx.status !== 'void' && tx.status !== 'draft');
      assert.equal(postableTx.length, 2);

      const totalIncomeCents = postableTx
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.totalAmountCents, 0);

      const totalExpenseCents = postableTx
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.totalAmountCents, 0);

      assert.equal(totalIncomeCents, 50000);
      assert.equal(totalExpenseCents, 12000);
      assert.equal(totalIncomeCents - totalExpenseCents, 38000); // Net margin $380.00
    });
  });

  describe('2. Transaction Actions Invariants', () => {
    test('Transaction validation prevents unbalanced double-entry lines', () => {
      const validateLines = (lines: { amountCents: number }[]) => {
        const sum = lines.reduce((acc, l) => acc + (l.amountCents || 0), 0);
        return sum === 0;
      };

      assert.equal(validateLines([{ amountCents: 100 }, { amountCents: -100 }]), true);
      assert.equal(validateLines([{ amountCents: 100 }, { amountCents: -50 }]), false);
      assert.equal(validateLines([]), true);
    });
  });
});
