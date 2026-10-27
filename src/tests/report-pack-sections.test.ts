/**
 * C-84: the monthly pack can carry Budget vs actual and Stock on hand by age, read from the report
 * services that already exist. Every figure is the service's own number (no recalculation), the
 * month and the as-of day the pack asks for are the ones it prints, and a payload that does not
 * match refuses to print instead of filling the pack with zeroes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PACK_REPORTS, packReportUrl, packSection } from '../lib/reportPack';

const start = '2026-03-01', end = '2026-03-31';

test('budget vs actual keeps each line’s budget, actual and variance, and totals them', () => {
  const answer = [
    { accountName: 'Rent', budget: 500000, actual: 450000, variance: 50000, percent: 90 },
    { accountName: 'Marketing', budget: 200000, actual: 260000, variance: -60000, percent: 130 },
  ];
  const section = packSection('budget', answer, {});
  const cents = (label: string) => section.rows.find(row => row.label === label)?.cents;
  assert.equal(cents('Rent · Budget'), 500000);
  assert.equal(cents('Rent · Actual'), 450000);
  assert.equal(cents('Marketing · Variance'), -60000, 'over budget stays negative, as the screen shows it');
  assert.equal(cents('Total budget'), 700000);
  assert.equal(cents('Total actual'), 710000);
  assert.equal(cents('Total variance'), -10000);
  assert.equal(section.rows.at(-1)?.total, true);
  assert.deepEqual(section.warnings, ['1 budget line is over budget for the month.']);
});

test('a month with no budgets says so instead of printing an empty comparison', () => {
  const section = packSection('budget', [], {});
  assert.deepEqual(section.rows, []);
  assert.deepEqual(section.warnings, ['No budgets are set for the month of this pack, so there is nothing to compare.']);
});

test('stock on hand sums the items’ own values and keeps undated units honest', () => {
  const answer = {
    asOf: end,
    items: [
      { itemName: 'Widget', quantity: 12, valueCents: 4800, unknownAge: 0 },
      { itemName: 'Gadget', quantity: 5.5, valueCents: 5500, unknownAge: 2 },
    ],
  };
  const section = packSection('stock', answer, {});
  assert.equal(section.rows[0].label, 'Widget · 12 units');
  assert.equal(section.rows[0].cents, 4800);
  assert.equal(section.rows[1].label, 'Gadget · 5.5 units', 'fractional units are printed as they are');
  assert.equal(section.rows.at(-1)?.label, 'Total stock on hand');
  assert.equal(section.rows.at(-1)?.cents, 10300);
  assert.deepEqual(section.warnings, ['1 item includes units from before the stock history began, so their age is unknown.']);
  assert.deepEqual(packSection('stock', { asOf: end, items: [] }, {}).warnings, [`No item had stock on hand at ${end}.`]);
});

test('the pack asks each service for the month and the day it prints', () => {
  const budget = new URL(packReportUrl('budget', 'ws שלום', start, end), 'http://test');
  assert.equal(budget.pathname, '/api/v1/reports/budget-vs-actual');
  assert.equal(budget.searchParams.get('month'), '2026-03');
  assert.equal(budget.searchParams.get('workspaceId'), 'ws שלום');
  assert.equal(budget.searchParams.has('endDate'), false, 'the budget service takes a month, not a range');
  const stock = new URL(packReportUrl('stock', 'ws', start, end), 'http://test');
  assert.equal(stock.pathname, '/api/v1/reports/stock-aging');
  assert.equal(stock.searchParams.get('asOf'), end);
  assert.equal(PACK_REPORTS.budget, 'Budget vs actual');
  assert.equal(PACK_REPORTS.stock, 'Stock on hand by age');
});

test('an incomplete answer refuses the pack rather than printing zeroes', () => {
  assert.throws(() => packSection('budget', [{ accountName: 'Rent', budget: 1 }], {}));
  assert.throws(() => packSection('budget', { rows: [] }, {}));
  assert.throws(() => packSection('stock', { asOf: end, items: [{ itemName: 'Widget', quantity: 1 }] }, {}));
  assert.throws(() => packSection('stock', { items: [] }, {}));
  assert.throws(() => packSection('budget', [{ accountName: 'Rent', budget: 1.5, actual: 0, variance: -1.5, percent: 0 }], {}), 'fractional cents are refused');
});
