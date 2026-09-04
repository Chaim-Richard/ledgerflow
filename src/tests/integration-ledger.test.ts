import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine';
import { ChartAccount, Transaction } from '../types';

describe('End-to-End Accounting Engine Integration', () => {
  const sampleAccounts: ChartAccount[] = [
    { id: 'acc_1010', uid: 'usr_1', workspaceId: 'default', code: '1010', name: 'Operating Cash', type: 'asset', category: 'Bank', openingBalanceCents: 100000, balanceCents: 100000 },
    { id: 'acc_1200', uid: 'usr_1', workspaceId: 'default', code: '1200', name: 'Accounts Receivable', type: 'asset', category: 'Receivable', openingBalanceCents: 0, balanceCents: 0 },
    { id: 'acc_2010', uid: 'usr_1', workspaceId: 'default', code: '2010', name: 'Accounts Payable', type: 'liability', category: 'Payable', openingBalanceCents: 0, balanceCents: 0 },
    { id: 'acc_3010', uid: 'usr_1', workspaceId: 'default', code: '3010', name: 'Owner Capital', type: 'equity', category: 'Equity', openingBalanceCents: 100000, balanceCents: 100000 },
    { id: 'acc_4010', uid: 'usr_1', workspaceId: 'default', code: '4010', name: 'Consulting Services', type: 'income', category: 'Revenue', openingBalanceCents: 0, balanceCents: 0 },
    { id: 'acc_5010', uid: 'usr_1', workspaceId: 'default', code: '5010', name: 'Software Subscriptions', type: 'expense', category: 'Operating', openingBalanceCents: 0, balanceCents: 0 }
  ];

  it('correctly calculates computed accounts and verifies double-entry balance', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        uid: 'usr_1',
        workspaceId: 'default',
        date: '2026-01-15',
        createdAt: '2026-01-15T00:00:00Z',
        description: 'Client Invoice Payment Received',
        totalAmountCents: 50000, // $500
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        lines: [
          { accountId: 'acc_1010', accountName: 'Operating Cash', amountCents: 50000 }, // +$500 Debit to Cash
          { accountId: 'acc_4010', accountName: 'Consulting Services', amountCents: -50000 } // -$500 Credit to Revenue
        ]
      },
      {
        id: 'tx_2',
        uid: 'usr_1',
        workspaceId: 'default',
        date: '2026-01-20',
        createdAt: '2026-01-20T00:00:00Z',
        description: 'SaaS Subscription Fee',
        totalAmountCents: 10000, // $100
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        lines: [
          { accountId: 'acc_5010', accountName: 'Software Subscriptions', amountCents: 10000 }, // +$100 Debit to Expense
          { accountId: 'acc_1010', accountName: 'Operating Cash', amountCents: -10000 } // -$100 Credit to Cash
        ]
      }
    ];

    const computed = LedgerEngine.recomputeAccountBalances(sampleAccounts, transactions, []);

    // Verify Cash account
    const cashAcc = computed.find(a => a.id === 'acc_1010');
    assert.ok(cashAcc);
    // Opening $1,000 + $500 - $100 = $1,400 (140,000 cents)
    assert.equal(cashAcc?.balanceCents, 140000);

    // Verify Income account
    const revenueAcc = computed.find(a => a.id === 'acc_4010');
    assert.equal(revenueAcc?.balanceCents, 50000); // $500 natural positive balance

    // Verify Expense account
    const expenseAcc = computed.find(a => a.id === 'acc_5010');
    assert.equal(expenseAcc?.balanceCents, 10000); // $100 natural positive balance

    // Verify Double-Entry Zero Sum Verification
    const isZeroSum = LedgerEngine.verifyZeroSum(computed);
    assert.equal(isZeroSum, true);
  });

  it('correctly ties Balance Sheet Assets to Liabilities + Equity + Net Income', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        uid: 'usr_1',
        workspaceId: 'default',
        date: '2026-02-01',
        createdAt: '2026-02-01T00:00:00Z',
        description: 'Consulting Retainer',
        totalAmountCents: 200000, // $2,000
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        lines: [
          { accountId: 'acc_1010', accountName: 'Operating Cash', amountCents: 200000 },
          { accountId: 'acc_4010', accountName: 'Consulting Services', amountCents: -200000 }
        ]
      },
      {
        id: 'tx_2',
        uid: 'usr_1',
        workspaceId: 'default',
        date: '2026-02-05',
        createdAt: '2026-02-05T00:00:00Z',
        description: 'Cloud Server Hosting',
        totalAmountCents: 30000, // $300
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        lines: [
          { accountId: 'acc_5010', accountName: 'Software Subscriptions', amountCents: 30000 },
          { accountId: 'acc_1010', accountName: 'Operating Cash', amountCents: -30000 }
        ]
      }
    ];

    const computed = LedgerEngine.recomputeAccountBalances(sampleAccounts, transactions, []);

    // Calculate Balance Sheet components directly
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    computed.forEach(acc => {
      const bal = acc.balanceCents || 0;
      if (acc.type === 'asset') totalAssets += bal;
      else if (acc.type === 'liability') totalLiabilities += bal;
      else if (acc.type === 'equity') totalEquity += bal;
      else if (acc.type === 'income' || acc.type === 'revenue') totalIncome += bal;
      else if (acc.type === 'expense' || acc.type === 'cost_of_goods') totalExpenses += bal;
    });

    const netIncome = totalIncome - totalExpenses; // $2,000 - $300 = $1,700
    const totalClaims = totalLiabilities + totalEquity + netIncome;

    assert.equal(netIncome, 170000);
    assert.equal(totalAssets, 270000); // Cash: Opening $1,000 + $2,000 - $300 = $2,700
    assert.equal(totalEquity, 100000); // Owner Capital: $1,000
    assert.equal(totalClaims, 270000);
    assert.equal(totalAssets, totalClaims); // Assets = Liabilities + Equity + Net Income
  });
});
