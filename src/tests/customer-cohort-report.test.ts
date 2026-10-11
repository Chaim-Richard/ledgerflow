import test from 'node:test';
import assert from 'node:assert/strict';
import { customerCohortReport } from '../lib/customerCohortReport';
import { makeInvoice } from './fixtures';

const issued = (id: string, customerId: string, date: string, amountCents: number, extras = {}) =>
  makeInvoice({ id, customerId, date, amountCents, status: 'sent', ...extras });

test('cohort matrix: earliest issued month, distinct buyers, repeated invoice totals and FX in base cents', () => {
  const invoices = [
    issued('a1', 'a', '2026-01-02', 10000),
    issued('b1', 'b', '2026-01-31', 20000),
    issued('a2', 'a', '2026-02-01', 2000),
    issued('a3', 'a', '2026-02-28', 1000, { exchangeRate: 1.5 }),
    issued('b2', 'b', '2026-03-01', 500),
    issued('c1', 'c', '2026-02-04', 9000),
  ];
  const result = customerCohortReport(invoices, '2026-03-15', 12, 5);
  assert.equal(result.observedCustomers, 3);
  assert.deepEqual(result.rows.map(row => [row.cohort, row.customers]), [['2026-01', 2], ['2026-02', 1]]);
  const [jan, feb] = result.rows;
  assert.deepEqual(jan.months.map(cell => [cell.activeCustomers, cell.invoicedCents, cell.activePercent]), [
    [2, 30000, 100],
    [1, 3500, 50],
    [1, 500, 50],
    [null, null, null],
    [null, null, null],
  ]);
  assert.deepEqual(feb.months.slice(0, 3).map(cell => [cell.activeCustomers, cell.invoicedCents]), [[1, 9000], [0, 0], [null, null]]);
});

test('excludes drafts, reversals, opening balances, invalid dates, missing customers and future documents', () => {
  const invoices = [
    issued('good', 'x', '2026-02-05', 900),
    issued('future', 'x', '2026-05-01', 300),
    issued('draft', 'y', '2026-01-01', 100, { status: 'draft' }),
    issued('void', 'y', '2026-01-02', 100, { status: 'void' }),
    issued('cancel', 'y', '2026-01-03', 100, { status: 'cancelled' }),
    issued('rejected', 'y', '2026-01-04', 100, { status: 'rejected' }),
    issued('opening', 'y', '2026-01-05', 100, { metadata: { type: 'opening-balance' } }),
    issued('invalid', 'y', '2026-02-30', 100),
    issued('unknown', '', '2026-02-05', 100),
  ];
  const result = customerCohortReport(invoices, '2026-02-20', 12, 3);
  assert.equal(result.excluded, 2);
  assert.deepEqual(result.rows.map(row => row.cohort), ['2026-02']);
  assert.equal(result.rows[0].months[0].invoicedCents, 900);
  assert.equal(result.rows[0].months[1].invoicedCents, null);
});

test('rolling cohort window works across years and does not reclassify old buyers', () => {
  const invoices = [
    issued('old', 'old', '2024-12-10', 8000),
    issued('return', 'old', '2026-01-03', 500),
    issued('recent', 'new', '2025-12-30', 4000),
  ];
  const oneYear = customerCohortReport(invoices, '2026-01-31', 12, 2);
  assert.deepEqual(oneYear.rows.map(row => row.cohort), ['2025-12']);
  assert.deepEqual(oneYear.rows[0].months.map(cell => cell.activeCustomers), [1, 0]);
  const twoYears = customerCohortReport(invoices, '2026-01-31', 24, 2);
  assert.deepEqual(twoYears.rows.map(row => row.cohort), ['2024-12', '2025-12']);
  assert.throws(() => customerCohortReport(invoices, '2026-02-30'), /valid report end date/);
  assert.throws(() => customerCohortReport(invoices, '2026-01-31', 0), /number of months/);
});
