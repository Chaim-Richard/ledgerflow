import test from 'node:test';
import assert from 'node:assert/strict';
import { TransactionTemplates, type LineAccountWeight } from '../kernel/templates/TransactionTemplates';
import { getLineDimension } from '../lib/dimensionUtils';
import { computeBalanceSheet } from '../server/reports/computeReports';
import { profitByLabel } from '../server/reports/byLabel';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Transaction } from '../types';

const accounts = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'ar', code: '1100', name: 'Accounts receivable', type: 'asset', category: 'Receivables' }),
  makeChartAccount({ id: 'tax', code: '2200', name: 'Net tax payable', type: 'liability', category: 'Payables' }),
  makeChartAccount({ id: 'ap', code: '2100', name: 'Accounts payable', type: 'liability', category: 'Payables' }),
  makeChartAccount({ id: 'revenue', code: '4000', name: 'Rental income', type: 'income', category: 'Revenue' }),
  makeChartAccount({ id: 'repairs', code: '6100', name: 'Repairs', type: 'expense', category: 'Expenses' }),
];

const cash = { id: 'cash', name: 'Cash' };
const ar = { id: 'ar', name: 'Accounts receivable' };
const ap = { id: 'ap', name: 'Accounts payable' };
const revenue = { id: 'revenue', name: 'Rental income' };
const repairs = { id: 'repairs', name: 'Repairs' };
const tax = { id: 'tax', name: 'Net tax payable' };
const dimension = 'property';
const shares: LineAccountWeight[] = [
  { account: revenue, weightCents: 10_000, dimensions: { [dimension]: 'A' } },
  { account: revenue, weightCents: 17_000, dimensions: { [dimension]: 'B' } },
];
const billShares: LineAccountWeight[] = [
  { account: repairs, weightCents: 5_000, dimensions: { [dimension]: 'A' } },
  { account: repairs, weightCents: 8_500, dimensions: { [dimension]: 'B' } },
];
const tx = (id: string, date: string, lines: Transaction['lines']) => makeTransaction({ id, date, description: id, lines });

const ledger: Transaction[] = [
  tx('invoice-1', '2026-01-05', TransactionTemplates.buildInvoiceLines({
    invoiceNumber: 'INV-1', customerName: 'Tenant', totalCents: 30_000, taxCents: 3_000,
    arAccount: ar, revenueAccount: revenue, taxAccount: tax, lineAccounts: shares,
  })),
  tx('receipt-1', '2026-01-12', TransactionTemplates.buildPaymentLines({
    documentNumber: 'INV-1', entityName: 'Tenant', amountCents: 20_000, cashAccount: cash,
    offsetAccount: ar, isReceipt: true, lineAccounts: shares,
  })),
  tx('bill-1', '2026-01-15', TransactionTemplates.buildBillLines({
    billNumber: 'BILL-1', vendorName: 'Repair vendor', totalCents: 15_000, taxCents: 1_500,
    apAccount: ap, expenseAccount: repairs, taxAccount: tax, lineAccounts: billShares,
  })),
  tx('vendor-payment-1', '2026-01-22', TransactionTemplates.buildPaymentLines({
    documentNumber: 'BILL-1', entityName: 'Repair vendor', amountCents: 6_000, cashAccount: cash,
    offsetAccount: ap, isReceipt: false, lineAccounts: billShares,
  })),
];

function ledgerForProperty(value: string): Transaction[] {
  return ledger.map(entry => ({
    ...entry,
    id: `${entry.id}-${value}`,
    lines: (entry.lines || []).filter(line => getLineDimension(line, entry, dimension) === value),
  }));
}

test('A-210 W5 worked figures: labelled invoice, bill, receipts and payments reconcile by property', () => {
  // Hand-worked P&L, in cents. Revenue is before tax; repairs are the bill's pretax amount.
  const pAndL = profitByLabel(accounts, ledger, dimension, '2026-01-01', '2026-01-31');
  assert.deepEqual(pAndL.columns.map(({ value, income, expense, netIncome }) => [value, income, expense, netIncome]), [
    ['A', 10_000, 5_000, 5_000],
    ['B', 17_000, 8_500, 8_500],
  ]);
  assert.deepEqual([pAndL.total.income, pAndL.total.expense, pAndL.total.netIncome], [27_000, 13_500, 13_500]);

  // Each posted document/payment must be a balanced, independently attributable entry for each property.
  for (const entry of ledger) {
    assert.equal((entry.lines || []).reduce((sum, line) => sum + line.amountCents, 0), 0, `${entry.id} balances in total`);
    for (const property of ['A', 'B']) {
      const slice = (entry.lines || []).filter(line => getLineDimension(line, entry, dimension) === property);
      assert.ok(slice.length > 0, `${entry.id} has ${property} lines`);
      assert.equal(slice.reduce((sum, line) => sum + line.amountCents, 0), 0, `${entry.id} balances for property ${property}`);
    }
  }

  // Hand-worked balance sheet at 31 Jan: all balances below are positive normal balances.
  // A: cash 5,185 + A/R 3,704 = A/P 3,334 + net tax 555 + retained earnings 5,000 = 8,889.
  // B: cash 8,815 + A/R 6,296 = A/P 5,666 + net tax 945 + retained earnings 8,500 = 15,111.
  const expected = {
    A: { cash: 5_185, ar: 3_704, ap: 3_334, tax: 555, netIncome: 5_000, assets: 8_889, claims: 8_889 },
    B: { cash: 8_815, ar: 6_296, ap: 5_666, tax: 945, netIncome: 8_500, assets: 15_111, claims: 15_111 },
  } as const;
  for (const property of ['A', 'B'] as const) {
    const sheet = computeBalanceSheet(accounts, ledgerForProperty(property), '2026-01-31');
    const figure = expected[property];
    assert.deepEqual({
      cash: sheet.assets.cash,
      ar: sheet.assets.ar,
      ap: sheet.liabilities.ap,
      tax: sheet.liabilities.tax,
      netIncome: sheet.netIncome,
      assets: sheet.totalAssets,
      claims: sheet.totalClaims,
      isBalanced: sheet.isBalanced,
    }, { ...figure, isBalanced: true }, `property ${property} balance sheet equals the independent hand-worked figures`);
    assert.equal(sheet.orphanedLines.length, 0);
  }
});
