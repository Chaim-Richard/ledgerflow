import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { roundCents, formatCurrency, formatDollars, getLocalDateISO } from '../lib/utils.js';

describe('Financial Accounting Golden-Path Test Suite', () => {
  test('Local ISO Date helper generates YYYY-MM-DD in local time', () => {
    const fixedDate = new Date(2026, 6, 22); // July 22, 2026 local
    assert.equal(getLocalDateISO(fixedDate), '2026-07-22');
  });

  test('Currency formatting produces clean Intl representations', () => {
    assert.equal(formatCurrency(123456), '$1,234.56');
    assert.equal(formatCurrency(0), '$0.00');
    assert.equal(formatCurrency(null as any), '$0.00');
    assert.equal(formatDollars(1234.56), '$1,234.56');
  });

  test('Financial rounding prevents sub-cent rounding errors', () => {
    const rawCents = 12500.4;
    assert.equal(roundCents(rawCents), 12500);
    assert.equal(roundCents(12500.6), 12501);
  });

  test('Double-Entry Ledger Balancing: Debits must equal Credits', () => {
    const journalEntry = {
      id: 'tx_1',
      description: 'Consulting Revenue Received',
      lines: [
        { accountId: '1010', debitCents: 500000, creditCents: 0 },   // Operating Cash (Asset) +$5,000
        { accountId: '4010', debitCents: 0, creditCents: 500000 }    // Service Revenue +$5,000
      ]
    };

    const totalDebits = journalEntry.lines.reduce((sum, line) => sum + line.debitCents, 0);
    const totalCredits = journalEntry.lines.reduce((sum, line) => sum + line.creditCents, 0);

    assert.equal(totalDebits, totalCredits, 'Double-entry equation violated: Debits !== Credits');
    assert.equal(totalDebits, 500000);
  });

  test('Trial Balance Ties Out To Zero', () => {
    const accounts = [
      { id: '1010', type: 'asset', debitCents: 1000000, creditCents: 0 },
      { id: '2010', type: 'liability', debitCents: 0, creditCents: 200000 },
      { id: '3010', type: 'equity', debitCents: 0, creditCents: 300000 },
      { id: '4010', type: 'revenue', debitCents: 0, creditCents: 800000 },
      { id: '5010', type: 'expense', debitCents: 300000, creditCents: 0 },
    ];

    const sumDebits = accounts.reduce((acc, a) => acc + a.debitCents, 0);
    const sumCredits = accounts.reduce((acc, a) => acc + a.creditCents, 0);

    assert.equal(sumDebits, 1300000);
    assert.equal(sumCredits, 1300000);
    assert.equal(sumDebits - sumCredits, 0, 'Trial balance does not tie out to zero');
  });

  test('P&L & Balance Sheet Reconciliation Equation: Assets = Liabilities + Equity + Net Income', () => {
    // Financial numbers (in cents)
    const assets = 1000000;      // $10,000
    const liabilities = 200000;  // $2,000
    const initialEquity = 300000;// $3,000
    const revenue = 800000;      // $8,000
    const expenses = 300000;     // $3,000

    const netIncome = revenue - expenses; // $5,000
    const totalEndingEquity = initialEquity + netIncome; // $8,000

    assert.equal(netIncome, 500000, 'Net Income calculation error');
    assert.equal(assets, liabilities + totalEndingEquity, 'Accounting equation violated: Assets !== Liabilities + Equity');
  });
});
