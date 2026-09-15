import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import {
  computeProfitAndLoss,
  computeBalanceSheet,
  computeTrialBalance,
  computeCashFlow
} from '../server/reports/computeReports';

// Sample accounts and transactions for running pure computation tests
const sampleAccounts = [
  { id: 'acc_cash', name: 'Cash', type: 'asset', category: 'Cash', openingBalanceCents: 100000 },
  { id: 'acc_ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables', openingBalanceCents: 50000 },
  { id: 'acc_ap', name: 'Accounts Payable', type: 'liability', category: 'Payables', openingBalanceCents: 0 },
  { id: 'acc_equity', name: 'Owner Equity', type: 'equity', category: 'Equity', openingBalanceCents: 0 },
  { id: 'acc_rev', name: 'Sales Revenue', type: 'income', category: 'Revenue', openingBalanceCents: 0 },
  { id: 'acc_cogs', name: 'Cost of Goods Sold', type: 'cost_of_goods', category: 'COGS', openingBalanceCents: 0 },
  { id: 'acc_exp', name: 'Office Expense', type: 'expense', category: 'Operating Expenses', openingBalanceCents: 0 }
];

const sampleTransactions = [
  {
    id: 'tx_1',
    date: '2026-01-15',
    status: 'posted',
    posted: true,
    lines: [
      { accountId: 'acc_ar', amountCents: 150000 },
      { accountId: 'acc_rev', amountCents: -150000 }
    ]
  },
  {
    id: 'tx_2',
    date: '2026-01-20',
    status: 'posted',
    posted: true,
    lines: [
      { accountId: 'acc_cogs', amountCents: 40000 },
      { accountId: 'acc_ap', amountCents: -40000 }
    ]
  },
  {
    id: 'tx_3',
    date: '2026-01-25',
    status: 'posted',
    posted: true,
    lines: [
      { accountId: 'acc_exp', amountCents: 30000 },
      { accountId: 'acc_cash', amountCents: -30000 }
    ]
  }
];

