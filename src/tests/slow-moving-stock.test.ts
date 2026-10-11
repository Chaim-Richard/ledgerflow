/** A-9 (W-09): hand-checked dates. Report day 2026-10-11 unless a case says otherwise. */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SlowMovingItemInput } from '../lib/slowMovingStock';
import { daysBetween, lastSaleDates, noSaleInDays, slowMovingBucket, slowMovingRows, slowMovingTotals } from '../lib/slowMovingStock';

const ASOF = '2026-10-11';

describe('slow-moving stock', () => {
  test('day counts cross month and leap-year boundaries', () => {
    assert.equal(daysBetween('2026-09-11', ASOF), 30); // Sept has 30 days
    assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2); // 2024 is a leap year
    assert.equal(daysBetween('2025-02-28', '2025-03-01'), 1);
    assert.equal(daysBetween(ASOF, '2026-10-01'), -10);
  });

  test('bucket edges: 30, 31, 90, 91, 180, 181 days', () => {
    assert.equal(slowMovingBucket(0), '0-30');
    assert.equal(slowMovingBucket(30), '0-30');
    assert.equal(slowMovingBucket(31), '31-90');
    assert.equal(slowMovingBucket(90), '31-90');
    assert.equal(slowMovingBucket(91), '91-180');
    assert.equal(slowMovingBucket(180), '91-180');
    assert.equal(slowMovingBucket(181), '180+');
    assert.equal(slowMovingBucket(null), 'never');
  });

  test('last sale: the latest issued date per item; drafts, estimates, voids and later dates do not count', () => {
    const invoices = [
      { date: '2026-08-01', status: 'paid', items: [{ itemId: 'a', quantity: 2 }] },
      { date: '2026-09-15', status: 'sent', items: [{ itemId: 'a', quantity: 1 }] },
      { date: '2026-10-05', status: 'draft', items: [{ itemId: 'a', quantity: 1 }] },
      { date: '2026-10-06', status: 'void', items: [{ itemId: 'a', quantity: 1 }] },
      { date: '2026-10-07', status: 'sent', type: 'estimate', items: [{ itemId: 'a', quantity: 1 }] },
      { date: '2026-10-20', status: 'sent', items: [{ itemId: 'a', quantity: 1 }] }, // after the report day
      { date: '2026-07-01', status: 'paid', items: [{ itemId: 'b', quantity: 0 }] }, // zero quantity: not a sale
    ];
    const last = lastSaleDates(invoices, ASOF);
    assert.equal(last.get('a'), '2026-09-15');
    assert.equal(last.has('b'), false);
  });

  test('rows: quantity × cost is the value; services and empty items are left out; never-sold first', () => {
    const items: SlowMovingItemInput[] = [
      { id: 'a', name: 'Bolt', sku: 'B-1', quantityAtHand: 3, unitCostCents: 1250 }, // 37.50
      { id: 'b', name: 'Nut', quantityAtHand: 10, unitCostCents: 99 }, // 9.90, never sold
      { id: 'c', name: 'Consult', quantityAtHand: 5, unitCostCents: 100, itemType: 'service' },
      { id: 'd', name: 'Empty', quantityAtHand: 0, unitCostCents: 500 },
    ];
    const invoices = [{ date: '2026-08-01', status: 'paid', items: [{ itemId: 'a', quantity: 1 }] }];
    const rows = slowMovingRows(items, invoices, ASOF);
    assert.deepEqual(rows.map(r => r.itemId), ['b', 'a']);
    assert.equal(rows[0].lastSold, null);
    assert.equal(rows[0].bucket, 'never');
    assert.equal(rows[0].valueCents, 990);
    assert.equal(rows[1].daysSinceSold, 71); // 2026-08-01 → 2026-10-11
    assert.equal(rows[1].bucket, '31-90');
    assert.equal(rows[1].valueCents, 3750);
  });

  test('"no sale in N days" keeps never-sold items and those past N days', () => {
    const items = [
      { id: 'a', name: 'Old', quantityAtHand: 1, unitCostCents: 100 },
      { id: 'b', name: 'Fresh', quantityAtHand: 1, unitCostCents: 100 },
    ];
    const invoices = [
      { date: '2026-07-13', status: 'paid', items: [{ itemId: 'a', quantity: 1 }] }, // 90 days before
      { date: '2026-08-13', status: 'paid', items: [{ itemId: 'b', quantity: 1 }] }, // 59 days before
    ];
    const rows = slowMovingRows(items, invoices, ASOF);
    assert.deepEqual(noSaleInDays(rows, 90).map(r => r.itemId), []); // exactly 90 is not more than 90
    assert.deepEqual(noSaleInDays(rows, 89).map(r => r.itemId), ['a']);
    assert.deepEqual(noSaleInDays(rows, 30).map(r => r.itemId), ['a', 'b']);
  });

  test('totals per bucket add up to the total value', () => {
    const items = [
      { id: 'a', name: 'A', quantityAtHand: 2, unitCostCents: 500 }, // 1000 never sold
      { id: 'b', name: 'B', quantityAtHand: 1, unitCostCents: 333 }, // 333 sold 2026-10-01 (10 days)
    ];
    const rows = slowMovingRows(items, [{ date: '2026-10-01', status: 'paid', items: [{ itemId: 'b', quantity: 1 }] }], ASOF);
    const t = slowMovingTotals(rows);
    assert.equal(t.never, 1000);
    assert.equal(t['0-30'], 333);
    assert.equal(t.totalCents, 1333);
  });
});
