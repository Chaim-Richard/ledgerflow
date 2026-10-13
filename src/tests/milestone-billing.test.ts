/**
 * A-73: milestone billing view. Each milestone's amount from the order total (cumulative rounding so
 * the amounts add up exactly), what is invoiced, what is left, which milestone is due, and what no
 * milestone covers. Read-only.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { milestoneBilling, milestoneBillingCsvRows } from '../lib/milestoneBilling';
import type { Milestone } from '../lib/milestones';

const schedule: Milestone[] = [
  { id: 'm1', label: 'Signing', percent: 30, invoicedAt: '2026-09-02' },
  { id: 'm2', label: 'Halfway', percent: 40, due: '2026-10-01' },
  { id: 'm3', label: 'Handover', percent: 30, due: '2026-11-30' },
];

describe('A-73 milestone billing view', () => {
  test('amounts, invoiced, left and status for each milestone', () => {
    const view = milestoneBilling(100000, schedule, '2026-10-13');
    assert.deepEqual(view.rows.map(r => [r.label, r.amountCents, r.status]), [['Signing', 30000, 'invoiced'], ['Halfway', 40000, 'due'], ['Handover', 30000, 'upcoming']]);
    assert.equal(view.invoicedCents, 30000);
    assert.equal(view.leftCents, 70000);
    assert.equal(view.unscheduledPercent, 0);
  });

  test('the amounts add up to the order total exactly, even when the percentages do not divide it', () => {
    const thirds: Milestone[] = [
      { id: 'a', label: 'One', percent: 33.33 }, { id: 'b', label: 'Two', percent: 33.33 }, { id: 'c', label: 'Three', percent: 33.34 },
    ];
    const view = milestoneBilling(10000, thirds, '2026-10-13');
    assert.equal(view.rows.reduce((s, r) => s + r.amountCents, 0), 10000);
  });

  test('a schedule short of 100% reports what no milestone covers', () => {
    const view = milestoneBilling(50000, [{ id: 'a', label: 'Deposit', percent: 25 }], '2026-10-13');
    assert.equal(view.unscheduledPercent, 75);
    assert.equal(view.rows[0].amountCents, 12500);
    assert.equal(view.leftCents, 50000, 'nothing invoiced yet, the whole order is left');
  });

  test('a milestone with no date is upcoming, never due', () => {
    const view = milestoneBilling(1000, [{ id: 'a', label: 'Later', percent: 100 }], '2030-01-01');
    assert.equal(view.rows[0].status, 'upcoming');
  });

  test('no schedule: nothing to bill, the whole order left and 100% unscheduled', () => {
    const view = milestoneBilling(8000, undefined, '2026-10-13');
    assert.equal(view.rows.length, 0);
    assert.equal(view.leftCents, 8000);
    assert.equal(view.unscheduledPercent, 100);
  });

  test('CSV rows follow the view', () => {
    const rows = milestoneBillingCsvRows(milestoneBilling(100000, schedule, '2026-10-13'));
    assert.deepEqual(rows[1], ['Halfway', 40, 40000, '2026-10-01', 'due', '']);
  });
});
