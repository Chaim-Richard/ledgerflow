/**
 * Transactions by Reference (J-06): posted entries under their own reference, or the invoice / bill
 * number for document postings; reversals marked; drafts, other periods and unreferenced entries
 * left out; references in natural order.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTransactionsByReference } from '../server/reports/referenceReport';
import { makeTransaction } from './fixtures';

const entry = (id: string, date: string, cents: number, extra: Record<string, unknown> = {}) =>
  makeTransaction({ id, date, description: id, lines: [{ accountId: 'a', amountCents: cents }, { accountId: 'b', amountCents: -cents }], ...extra });

test('entries grouped by reference, with document numbers for invoice and bill postings', () => {
  const report = computeTransactionsByReference([
    entry('chq10', '2026-04-02', 5000, { reference: 'CHQ 10' }),
    entry('chq2', '2026-04-03', 2500, { reference: ' CHQ 2 ' }),
    entry('inv-post', '2026-04-01', 11000, { metadata: { invoiceId: 'i7', type: 'invoice-accrual' } }),
    entry('inv-rev', '2026-04-05', 11000, { metadata: { invoiceId: 'i7', type: 'invoice-reversal', reversesTxId: 'inv-post' } }),
    entry('bill-post', '2026-04-04', 3000, { metadata: { billId: 'b1' } }),
    entry('eur', '2026-04-06', 1000, { reference: 'WIRE-55', currency: 'EUR', exchangeRate: 1.5 }),
    entry('plain', '2026-04-07', 100),
    entry('draft', '2026-04-08', 999, { reference: 'CHQ 3', status: 'draft' }),
    entry('march', '2026-03-31', 999, { reference: 'CHQ 4' }),
  ], { invoices: [{ id: 'i7', number: 'INV-0007' }], bills: [{ id: 'b1', number: 'V-881' }] }, '2026-04-01', '2026-04-30');

  assert.deepEqual(report.rows.map(r => [r.reference, r.transactionId, r.source, r.amountCents]), [
    ['CHQ 2', 'chq2', 'Entry', 2500],          // natural order: 2 before 10, spaces trimmed
    ['CHQ 10', 'chq10', 'Entry', 5000],
    ['INV-0007', 'inv-post', 'Invoice', 11000],
    ['INV-0007', 'inv-rev', 'Reversal', 11000],
    ['V-881', 'bill-post', 'Bill', 3000],
    ['WIRE-55', 'eur', 'Entry', 1500],         // €10 at 1.5 in the base currency
  ]);
  assert.equal(report.referenceCount, 5);
  assert.equal(report.withoutReference, 1);
});
