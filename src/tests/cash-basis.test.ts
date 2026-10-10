/**
 * Cash basis (N-08), checked by hand: a partly paid invoice counts in part on the payment's date, a
 * bill paid the next month counts then, an unpaid invoice not at all; a document marked paid counts on
 * its own date; credit notes and write-offs on receivables are left out and counted; journals and bank
 * entries count as entered; tax and wages "payable" are not trade payables; whole cents.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cashBasisEntries, shareOfLines, type CashBasisPayment } from '../server/reports/cashBasis';
import { computeProfitAndLoss } from '../server/reports/computeReports';
import { makeChartAccount } from './fixtures';
import type { Transaction } from '../types';

const account = (id: string, code: string, name: string, type: string, category = '') => makeChartAccount({ id, code, name, type, category } as never);
const accounts = [
  account('bank', '1010', 'Checking', 'asset', 'Bank'),
  account('ar', '1200', 'Accounts Receivable', 'asset', 'Receivables'),
  account('ap', '2000', 'Accounts Payable', 'liability', 'Payables'),
  account('vat', '2200', 'VAT payable', 'liability'),
  account('wages-due', '2300', 'Wages payable', 'liability'),
  account('sales', '4000', 'Sales', 'income'),
  account('rent', '6000', 'Rent', 'expense'),
  account('wages', '6100', 'Wages', 'expense'),
  account('fees', '6200', 'Bank charges', 'expense'),
];
const entry = (id: string, date: string, lines: Array<[string, number]>, metadata: Record<string, unknown> = {}) =>
  ({ id, workspaceId: 'w', date, description: id, status: 'completed', type: 'actual', metadata, lines: lines.map(([accountId, amountCents]) => ({ accountId, amountCents })) }) as unknown as Transaction;

const transactions: Transaction[] = [
  // invoice 1: 1,000.00 + 170.00 VAT, paid 585.00 (half) in March
  entry('inv1', '2026-02-20', [['ar', 117000], ['sales', -100000], ['vat', -17000]], { type: 'invoice-accrual', invoiceId: 'i1' }),
  entry('pay1', '2026-03-10', [['bank', 58500], ['ar', -58500]], { type: 'payment-posting', paymentId: 'p1' }),
  // invoice 2: 300.00, never paid
  entry('inv2', '2026-03-05', [['ar', 30000], ['sales', -30000]], { type: 'invoice-accrual', invoiceId: 'i2' }),
  // bill: rent 400.00 in March, paid in April
  entry('bill1', '2026-03-31', [['rent', 40000], ['ap', -40000]], { type: 'bill-accrual', billId: 'b1' }),
  entry('pay2', '2026-04-02', [['ap', 40000], ['bank', -40000]], { type: 'payment-posting', paymentId: 'p2' }),
  // invoice 3 marked paid on the spot: cash in the posting
  entry('inv3', '2026-03-15', [['bank', 20000], ['sales', -20000]], { type: 'invoice-accrual', invoiceId: 'i3' }),
  // a credit note on receivables, without cash: left out
  entry('cn1', '2026-03-20', [['sales', 5000], ['ar', -5000]], { type: 'credit-note-issuance' }),
  // a bank charge and a wages accrual (not a trade payable): as entered
  entry('fee', '2026-03-28', [['fees', 1500], ['bank', -1500]]),
  entry('wages-accrual', '2026-03-31', [['wages', 80000], ['wages-due', -80000]]),
];
const payments: CashBasisPayment[] = [
  { id: 'p1', paymentDate: '2026-03-10', allocations: [{ documentId: 'i1', documentType: 'invoice', amountCents: 58500 }] },
  { id: 'p2', paymentDate: '2026-04-02', allocations: [{ documentId: 'b1', documentType: 'bill', amountCents: 40000 }] },
  { id: 'p-void', status: 'void', paymentDate: '2026-03-11', allocations: [{ documentId: 'i2', documentType: 'invoice', amountCents: 30000 }] },
];

test('March and April on cash basis, by hand', () => {
  const { entries, leftOut } = cashBasisEntries(accounts, transactions, payments);
  const march = computeProfitAndLoss(accounts, entries, '2026-03-01', '2026-03-31');
  // income: half of invoice 1 (500.00) + invoice 3 (200.00); not invoice 2, not the credit note
  assert.equal(march.income.total, 70000);
  // costs: the bank charge and the wages accrual; the rent bill is paid in April
  assert.deepEqual([march.expense.accounts.rent.balance, march.expense.accounts.fees.balance, march.expense.accounts.wages.balance], [0, 1500, 80000]);
  const april = computeProfitAndLoss(accounts, entries, '2026-04-01', '2026-04-30');
  assert.deepEqual([april.income.total, april.expense.accounts.rent.balance], [0, 40000]);
  assert.equal(computeProfitAndLoss(accounts, entries, '2026-02-01', '2026-02-28').income.total, 0, 'nothing when invoice 1 was issued');
  assert.equal(leftOut, 1, 'the credit note');
  // the same books on accrual basis, for contrast
  assert.equal(computeProfitAndLoss(accounts, transactions, '2026-03-01', '2026-03-31').income.total, 30000 + 20000 - 5000);
});

test('a document paid in parts adds up to the whole; a payment in another currency at its rate', () => {
  const bill = entry('bill2', '2026-05-01', [['rent', 33333], ['ap', -33333]], { type: 'bill-accrual', billId: 'b2' });
  const parts: CashBasisPayment[] = [10000, 10000, 13333].map((amountCents, i) => ({ id: `q${i}`, paymentDate: `2026-05-0${i + 2}`, allocations: [{ documentId: 'b2', documentType: 'bill' as const, amountCents }] }));
  const pl = computeProfitAndLoss(accounts, cashBasisEntries(accounts, [bill], parts).entries, '2026-05-01', '2026-05-31');
  assert.equal(pl.expense.accounts.rent.balance, 33333);
  const euro = entry('bill3', '2026-06-01', [['rent', 22000], ['ap', -22000]], { type: 'bill-accrual', billId: 'b3' });
  const half = cashBasisEntries(accounts, [euro], [{ id: 'e', paymentDate: '2026-06-05', exchangeRate: 1.1, allocations: [{ documentId: 'b3', documentType: 'bill', amountCents: 10000 }] }]).entries;
  assert.equal(computeProfitAndLoss(accounts, half, '2026-06-01', '2026-06-30').expense.accounts.rent.balance, 11000);
});

test('a reversed posting is not brought in; whole cents with the rounding on the largest line', () => {
  const inv = entry('inv9', '2026-07-01', [['ar', 1000], ['sales', -1000]], { type: 'invoice-accrual', invoiceId: 'i9' });
  const reversal = entry('rev9', '2026-07-02', [['ar', -1000], ['sales', 1000]], { isReversal: true, reversesTxId: 'inv9' });
  const { entries, leftOut } = cashBasisEntries(accounts, [inv, reversal], [{ id: 'x', paymentDate: '2026-07-03', allocations: [{ documentId: 'i9', documentType: 'invoice', amountCents: 1000 }] }]);
  assert.equal(computeProfitAndLoss(accounts, entries, '2026-07-01', '2026-07-31').income.total, 0);
  assert.equal(leftOut, 0, 'a reversal is not a credit note');
  assert.deepEqual(shareOfLines([{ amountCents: -100 }, { amountCents: -100 }, { amountCents: -100 }], 1 / 3).map(l => l.amountCents), [-34, -33, -33]);
});
