import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionValidator } from '../kernel/validation/TransactionValidator';
import { getTrustedAppUrl } from '../server/utils/urlHelper';
import { calculateNetIncome, getAbsoluteTotal } from '../lib/txFilters';
import { ChartAccount, Transaction } from '../types';

describe('Checkpoint 2 Regression & Security Hardening Suite (N1 - N18)', () => {

  test('N1 & N14: TransactionValidator enforces period lock and user ownership', async () => {
    const wsData = { lockDate: '2026-03-31' };
    const context = {
      workspaceId: 'ws-test-100',
      user: { uid: 'user-alice' },
      wsData
    };

    // 1. Locked date transaction should throw
    const lockedTx = {
      id: 'tx-locked-1',
      date: '2026-03-15',
      description: 'Historical adjustment',
      lines: [
        { accountId: 'acc-cash', amountCents: 1000 },
        { accountId: 'acc-rev', amountCents: -1000 }
      ]
    };

    await assert.rejects(
      async () => {
        await TransactionValidator.validateAndPrepare(lockedTx, context);
      },
      /Period Locked/
    );

    // 2. Open period transaction succeeds and enforces user UID
    const openTx = {
      id: 'tx-open-1',
      date: '2026-04-15',
      description: 'Current sales',
      uid: 'spoofed-uid-attacker', // should be overridden
      lines: [
        { accountId: 'acc-cash', amountCents: 5000 },
        { accountId: 'acc-rev', amountCents: -5000 }
      ]
    };

    const mockAccountsMap = new Map([
      ['acc-cash', { id: 'acc-cash', name: 'Cash', workspaceId: 'ws-test-100', type: 'asset' }],
      ['acc-rev', { id: 'acc-rev', name: 'Sales Revenue', workspaceId: 'ws-test-100', type: 'revenue' }]
    ]);

    const validated = await TransactionValidator.validateAndPrepare(openTx, {
      ...context,
      accountsMap: mockAccountsMap
    });

    assert.equal(validated.uid, 'user-alice', 'User UID must be strictly enforced');
    assert.equal(validated.workspaceId, 'ws-test-100', 'Workspace ID must be enforced');
    assert.equal(validated.totalAmountCents, 5000, 'Total amount must be absolute 5000 cents');
  });

  test('N9: TransactionValidator strictly rejects ghost simulation IDs for persistent writes', async () => {
    const context = {
      workspaceId: 'ws-test-100',
      user: { uid: 'user-alice' },
      wsData: { lockDate: null },
      accountsMap: new Map([
        ['acc-cash', { id: 'acc-cash', name: 'Cash', workspaceId: 'ws-test-100' }],
        ['acc-rev', { id: 'acc-rev', name: 'Sales', workspaceId: 'ws-test-100' }]
      ])
    };

    const ghostTx = {
      id: 'ghost-sim-12345',
      date: '2026-05-01',
      description: 'Simulated cashflow item',
      type: 'standard',
      lines: [
        { accountId: 'acc-cash', amountCents: 1000 },
        { accountId: 'acc-rev', amountCents: -1000 }
      ]
    };

    await assert.rejects(
      async () => {
        await TransactionValidator.validateAndPrepare(ghostTx, context);
      },
      /ghost-/
    );
  });

  test('N15 & #88: getAbsoluteTotal correctly computes absolute transaction total with FX support', () => {
    const multiLineTx = {
      id: 'tx-multi-1',
      workspaceId: 'ws-1',
      uid: 'user-1',
      date: '2026-06-01',
      description: 'Multi-line invoice',
      status: 'completed' as const,
      currency: 'USD',
      totalAmountCents: 0,
      lines: [
        { accountId: 'acc-ar', accountName: 'Receivables', amountCents: 12000 },
        { accountId: 'acc-tax', accountName: 'Tax Payable', amountCents: -2000 },
        { accountId: 'acc-rev', accountName: 'Revenue', amountCents: -10000 }
      ]
    } as Transaction;

    const total = getAbsoluteTotal(multiLineTx);
    assert.equal(total, 12000, 'Absolute total of $120 debit leg is 12000 cents');
  });

  test('N6: getTrustedAppUrl rejects open shared cloud domains and protects against Host header poisoning', () => {
    // 1. With APP_URL configured
    process.env.APP_URL = 'https://app.customcorp.com';
    assert.equal(getTrustedAppUrl(), 'https://app.customcorp.com');
    delete process.env.APP_URL;

    // 2. Mock request with malicious host header
    const maliciousReq = {
      get: (header: string) => {
        if (header.toLowerCase() === 'host') return 'evil-phishing.run.app';
        return null;
      },
      protocol: 'https'
    };

    const trusted = getTrustedAppUrl(maliciousReq as unknown as Parameters<typeof getTrustedAppUrl>[0]);
    assert.notEqual(trusted, 'https://evil-phishing.run.app', 'Must not trust arbitrary run.app hosts');
  });

  test('N7 & N8: calculateNetIncome correctly accounts for COGS and revenue with isPostable filtering', () => {
    const accounts = [
      { id: 'acc-rev', uid: 'user-1', code: '4000', name: 'Software Sales', type: 'revenue' as const, balanceCents: 0, workspaceId: 'ws-1' },
      { id: 'acc-cogs', uid: 'user-1', code: '5000', name: 'Hosting Costs', type: 'cost_of_goods' as const, balanceCents: 0, workspaceId: 'ws-1' },
      { id: 'acc-exp', uid: 'user-1', code: '6000', name: 'Office Supplies', type: 'expense' as const, balanceCents: 0, workspaceId: 'ws-1' },
      { id: 'acc-cash', uid: 'user-1', code: '1000', name: 'Checking Account', type: 'asset' as const, balanceCents: 0, workspaceId: 'ws-1' }
    ] as ChartAccount[];

    const transactions = [
      // 1. Revenue of $10,000 (credit)
      {
        id: 'tx-1',
        workspaceId: 'ws-1',
        uid: 'user-1',
        date: '2026-06-01',
        description: 'Client sale',
        status: 'completed' as const,
        lines: [
          { accountId: 'acc-cash', accountName: 'Checking Account', amountCents: 1000000 },
          { accountId: 'acc-rev', accountName: 'Software Sales', amountCents: -1000000 }
        ]
      },
      // 2. COGS of $2,000 (debit)
      {
        id: 'tx-2',
        workspaceId: 'ws-1',
        uid: 'user-1',
        date: '2026-06-02',
        description: 'Server costs',
        status: 'completed' as const,
        lines: [
          { accountId: 'acc-cogs', accountName: 'Hosting Costs', amountCents: 200000 },
          { accountId: 'acc-cash', accountName: 'Checking Account', amountCents: -200000 }
        ]
      },
      // 3. OPEX of $1,000 (debit)
      {
        id: 'tx-3',
        workspaceId: 'ws-1',
        uid: 'user-1',
        date: '2026-06-03',
        description: 'Supplies',
        status: 'completed' as const,
        lines: [
          { accountId: 'acc-exp', accountName: 'Office Supplies', amountCents: 100000 },
          { accountId: 'acc-cash', accountName: 'Checking Account', amountCents: -100000 }
        ]
      },
      // 4. Voided transaction (should be ignored by isPostable)
      {
        id: 'tx-void',
        workspaceId: 'ws-1',
        uid: 'user-1',
        date: '2026-06-04',
        description: 'Cancelled deal',
        status: 'void' as const,
        lines: [
          { accountId: 'acc-cash', accountName: 'Checking Account', amountCents: 5000000 },
          { accountId: 'acc-rev', accountName: 'Software Sales', amountCents: -5000000 }
        ]
      }
    ] as Transaction[];

    const result = calculateNetIncome(transactions, accounts);
    // Net Income = Revenue ($10,000) - COGS ($2,000) - OPEX ($1,000) = $7,000 = 700000 cents
    assert.equal(result.income, 1000000, 'Income must equal $10,000.00');
    assert.equal(result.cogs, 200000, 'COGS must equal $2,000.00');
    assert.equal(result.expense, 100000, 'Expense must equal $1,000.00');
    assert.equal(result.grossProfit, 800000, 'Gross profit must equal $8,000.00');
    assert.equal(result.netIncome, 700000, 'Net income must equal $7,000.00');
  });

});
