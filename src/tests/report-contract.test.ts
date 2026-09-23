import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import {
  computeProfitAndLoss,
  computeBalanceSheet,
  computeTrialBalance,
  computeCashFlow,
  computeTaxLiability,
  computeStatement
} from '../server/reports/computeReports';

import {
  makeChartAccount,
  makeTransaction,
  makeInvoice,
  makeBill,
  makePayment,
  makeCustomer
} from './fixtures.js';

// Sample accounts and transactions for running pure computation tests
const sampleAccounts = [
  makeChartAccount({ id: 'acc_cash', name: 'Cash', type: 'asset', category: 'Cash', openingBalanceCents: 100000 }),
  makeChartAccount({ id: 'acc_ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables', openingBalanceCents: 50000 }),
  makeChartAccount({ id: 'acc_ap', name: 'Accounts Payable', type: 'liability', category: 'Payables', openingBalanceCents: 0 }),
  makeChartAccount({ id: 'acc_equity', name: 'Owner Equity', type: 'equity', category: 'Equity', openingBalanceCents: 0 }),
  makeChartAccount({ id: 'acc_rev', name: 'Sales Revenue', type: 'income', category: 'Revenue', openingBalanceCents: 0 }),
  makeChartAccount({ id: 'acc_cogs', name: 'Cost of Goods Sold', type: 'cost_of_goods', category: 'COGS', openingBalanceCents: 0 }),
  makeChartAccount({ id: 'acc_exp', name: 'Office Expense', type: 'expense', category: 'Operating Expenses', openingBalanceCents: 0 })
];

