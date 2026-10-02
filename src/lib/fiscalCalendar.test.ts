import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getFiscalYearBounds, getFiscalQuarter, getPrevPeriod } from './fiscalCalendar';

describe('Fiscal Calendar Suite', () => {
  test('standard calendar year (January start)', () => {
    const bounds = getFiscalYearBounds('2026-06-15', 1, 1);
    assert.strictEqual(bounds.startDate, '2026-01-01');
    assert.strictEqual(bounds.endDate, '2026-12-31');
    assert.strictEqual(bounds.fiscalYear, 2026);

    const q2 = getFiscalQuarter('2026-05-10', 1, 1);
    assert.strictEqual(q2.quarter, 2);
    assert.strictEqual(q2.label, 'FY2026 Q2');
  });

  test('UK fiscal year (April start)', () => {
    // In May 2026, UK is in FY2027 (2026-04-01 to 2027-03-31)
    const boundsMay = getFiscalYearBounds('2026-05-15', 4, 1);
    assert.strictEqual(boundsMay.startDate, '2026-04-01');
    assert.strictEqual(boundsMay.endDate, '2027-03-31');
    assert.strictEqual(boundsMay.fiscalYear, 2027);

    // In February 2026, UK is in FY2026 (2025-04-01 to 2026-03-31)
    const boundsFeb = getFiscalYearBounds('2026-02-10', 4, 1);
    assert.strictEqual(boundsFeb.startDate, '2025-04-01');
    assert.strictEqual(boundsFeb.endDate, '2026-03-31');
    assert.strictEqual(boundsFeb.fiscalYear, 2026);

    const q = getFiscalQuarter('2026-05-01', 4, 1);
    assert.strictEqual(q.quarter, 1);
    assert.strictEqual(q.label, 'FY2027 Q1');
  });

  test('Australia fiscal year (July start)', () => {
    const bounds = getFiscalYearBounds('2026-08-20', 7, 1);
    assert.strictEqual(bounds.startDate, '2026-07-01');
    assert.strictEqual(bounds.endDate, '2027-06-30');
    assert.strictEqual(bounds.fiscalYear, 2027);
  });

  test('getPrevPeriod calculates comparative period correctly', () => {
    const prev = getPrevPeriod('2026-04-01', '2026-04-30');
    assert.strictEqual(prev.endDate, '2026-03-31');
    assert.strictEqual(prev.startDate, '2026-03-02');
  });
});
