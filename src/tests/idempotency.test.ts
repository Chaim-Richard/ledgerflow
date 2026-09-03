import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { ClosingEntryEngine } from '../kernel/ledger/ClosingEntryEngine';
import { ChartAccount, Transaction } from '../types';

describe('Closing Entry Idempotency', () => {
  test('Should not double-count if run twice on the same date', () => {
    const accounts: ChartAccount[] = [
      { id: 'acc_cash', uid: 'u1', workspaceId: 'ws_1', code: '1010', name: 'Cash', type: 'asset', balanceCents: 1000 },
      { id: 'acc_rev', uid: 'u1', workspaceId: 'ws_1', code: '4010', name: 'Revenue', type: 'income', balanceCents: 0 },
      { id: 'acc_re', uid: 'u1', workspaceId: 'ws_1', code: '3000', name: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings', balanceCents: 0 }
    ];

    const txs: Transaction[] = [
      {
        id: 'tx_1', uid: 'u1', workspaceId: 'ws_1', date: '2026-12-15', description: 'Sale',
        totalAmountCents: 1000, currency: 'USD', status: 'completed', type: 'actual', createdAt: '2026-12-15T00:00:00Z',
        lines: [
          { accountId: 'acc_cash', accountName: 'Cash', amountCents: 1000 },
          { accountId: 'acc_rev', accountName: 'Revenue', amountCents: -1000 }
        ]
      }
    ];

    const result1 = ClosingEntryEngine.generateClosingJournalEntry({
      workspaceId: 'ws_1', uid: 'u1', closingDate: '2026-12-31', accounts, transactions: txs
    });

    const txsWithClose = [...txs, result1.closingTransaction];

    const result2 = ClosingEntryEngine.generateClosingJournalEntry({
      workspaceId: 'ws_1', uid: 'u1', closingDate: '2026-12-31', accounts, transactions: txsWithClose
    });

    assert.equal(result2.netIncomeCents, 0, 'Second run on same date should yield 0 net income since it is already closed');
  });
});