const sampleTransactions = [
  makeTransaction({
    id: 'tx_1',
    date: '2026-01-15',
    status: 'posted',
    posted: true,
    lines: [
      { accountId: 'acc_ar', amountCents: 150000 },
      { accountId: 'acc_rev', amountCents: -150000 }
    ]
  }),
  makeTransaction({
    id: 'tx_2',
    date: '2026-01-20',
    status: 'posted',
    posted: true,
    lines: [
      { accountId: 'acc_cogs', amountCents: 40000 },
      { accountId: 'acc_ap', amountCents: -40000 }
    ]
  }),
  makeTransaction({
    id: 'tx_3',
    date: '2026-01-25',
    status: 'posted',
    posted: true,
    lines: [
      { accountId: 'acc_exp', amountCents: 30000 },
      { accountId: 'acc_cash', amountCents: -30000 }
    ]
  })
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
      makeChartAccount({ id: '1000', name: 'Cash', type: 'asset', category: 'Cash', openingBalanceCents: 50000 }),
      makeChartAccount({ id: '1100', name: 'AR', type: 'asset', category: 'Receivables', openingBalanceCents: 0 }),
      makeChartAccount({ id: '2000', name: 'AP', type: 'liability', category: 'Payables', openingBalanceCents: 0 }),
      makeChartAccount({ id: '3000', name: 'Equity', type: 'equity', category: 'Equity', openingBalanceCents: -50000 }),
      makeChartAccount({ id: '4000', name: 'Revenue', type: 'income', category: 'Revenue', openingBalanceCents: 0 }),
      makeChartAccount({ id: '5000', name: 'Expense', type: 'expense', category: 'Operating Expenses', openingBalanceCents: 0 })
    ];

    const tbTransactions = [
      makeTransaction({
        id: 'tx_ar_rev',
        date: '2026-01-01',
        status: 'posted',
        posted: true,
        lines: [
          { accountId: '1100', amountCents: 100000 },
          { accountId: '4000', amountCents: -100000 }
        ]
      }),
      makeTransaction({
        id: 'tx_cash_ar',
        date: '2026-01-02',
        status: 'posted',
        posted: true,
        lines: [
          { accountId: '1000', amountCents: 60000 },
          { accountId: '1100', amountCents: -60000 }
        ]
      }),
      makeTransaction({
        id: 'tx_exp_ap',
        date: '2026-01-03',
        status: 'posted',
        posted: true,
        lines: [
          { accountId: '5000', amountCents: 30000 },
          { accountId: '2000', amountCents: -30000 }
        ]
      })
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

  test('Tax Report Task 1 & 2: tax-exclusive $1000 @10% -> tax=10000', () => {
    const invoices = [
      makeInvoice({
        id: 'inv_excl',
        date: '2026-02-01',
        status: 'sent',
        amountCents: 100000,
        taxRate: 10,
        taxInclusive: false
      })
    ];
    const report = computeTaxLiability(invoices, [], '2026-01-01', '2026-12-31');
    assert.equal(report.taxCollectedCents, 10000, 'Tax collected on $1000 @ 10% tax-exclusive must be exactly 10000 cents');
    assert.equal(report.taxableSalesCents, 100000, 'Taxable base for tax-exclusive invoice must equal total net sales ($1000)');
  });

  test('Tax Report Task 1 & 2: tax-inclusive $1100 @10% -> tax=10000', () => {
    const invoices = [
      makeInvoice({
        id: 'inv_incl',
        date: '2026-02-01',
        status: 'approved',
        amountCents: 110000,
        taxRate: 10,
        taxInclusive: true
      })
    ];
    const report = computeTaxLiability(invoices, [], '2026-01-01', '2026-12-31');
    assert.equal(report.taxCollectedCents, 10000, 'Tax collected on $1100 @ 10% tax-inclusive must be exactly 10000 cents');
    assert.equal(report.taxableSalesCents, 100000, 'Taxable base for tax-inclusive invoice must back out tax ($1000)');
  });

  test('Tax Report Task 1 & 2: bill $1000 @10% tax-exclusive -> taxPaid=10000', () => {
    const bills = [
      makeBill({
        id: 'bill_excl',
        date: '2026-02-01',
        status: 'pending',
        amountCents: 100000,
        taxRate: 10,
        taxInclusive: false
      })
    ];
    const report = computeTaxLiability([], bills, '2026-01-01', '2026-12-31');
    assert.equal(report.taxPaidCents, 10000, 'Tax paid on $1000 @ 10% tax-exclusive must be exactly 10000 cents');
    assert.equal(report.taxablePurchasesCents, 100000, 'Taxable purchases for tax-exclusive bill must equal total net ($1000)');
  });

  test('Tax Report Task 2: draft invoice and draft bill are excluded from tax owed (tax=0, taxPaid=0)', () => {
    const invoices = [
      makeInvoice({
        id: 'inv_draft',
        date: '2026-02-01',
        status: 'draft',
        amountCents: 100000,
        taxRate: 10,
        taxInclusive: false
      })
    ];
    const bills = [
      makeBill({
        id: 'bill_draft',
        date: '2026-02-01',
        status: 'draft',
        amountCents: 100000,
        taxRate: 10,
        taxInclusive: false
      })
    ];
    const report = computeTaxLiability(invoices, bills, '2026-01-01', '2026-12-31');
    assert.equal(report.taxCollectedCents, 0, 'Draft invoice must not count towards taxCollectedCents');
    assert.equal(report.taxPaidCents, 0, 'Draft bill must not count towards taxPaidCents');
  });

  test('Tax Report Task 3: eight-status bill verification table for input tax', () => {
    const statuses: Array<{ status: any; want: number }> = [
      { status: 'pending', want: 10000 },
      { status: 'unpaid', want: 10000 },
      { status: 'approved', want: 10000 },
      { status: 'paid', want: 10000 },
      { status: 'partially_paid', want: 10000 },
      { status: 'overdue', want: 10000 },
      { status: 'draft', want: 0 },
      { status: 'void', want: 0 }
    ];

    for (const { status, want } of statuses) {
      const bills = [
        makeBill({
          id: `bill_${status}`,
          date: '2026-02-01',
          status,
          amountCents: 100000,
          taxRate: 10,
          taxInclusive: false
        })
      ];
      const report = computeTaxLiability([], bills, '2026-01-01', '2026-12-31');
      assert.equal(
        report.taxPaidCents,
        want,
        `bill '${status}' -> taxPaid=${report.taxPaidCents} want=${want}`
      );
    }
  });

  test('Balance Sheet Task 3: orphaned account reference detection', () => {
    const accounts = [
      makeChartAccount({ id: 'acc_asset', name: 'Asset', type: 'asset', category: 'Cash', openingBalanceCents: 0 })
    ];
    const transactions = [
      makeTransaction({
        id: 'tx_with_orphan',
        date: '2026-01-01',
        status: 'posted',
        posted: true,
        lines: [
          { accountId: 'acc_asset', amountCents: 40000 },
          { accountId: 'acc_deleted_or_missing', amountCents: -40000 }
        ]
      })
    ];
    const result = computeBalanceSheet(accounts, transactions, '2026-12-31');
    assert.ok(Array.isArray(result.orphanedLines), 'orphanedLines must be an array');
    assert.equal(result.orphanedLines.length, 1, 'Should detect 1 orphaned line');
    assert.equal(result.orphanedLines[0].accountId, 'acc_deleted_or_missing');
    assert.equal(result.isBalanced, false, 'Should flag unbalanced due to missing account');
  });

  test('Statement report excludes draft invoices, draft bills, and unposted payments', () => {
    const contact = makeCustomer({ id: 'cust_100', name: 'Acme Corp' });
    const invoices = [
      makeInvoice({ id: 'inv_draft', customerId: 'cust_100', date: '2026-02-01', status: 'draft', amountCents: 100000 }),
      makeInvoice({ id: 'inv_sent', customerId: 'cust_100', date: '2026-02-05', status: 'sent', amountCents: 50000 })
    ];
    const bills: any[] = [];
    const payments = [
      makePayment({ id: 'pay_draft', contactId: 'cust_100', date: '2026-02-10', direction: 'received', status: 'draft', amountCents: 20000 }),
      makePayment({ id: 'pay_posted', contactId: 'cust_100', date: '2026-02-12', direction: 'received', status: 'posted', amountCents: 10000 })
    ];

    const statement = computeStatement(contact, invoices, bills, payments, '2026-01-01', '2026-12-31', 'customer');

    // Only inv_sent (50000) and pay_posted (-10000) should appear
    assert.equal(statement.entries.length, 2, 'Statement should have exactly 2 activity entries (excluding drafts)');
    assert.equal(statement.entries[0].id, 'inv_sent');
    assert.equal(statement.entries[1].id, 'pay_posted');
    assert.equal(statement.endingBalanceCents, 40000, 'Ending balance should be 50000 - 10000 = 40000 cents');
  });
});
