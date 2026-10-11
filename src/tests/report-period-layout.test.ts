import test from 'node:test';
import assert from 'node:assert/strict';
import { movePeriod, validPeriodLayout, visiblePeriods } from '../lib/reportPeriodLayout';
import { statementColumnCsv, computeReportColumns, splitReportPeriods, statementRows } from '../lib/reportColumns';
import { makeChartAccount, makeTransaction } from './fixtures';

test('corrupt and obsolete period preferences cannot hide everything or duplicate a column', () => {
  assert.deepEqual(validPeriodLayout({ order: ['feb', 'feb', 'old', 9], hidden: ['jan', 'feb', 'feb'] }, ['jan', 'feb']), {
    order: ['feb', 'jan'], hidden: ['jan'],
  });
  const layout = validPeriodLayout(null, ['jan', 'feb']);
  assert.deepEqual(movePeriod(layout, 'feb', -1).order, ['feb', 'jan']);
  assert.equal(movePeriod(layout, 'jan', -1), layout);
  assert.equal(movePeriod(layout, 'unknown', 1), layout);
});

test('reordered and hidden statement periods keep their exact totals, CSV decimals and Hebrew row identity', () => {
  const accounts = [makeChartAccount({ id: 'cash' }), makeChartAccount({ id: 'sales', name: 'מכירות Sales', type: 'income', category: 'Revenue' })];
  const entries = [1000, 2300].map((amount, index) => makeTransaction({ date: `2024-0${index + 1}-15`, lines: [{ accountId: 'cash', amountCents: amount }, { accountId: 'sales', amountCents: -amount }] }));
  const columns = computeReportColumns('pl', accounts, entries, splitReportPeriods('2024-01-01', '2024-02-29', 'months'));
  const ids = columns.map(column => column.period.id);
  const selected = visiblePeriods(columns, { order: [ids[1], ids[0]], hidden: [] });
  assert.equal(selected[0], columns[1], 'the complete current/prior period object is retained');
  const rows = statementRows(accounts, columns[0].data);
  const csv = statementColumnCsv(rows, selected, false, false);
  assert.deepEqual(csv.rows.find(row => row[0] === 'Net income')?.slice(2), ['23.00', '10.00']);
  assert.deepEqual(csv.rows.find(row => row[0] === 'מכירות Sales')?.slice(2), ['23.00', '10.00']);
  const hidden = statementColumnCsv(rows, visiblePeriods(columns, { order: ids, hidden: [ids[0]] }), false, false);
  assert.deepEqual(hidden.rows.find(row => row[0] === 'Net income')?.slice(2), ['23.00']);
  assert.equal(columns[0].data === selected[1].data, true);
});
