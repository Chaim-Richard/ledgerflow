/**
 * A-193: gross margin by item group over time. Hand-checked against Sales by Item's own rules: a
 * line's cost is quantity × the recorded unit cost here (nothing posted, so it is an estimate),
 * a draft is not a sale, a line with no item is "No item" with no cost invented for it, and an
 * item with no recorded group is counted in "No group recorded".
 *
 * Figures (USD cents): Widgets group — item A (unit cost 400): January sells 10 × 1,000 = 10,000,
 * cost 4,000, margin 6,000 (60%). February sells 5 × 1,000 = 5,000, cost 2,000 (60%).
 * Service hours (item B, no group, no cost): February 3,000, margin 100%.
 * A free-text line of 700 in February: "No item", cost 0 (nothing invented).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { grossMarginByItemGroup, groupMarginCsvRows, monthRange, monthsBetween } from '../lib/grossMarginByGroup';

const items = [
  { id: 'a', name: 'Widget A', sku: 'WA', unitCostCents: 400, category: 'Widgets' },
  { id: 'b', name: 'Service hour', sku: 'SH', unitCostCents: 0 },
];
const invoice = (over: Record<string, unknown>) => ({
  id: 'inv', customerId: 'c1', status: 'sent', date: '2026-01-10', currency: 'USD', items: [], ...over,
});
const invoices = [
  invoice({ id: 'i1', date: '2026-01-10', items: [{ id: 'l1', itemId: 'a', description: 'Widget A', quantity: 10, amountCents: 10_000 }] }),
  invoice({ id: 'i2', date: '2026-02-03', items: [
    { id: 'l2', itemId: 'a', description: 'Widget A', quantity: 5, amountCents: 5_000 },
    { id: 'l3', itemId: 'b', description: 'Service hour', quantity: 1, amountCents: 3_000 },
    { id: 'l4', description: 'One-off help', quantity: 1, amountCents: 700 },
  ] }),
  invoice({ id: 'i3', date: '2026-02-20', status: 'draft', items: [{ id: 'l5', itemId: 'a', quantity: 99, amountCents: 99_000 }] }),
];

const report = grossMarginByItemGroup({
  invoices: invoices as never, items: items as never, transactions: [], accounts: [],
  months: ['2026-01', '2026-02'],
});

test('each month of a group is Sales by Item summed over its items, by hand', () => {
  const widgets = report.rows.find(r => r.group === 'Widgets')!;
  assert.ok(widgets);
  assert.deepEqual(widgets.months.map(m => [m.salesCents, m.costCents, m.marginCents]), [
    [10_000, 4_000, 6_000],
    [5_000, 2_000, 3_000],
  ]);
  assert.equal(widgets.months[0].marginPct, 60);
  assert.equal(widgets.costIsEstimate, true, 'no cost was posted, so the cost is an estimate');
  assert.equal(widgets.salesCents, 15_000, 'the 99,000 draft is not a sale');
});

test('no group and no item are their own rows, last, with no cost invented', () => {
  const names = report.rows.map(r => r.group);
  assert.deepEqual(names, ['Widgets', 'No group recorded', 'No item']);
  const noItem = report.rows.find(r => r.group === 'No item')!;
  assert.equal(noItem.salesCents, 700);
  assert.equal(noItem.costCents, 0);
  const noGroup = report.rows.find(r => r.group === 'No group recorded')!;
  assert.equal(noGroup.marginPct, 100);
  assert.equal(noGroup.months[0].marginPct, null, 'a month with no sales has no margin percent, not zero');
});

test('the totals row adds the groups back up, and the months walk is calendar-exact', () => {
  assert.deepEqual(report.totals.map(m => m.marginCents), [6_000, 3_000 + 3_000 + 700]);
  assert.deepEqual(monthRange('2026-02'), { startDate: '2026-02-01', endDate: '2026-02-28' });
  assert.deepEqual(monthRange('2024-02'), { startDate: '2024-02-01', endDate: '2024-02-29' }, 'leap year');
  assert.deepEqual(monthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  const csv = groupMarginCsvRows(report.rows);
  assert.equal(csv[0][0], 'Widgets');
  assert.equal(csv[0].at(-1), 'Yes', 'the CSV says the cost is partly estimated');
});
