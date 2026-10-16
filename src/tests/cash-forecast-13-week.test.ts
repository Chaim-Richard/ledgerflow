import test from 'node:test';
import assert from 'node:assert/strict';
import { cashForecast13Week, cashForecastCsvRows, openCents, CASH_FORECAST_CSV_HEADERS } from '../lib/cashForecast13Week';

const invoice = (id: string, dueDate: string | undefined, amountCents: number, over: Record<string, unknown> = {}) =>
  ({ id, label: id, expectedDate: dueDate, amountCents, currency: 'USD', status: 'sent', ...over });
const bill = (id: string, dueDate: string, amountCents: number, over: Record<string, unknown> = {}) =>
  ({ id, label: id, expectedDate: dueDate, amountCents, currency: 'USD', status: 'approved', ...over });

const forecast = (over: Partial<Parameters<typeof cashForecast13Week>[0]> = {}) => cashForecast13Week({
  asOf: '2026-01-05', homeCurrency: 'USD', openingCashCents: 100000, invoices: [], bills: [], recurring: [], ...over,
});

test('A-186: thirteen weeks are built from the assessment day, seven days each', () => {
  const report = forecast();
  assert.equal(report.weeks.length, 13);
  assert.equal(report.weeks[0].startDate, '2026-01-05');
  assert.equal(report.weeks[0].endDate, '2026-01-11');
  assert.equal(report.weeks[12].startDate, '2026-03-30');
  assert.equal(report.weeks[12].endDate, '2026-04-05');
});

test('A-186: an invoice lands in its due week and a bill takes money out', () => {
  const report = forecast({
    invoices: [invoice('i1', '2026-01-05', 100000), invoice('i2', '2026-01-12', 50000)],
    bills: [bill('b1', '2026-01-14', 30000)],
  });
  assert.equal(report.weeks[0].inflowCents, 100000);
  assert.equal(report.weeks[1].inflowCents, 50000);
  assert.equal(report.weeks[1].outflowCents, 30000);
  assert.equal(report.weeks[1].netCents, 20000);
  assert.equal(report.weeks[0].closingCents, 200000);
  assert.equal(report.weeks[1].closingCents, 220000);
  assert.equal(report.weeks[12].closingCents, 220000);
});

test('A-186: money already past due is placed in week 1 and said so', () => {
  const report = forecast({
    invoices: [invoice('i1', '2025-12-20', 40000)],
    bills: [bill('b1', '2026-01-01', 15000)],
  });
  assert.equal(report.weeks[0].inflowCents, 40000);
  assert.equal(report.weeks[0].outflowCents, 15000);
  assert.equal(report.overdueInflowCents, 40000);
  assert.equal(report.overdueOutflowCents, 15000);
  assert.equal(report.weeks[0].lines[0].overdue, true);
});

test('A-186: paid, draft and void documents are not forecast, and part-paid is the open part', () => {
  const report = forecast({
    invoices: [
      invoice('paid', '2026-01-06', 100000, { paidCents: 100000 }),
      invoice('draft', '2026-01-06', 90000, { status: 'draft' }),
      invoice('void', '2026-01-06', 90000, { status: 'void' }),
      invoice('part', '2026-01-06', 100000, { paidCents: 40000 }),
    ],
    bills: [bill('draft-bill', '2026-01-06', 70000, { status: 'draft' })],
  });
  assert.equal(report.totalInflowCents, 60000);
  assert.equal(report.totalOutflowCents, 0);
  assert.equal(report.weeks[0].closingCents, 160000);
  assert.equal(openCents({ id: 'x', label: 'x', amountCents: 250, paidCents: 400 }), 0);
});

test('A-186: another currency is counted and never converted, and undated or late money is named', () => {
  const report = forecast({
    invoices: [
      invoice('eur', '2026-01-06', 50000, { currency: 'EUR' }),
      invoice('undated', undefined, 5000),
      invoice('late', '2026-06-01', 8000),
    ],
  });
  assert.equal(report.skippedOtherCurrency, 1);
  assert.equal(report.undated, 1);
  assert.equal(report.beyondHorizonCents.documents, 1);
  assert.equal(report.beyondHorizonCents.inflowCents, 8000);
  assert.equal(report.totalInflowCents, 0);
});

test('A-186: a monthly recurring rule is expanded on its own dates and its direction comes from the caller', () => {
  const report = forecast({
    recurring: [{ id: 'r1', label: 'Office rent', amountCents: 50000, frequency: 'monthly', nextOccurrence: '2026-01-10', direction: 'outflow' }],
  });
  assert.equal(report.totalOutflowCents, 150000); // 10 Jan, 10 Feb, 10 Mar
  assert.equal(report.weeks[0].outflowCents, 50000);
  assert.equal(report.weeks[0].closingCents, 50000);
});

test('A-186: a rule whose accounts do not say the direction, and a paused rule, are reported instead of guessed', () => {
  const report = forecast({
    recurring: [
      { id: 'r1', label: 'Unclear', amountCents: 1000, frequency: 'monthly', nextOccurrence: '2026-01-10', direction: 'unknown' },
      { id: 'r2', label: 'Paused', amountCents: 1000, frequency: 'monthly', nextOccurrence: '2026-01-10', direction: 'outflow', status: 'paused' },
      { id: 'r3', label: 'No frequency', amountCents: 1000, frequency: 'fortnightly', nextOccurrence: '2026-01-10', direction: 'outflow' },
    ],
  });
  assert.equal(report.unclassifiedRecurring, 1);
  assert.equal(report.inactiveRecurring, 1);
  assert.equal(report.totalOutflowCents, 0);
});

test('A-186: an impossible assessment day is refused rather than silently forecast', () => {
  assert.throws(() => forecast({ asOf: '2026-02-31' }), /real assessment day/);
});

test('A-186: the CSV writes one row per week with whole amounts', () => {
  const report = forecast({ invoices: [invoice('i1', '2026-01-05', 123456)] });
  const rows = cashForecastCsvRows(report);
  assert.equal(rows.length, 13);
  assert.equal(CASH_FORECAST_CSV_HEADERS.length, rows[0].length);
  assert.deepEqual(rows[0].slice(0, 6), ['1', '2026-01-05', '2026-01-11', '1234.56', '0.00', '1234.56']);
  assert.equal(rows[0][6], '2234.56');
});
