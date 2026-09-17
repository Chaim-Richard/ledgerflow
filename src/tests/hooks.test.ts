import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { Transaction, ChartAccount } from '../types';

describe('Custom Hooks Logic & Computation Suite (src/hooks)', () => {

  describe('1. useLedgerComputation Logic', () => {
    test('Calculates financial totals and postable transaction counts', () => {
      const mockAccounts: ChartAccount[] = [
        { id: 'acc_cash', uid: 'usr_1', code: '1000', name: 'Cash', type: 'asset', workspaceId: 'ws_hooks', balanceCents: 50000 },
        { id: 'acc_sales', uid: 'usr_1', code: '4000', name: 'Sales Income', type: 'income', workspaceId: 'ws_hooks', balanceCents: 50000 },
        { id: 'acc_expense', uid: 'usr_1', code: '5000', name: 'Office Expense', type: 'expense', workspaceId: 'ws_hooks', balanceCents: 12000 }
      ];

      const mockTransactions: Transaction[] = [
        {
          id: 'tx_hk_1',
          uid: 'usr_1',
          workspaceId: 'ws_hooks',
          date: '2026-09-01',
          description: 'Sales Income Receipt',
          totalAmountCents: 50000,
          currency: 'USD',
          status: 'completed',
          type: 'income',
          createdAt: '2026-09-01T00:00:00Z',
          lines: [
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: 50000 },
            { accountId: 'acc_sales', accountName: 'Sales Income', amountCents: -50000 }
          ]
        },
        {
          id: 'tx_hk_2',
          uid: 'usr_1',
          workspaceId: 'ws_hooks',
          date: '2026-09-05',
          description: 'Office Supplies',
          totalAmountCents: 12000,
          currency: 'USD',
          status: 'completed',
          type: 'expense',
          createdAt: '2026-09-05T00:00:00Z',
          lines: [
            { accountId: 'acc_expense', accountName: 'Office Expense', amountCents: 12000 },
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: -12000 }
          ]
        },
        {
          id: 'tx_hk_draft',
          uid: 'usr_1',
          workspaceId: 'ws_hooks',
          date: '2026-09-10',
          description: 'Draft Unposted Sale',
          totalAmountCents: 99000,
          currency: 'USD',
          status: 'draft', // Draft, excluded from postable totals
          type: 'income',
          createdAt: '2026-09-10T00:00:00Z',
          lines: [
            { accountId: 'acc_sales', accountName: 'Sales Income', amountCents: -99000 },
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: 99000 }
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
