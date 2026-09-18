import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getLocalDateISO, formatTzDate } from '../lib/utils';
import { getFiscalYearBounds, getFiscalQuarter } from '../lib/fiscalCalendar';
import { calculateNextOccurrence } from '../lib/recurringEngine';

describe('Timezone & Date Determinism Guard', () => {
  it('getLocalDateISO preserves exact local calendar dates without UTC midnight shift', () => {
    const d1 = new Date(2026, 0, 31, 23, 59, 59); // Jan 31 local late night
    const iso1 = getLocalDateISO(d1);
    assert.strictEqual(iso1, '2026-01-31');

    const d2 = new Date(2026, 1, 1, 0, 0, 1); // Feb 1 local early morning
    const iso2 = getLocalDateISO(d2);
    assert.strictEqual(iso2, '2026-02-01');
  });

  it('formatTzDate produces identical YYYY-MM-DD for explicit timezones', () => {
    const target = new Date('2026-06-15T12:00:00Z');
    const auckland = formatTzDate(target, 'Pacific/Auckland');
    const midway = formatTzDate(target, 'Pacific/Midway');
    assert.ok(auckland.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(midway.match(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('fiscalCalendar bounds and quarters remain deterministic across ISO strings', () => {
    const bounds = getFiscalYearBounds('2026-03-31', 1, 1);
    assert.strictEqual(bounds.startDate, '2026-01-01');
    assert.strictEqual(bounds.endDate, '2026-12-31');

    const q = getFiscalQuarter('2026-04-15', 1, 1);
    assert.strictEqual(q.quarter, 2);
    assert.strictEqual(q.startDate, '2026-04-01');
    assert.strictEqual(q.endDate, '2026-06-30');
  });

  it('recurringEngine calculateNextOccurrence produces exact expected recurrence dates', () => {
    const next = calculateNextOccurrence('2026-01-31', 'monthly', 31);
    assert.strictEqual(next, '2026-02-28');
  });
});