describe('Report Contract Structural Guard Suite', () => {
  test('Balance Sheet contract: assets, liabilities, equity are flat Record<string, number> and totalClaims equals liabilities + equity + netIncome', () => {
    const fixture = computeBalanceSheet(sampleAccounts, sampleTransactions, '2026-12-31');

    // Assert assets, liabilities, equity are flat Record<string, number> where every value is a finite number
    for (const category of [fixture.assets, fixture.liabilities, fixture.equity]) {
      assert.equal(typeof category, 'object');
      assert.notEqual(category, null);
      for (const [id, val] of Object.entries(category)) {
        assert.equal(typeof id, 'string');
        assert.equal(typeof val, 'number');
        assert.ok(Number.isFinite(val), `Value for account ${id} must be a finite number, got ${val}`);
      }
    }

    // Assert total summary fields are finite numbers
    assert.ok(Number.isFinite(fixture.totalAssets));
    assert.ok(Number.isFinite(fixture.totalLiabilities));
    assert.ok(Number.isFinite(fixture.totalEquity));
    assert.ok(Number.isFinite(fixture.netIncome));
    assert.ok(Number.isFinite(fixture.totalClaims));

    // Assert balance sheet fundamental accounting identity relied upon by BalanceSheetView.tsx
    assert.equal(
      fixture.totalLiabilities + fixture.totalEquity + fixture.netIncome,
      fixture.totalClaims,
      'Balance Sheet Contract Violation: totalLiabilities + totalEquity + netIncome must equal totalClaims'
    );
  });

  test('Trial Balance contract: accounts is an Array with id, debit, credit, netSigned', () => {
    const fixture = computeTrialBalance(sampleAccounts, sampleTransactions);

    assert.ok(Array.isArray(fixture.accounts), 'Trial Balance accounts property must be an Array');
    for (const acc of fixture.accounts) {
      assert.equal(typeof acc.id, 'string');
      assert.ok(Number.isFinite(acc.debit));
      assert.ok(Number.isFinite(acc.credit));
      assert.ok(Number.isFinite(acc.netSigned));
    }
    assert.ok(Number.isFinite(fixture.totalDebit));
    assert.ok(Number.isFinite(fixture.totalCredit));
  });

  test('Trial Balance correctly handles credit-balance opening balances (Task 1 regression test)', () => {
    const tbAccounts = [
      { id: '1000', name: 'Cash', type: 'asset', category: 'Cash', openingBalanceCents: 50000 },
      { id: '1100', name: 'AR', type: 'asset', category: 'Receivables', openingBalanceCents: 0 },
      { id: '2000', name: 'AP', type: 'liability', category: 'Payables', openingBalanceCents: 0 },
      { id: '3000', name: 'Equity', type: 'equity', category: 'Equity', openingBalanceCents: -50000 },
      { id: '4000', name: 'Revenue', type: 'income', category: 'Revenue', openingBalanceCents: 0 },
      { id: '5000', name: 'Expense', type: 'expense', category: 'Operating Expenses', openingBalanceCents: 0 }
    ];

    const tbTransactions = [
      {
        id: 'tx_ar_rev',
        date: '2026-01-01',
        status: 'posted',
        posted: true,
        lines: [
          { accountId: '1100', amountCents: 100000 },
          { accountId: '4000', amountCents: -100000 }
        ]
      },
      {
        id: 'tx_cash_ar',
        date: '2026-01-02',
        status: 'posted',
        posted: true,
        lines: [
          { accountId: '1000', amountCents: 60000 },
          { accountId: '1100', amountCents: -60000 }
        ]
      },
      {
        id: 'tx_exp_ap',
        date: '2026-01-03',
        status: 'posted',
        posted: true,
        lines: [
          { accountId: '5000', amountCents: 30000 },
          { accountId: '2000', amountCents: -30000 }
        ]
      }
    ];

    const result = computeTrialBalance(tbAccounts, tbTransactions);
    assert.equal(result.isBalanced, true, 'Trial balance must be balanced');
    assert.equal(result.totalDebit, result.totalCredit, 'Total debit must equal total credit');
    assert.equal(result.totalDebit, 240000, 'Total debit should equal 240,000 cents');
    assert.equal(result.totalCredit, 240000, 'Total credit should equal 240,000 cents');
  });

  test('Cash Flow contract: buckets contain finite inflow, outflow, total, and (inflow - outflow) matches total', () => {
    const fixture = computeCashFlow(sampleAccounts, sampleTransactions);

    const buckets = [fixture.operating, fixture.investing, fixture.financing];
    for (const bucket of buckets) {
      assert.ok(Number.isFinite(bucket.inflow), 'Inflow must be a finite number');
      assert.ok(Number.isFinite(bucket.outflow), 'Outflow must be a finite number');
      assert.ok(Number.isFinite(bucket.total), 'Total must be a finite number');
      assert.ok(
        Math.abs((bucket.inflow - bucket.outflow) - bucket.total) <= 1,
        `Cash Flow Contract Violation: (inflow ${bucket.inflow} - outflow ${bucket.outflow}) does not equal total ${bucket.total}`
      );
    }
    assert.ok(Number.isFinite(fixture.netChange));
  });

  test('Profit & Loss contract: income, cogs, expense each have total + accounts object, grossProfit & netIncome are finite', () => {
    const fixture = computeProfitAndLoss(sampleAccounts, sampleTransactions);

    const categories = [fixture.income, fixture.cogs, fixture.expense];
    for (const category of categories) {
      assert.ok(Number.isFinite(category.total));
      assert.equal(typeof category.accounts, 'object');
      assert.notEqual(category.accounts, null);
      for (const [id, bal] of Object.entries(category.accounts as Record<string, any>)) {
        assert.equal(typeof id, 'string');
        const balance = typeof bal === 'number' ? bal : bal.balance;
        assert.ok(Number.isFinite(balance), `Balance for ${id} in P&L must be a finite number`);
      }
    }
    assert.ok(Number.isFinite(fixture.grossProfit));
    assert.ok(Number.isFinite(fixture.netIncome));
  });
});
