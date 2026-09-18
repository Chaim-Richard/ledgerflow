import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateNextOccurrence } from '../lib/recurringEngine';

describe('Recurring Engine Date Recurrence Matrix', () => {
  it('MONTHLY off the 31st correctly clamps to Feb 28 and recovers anchor 31 for March, April, May', () => {
    const anchor = 31;
    const hop1 = calculateNextOccurrence('2026-01-31', 'monthly', anchor);
    assert.strictEqual(hop1, '2026-02-28');
    const hop2 = calculateNextOccurrence(hop1, 'monthly', anchor);
    assert.strictEqual(hop2, '2026-03-31');
    const hop3 = calculateNextOccurrence(hop2, 'monthly', anchor);
    assert.strictEqual(hop3, '2026-04-30');
    const hop4 = calculateNextOccurrence(hop3, 'monthly', anchor);
    assert.strictEqual(hop4, '2026-05-31');
  });

  it('QUARTERLY off the 31st (two hops): 2026-01-31 -> 2026-04-30 -> 2026-07-31', () => {
    const anchor = 31;
    const hop1 = calculateNextOccurrence('2026-01-31', 'quarterly', anchor);
    assert.strictEqual(hop1, '2026-04-30');
    const hop2 = calculateNextOccurrence(hop1, 'quarterly', anchor);
    assert.strictEqual(hop2, '2026-07-31');
  });

  it('YEARLY off a leap day clamps to non-leap Feb 28', () => {
    assert.strictEqual(calculateNextOccurrence('2028-02-29', 'yearly', 29), '2029-02-28');
  });

  it('DAILY advances by 1 day cleanly without timezone shifts', () => {
    assert.strictEqual(calculateNextOccurrence('2026-01-31', 'daily', 31), '2026-02-01');
  });

  it('WEEKLY advances by 7 days cleanly', () => {
    assert.strictEqual(calculateNextOccurrence('2026-01-31', 'weekly', 31), '2026-02-07');
  });
});
