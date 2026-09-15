import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { calculateFilteredTotals, isPostable, lineAmount } from '../lib/txFilters.js';
import { Transaction, ChartAccount } from '../types.js';

describe('Filtered Totals & Inflow/Outflow Calculation Suite', () => {
  const mockAccounts: ChartAccount[] = [
    {
      id: 'acc_cash',
      uid: 'user_1',
      workspaceId: 'ws_1',
      name: 'Operating Checking',
      type: 'asset',
      category: 'Cash',
      currency: 'USD',
      code: '1000',
      isActive: true,
      balanceCents: 100000
    },
    {
      id: 'acc_rev',
      uid: 'user_1',
      workspaceId: 'ws_1',
      name: 'Consulting Revenue',
      type: 'revenue',
      category: 'Revenue',
      currency: 'USD',
      code: '4000',
      isActive: true,
      balanceCents: -50000
    },
    {
      id: 'acc_exp',
      uid: 'user_1',
      workspaceId: 'ws_1',
      name: 'Software Subscriptions',
      type: 'expense',
      category: 'Operating Expenses',
      currency: 'USD',
      code: '6000',
      isActive: true,
      balanceCents: 20000
    }
  ];

  test('excludes voided and draft transactions, and applies exchange rate for foreign transactions', () => {
    const transactions: Transaction[] = [
      // 1. Valid domestic income: $500.00 USD (50,000 cents)
      {
        id: 'tx_income_usd',
        uid: 'user_1',
        workspaceId: 'ws_1',
        date: '2026-09-01',
        description: 'Client Project Alpha Retainer',
        type: 'income',
        status: 'completed',
        totalAmountCents: 50000,
        currency: 'USD',
        createdAt: '2026-09-01',
        lines: [
          { accountId: 'acc_cash', accountName: 'Operating Checking', amountCents: 50000 },
          { accountId: 'acc_rev', accountName: 'Consulting Revenue', amountCents: -50000 }
        ]
      },
      // 2. Valid foreign expense: €200.00 EUR at 1.15 exchange rate -> $230.00 USD (23,000 cents)
      {
        id: 'tx_expense_eur',
        uid: 'user_1',
        workspaceId: 'ws_1',
        date: '2026-09-05',
        description: 'Server Hosting in Frankfurt (EUR)',
        type: 'expense',
        status: 'completed',
        totalAmountCents: 20000,
        currency: 'EUR',
        exchangeRate: 1.15,
        createdAt: '2026-09-05',
        lines: [
          { accountId: 'acc_exp', accountName: 'Software Subscriptions', amountCents: 20000, exchangeRate: 1.15 },
          { accountId: 'acc_cash', accountName: 'Operating Checking', amountCents: -20000, exchangeRate: 1.15 }
        ]
      },
      // 3. Voided income: $1,000.00 USD -> MUST BE EXCLUDED
      {
        id: 'tx_voided_income',
        uid: 'user_1',
        workspaceId: 'ws_1',
        date: '2026-09-10',
        description: 'Voided Consulting Invoice',
        type: 'income',
        status: 'void',
        totalAmountCents: 100000,
        currency: 'USD',
        createdAt: '2026-09-10',
        lines: [
          { accountId: 'acc_cash', accountName: 'Operating Checking', amountCents: 100000 },
          { accountId: 'acc_rev', accountName: 'Consulting Revenue', amountCents: -100000 }
        ]
      },
      // 4. Draft expense: $400.00 USD -> MUST BE EXCLUDED
      {
        id: 'tx_draft_expense',
        uid: 'user_1',
        workspaceId: 'ws_1',
        date: '2026-09-12',
        description: 'Unposted Draft Office Equipment',
        type: 'expense',
        status: 'draft',
        totalAmountCents: 40000,
        currency: 'USD',
        createdAt: '2026-09-12',
        lines: [
          { accountId: 'acc_exp', accountName: 'Software Subscriptions', amountCents: 40000 },
          { accountId: 'acc_cash', accountName: 'Operating Checking', amountCents: -40000 }
        ]
      }
    ];

    const result = calculateFilteredTotals(transactions, mockAccounts);

    // Assert: Inflow should ONLY include the posted USD income (50,000 cents = $500.00)
    assert.equal(result.inflowCents, 50000, 'inflowCents must match the posted USD income and exclude voided income');

    // Assert: Outflow should ONLY include the posted foreign expense converted by exchangeRate (20,000 * 1.15 = 23,000 cents)
    assert.equal(result.outflowCents, 23000, 'outflowCents must apply exchange rate and exclude draft expense');

    // Assert: Total postable records count must be exactly 2
    assert.equal(result.postableCount, 2, 'postableCount must exclude void and draft records');
  });

  test('lineAmount properly computes conversion with line-level or tx-level exchange rate', () => {
    const tx: Transaction = {
      id: 'tx_fx',
      uid: 'user_1',
      workspaceId: 'ws_1',
      date: '2026-09-01',
      description: 'FX test',
      type: 'expense',
      status: 'completed',
      totalAmountCents: 10000,
      currency: 'GBP',
      exchangeRate: 1.30,
      createdAt: '2026-09-01',
      lines: []
    };

    const lineWithoutRate = { accountId: 'acc_1', accountName: 'Test Account', amountCents: 10000 };
    assert.equal(lineAmount(lineWithoutRate, tx), 13000);

    const lineWithCustomRate = { accountId: 'acc_1', accountName: 'Test Account', amountCents: 10000, exchangeRate: 1.25 };
    assert.equal(lineAmount(lineWithCustomRate, tx), 12500);
  });

  test('isPostable correctly rejects draft, void, failed, and soft-deleted records', () => {
    assert.equal(isPostable({ id: '1', status: 'completed' } as any), true);
    assert.equal(isPostable({ id: '2', status: 'void' } as any), false);
    assert.equal(isPostable({ id: '3', status: 'draft' } as any), false);
    assert.equal(isPostable({ id: '4', status: 'failed' } as any), false);
    assert.equal(isPostable({ id: '5', status: 'completed', deletedAt: '2026-09-01' } as any), false);
  });
});
