/**
 * Cash flow statement (computeCashFlow, used by the server report and the Cash Flow screen): money
 * in and out of bank/cash accounts, by what it was for. Every number below is worked out by hand,
 * and net change must equal the change in the cash accounts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cashFlowSection, computeCashFlow, isCashFlowCashAccount } from '../server/reports/computeReports';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Transaction } from '../types';

const acc = (id: string, type: 'asset' | 'liability' | 'equity' | 'income' | 'expense', category: string, name = id, code = '9999') =>
  makeChartAccount({ id, type, category, name, code });
const accounts = [
  acc('bank', 'asset', 'Cash', 'Operating Bank', '1000'),
  acc('savings', 'asset', 'Cash', 'Savings', '1010'),
  makeChartAccount({ id: 'undeposited', type: 'asset', category: 'Other', name: 'Undeposited Funds', subtype: 'undeposited_funds', code: '1050' }),
  acc('ar', 'asset', 'Receivables', 'Accounts Receivable', '1200'),
  acc('inventory', 'asset', 'Inventory', 'Inventory', '1300'),
  acc('equipment', 'asset', 'Fixed Assets', 'Equipment', '1500'),
  acc('accumdep', 'asset', 'Fixed Assets', 'Accumulated Depreciation', '1590'),
  acc('tax', 'liability', 'Tax', 'Sales Tax Payable', '2100'),
  acc('loan', 'liability', 'Debt', 'Bank Loan', '2500'),
  acc('equity', 'equity', 'Equity', 'Owner Drawings', '3000'),
  acc('sales', 'income', 'Sales', 'Sales', '4000'),
  acc('rent', 'expense', 'Overhead', 'Rent', '6000'),
  acc('depexp', 'expense', 'Overhead', 'Depreciation', '6100'),
];

let n = 0;
const entry = (lines: Array<[string, number]>, extra: Partial<Transaction> = {}) =>
  makeTransaction({ id: `t${++n}`, date: '2026-05-10', description: `entry ${n}`, lines: lines.map(([accountId, amountCents]) => ({ accountId, amountCents })), ...extra });

const ledger = [
  entry([['ar', 11000], ['sales', -10000], ['tax', -1000]]),                    // invoice: no cash
  entry([['undeposited', 11000], ['ar', -11000]]),                              // customer pays: +110.00 operating
  entry([['bank', 11000], ['undeposited', -11000]]),                            // deposit: cash to cash
  entry([['tax', 1000], ['bank', -1000]]),                                       // sales tax paid: −10.00 operating
  entry([['inventory', 3000], ['bank', -3000]]),                                 // stock bought: −30.00 operating
  entry([['rent', 2000], ['bank', -2000]], { currency: 'EUR', exchangeRate: 1.5 }), // rent €20 at 1.5: −30.00 operating
  entry([['equipment', 20000], ['bank', -20000]]),                               // equipment: −200.00 investing
  entry([['bank', 50000], ['loan', -50000]]),                                    // loan received: +500.00 financing
  entry([['equity', 5000], ['bank', -5000]]),                                    // owner draws: −50.00 financing
  entry([['savings', 4000], ['bank', -4000]]),                                   // transfer: nothing
  entry([['depexp', 700], ['accumdep', -700]]),                                  // depreciation: no cash
  entry([['bank', 99900], ['sales', -99900]], { status: 'draft' }),             // not posted
  entry([['bank', 77700], ['sales', -77700]], { date: '2025-12-31' }),          // before the period
];

test('each kind of entry lands in the right section, in the base currency', () => {
  const cf = computeCashFlow(accounts, ledger, '2026-01-01', '2026-12-31');
  assert.deepEqual({ total: cf.operating.total, inflow: cf.operating.inflow, outflow: cf.operating.outflow }, { total: 4000, inflow: 11000, outflow: 7000 });
  assert.deepEqual({ total: cf.investing.total, inflow: cf.investing.inflow, outflow: cf.investing.outflow }, { total: -20000, inflow: 0, outflow: 20000 });
  assert.deepEqual({ total: cf.financing.total, inflow: cf.financing.inflow, outflow: cf.financing.outflow }, { total: 45000, inflow: 50000, outflow: 5000 });
  assert.equal(cf.netChange, 29000);
  assert.deepEqual(cf.investing.items, [{ name: 'entry 7', amount: -20000 }]);
  assert.deepEqual(cf.financing.items.map(i => i.amount), [50000, -5000]);
});

test('net change equals the change in the bank, savings and undeposited accounts', () => {
  const cash = new Set(accounts.filter(isCashFlowCashAccount).map(a => a.id));
  assert.deepEqual([...cash].sort(), ['bank', 'savings', 'undeposited']);
  const inPeriod = ledger.filter(t => t.status !== 'draft' && t.date >= '2026-01-01');
  const cashChange = inPeriod.reduce((sum, t) => sum + t.lines.filter(l => cash.has(l.accountId))
    .reduce((s, l) => s + Math.round(l.amountCents * (t.exchangeRate ?? 1)), 0), 0);
  assert.equal(computeCashFlow(accounts, ledger, '2026-01-01', '2026-12-31').netChange, cashChange);
});

test('sections by account: equity and debt finance, fixed assets invest, the rest operates', () => {
  const section = (id: string) => cashFlowSection(accounts.find(a => a.id === id)!);
  assert.equal(section('equity'), 'financing');
  assert.equal(section('loan'), 'financing');
  assert.equal(section('equipment'), 'investing');
  assert.equal(section('tax'), 'operating');
  assert.equal(section('inventory'), 'operating');
  assert.equal(section('ar'), 'operating');
  assert.equal(cashFlowSection(makeChartAccount({ type: 'liability', category: 'Long Term Liabilities', name: 'Note' })), 'financing');
  assert.equal(cashFlowSection(makeChartAccount({ type: 'liability', category: 'Credit Card', name: 'Visa' })), 'operating');
});

test('no dates means every posted entry', () => {
  assert.equal(computeCashFlow(accounts, ledger).netChange, 29000 + 77700);
});

test('General Ledger: opening balance from earlier entries, running balance by the account\'s side, posted only', async () => {
  const { computeGeneralLedger } = await import('../server/reports/computeReports');
  const gl = computeGeneralLedger(accounts, ledger, '2026-05-01', '2026-05-31', 'bank');
  const bank = gl.accounts[0];
  assert.equal(gl.accounts.length, 1);
  assert.equal(bank.openingBalanceCents, 77700); // the 2025 entry
  assert.equal(bank.periodDebitsCents, 11000 + 50000);
  assert.equal(bank.periodCreditsCents, 1000 + 3000 + 3000 + 20000 + 5000 + 4000);
  assert.equal(bank.endingBalanceCents, 77700 + 25000);
  assert.equal(bank.entries.length, 8); // the draft is left out
  const sales = computeGeneralLedger(accounts, ledger, '2026-01-01', '2026-12-31', 'sales').accounts[0];
  assert.equal(sales.openingBalanceCents, 77700); // income grows with credits
  assert.equal(sales.endingBalanceCents, 77700 + 10000);
});
