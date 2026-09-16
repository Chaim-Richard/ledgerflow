import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateNextOccurrence } from '../lib/recurringEngine';

describe('Recurring Engine Date Recurrence Matrix', () => {
  it('MONTHLY off the 31st correctly clamps to Feb 28', () => {
    assert.strictEqual(calculateNextOccurrence('2026-01-31', 'monthly'), '2026-02-28');
  });

  it('MONTHLY off the 30th correctly handles Feb 28 and March 30', () => {
    const next1 = calculateNextOccurrence('2026-01-30', 'monthly');
    assert.strictEqual(next1, '2026-02-28');
    const next2 = calculateNextOccurrence('2026-02-28', 'monthly');
    assert.strictEqual(next2, '2026-03-28');
  });

  it('QUARTERLY off the 31st clamps to April 30', () => {
    assert.strictEqual(calculateNextOccurrence('2026-01-31', 'quarterly'), '2026-04-30');
  });

  it('YEARLY off a leap day clamps to non-leap Feb 28', () => {
    assert.strictEqual(calculateNextOccurrence('2028-02-29', 'yearly'), '2029-02-28');
  });

  it('DAILY advances by 1 day cleanly without timezone shifts', () => {
    assert.strictEqual(calculateNextOccurrence('2026-01-31', 'daily'), '2026-02-01');
  });

  it('WEEKLY advances by 7 days cleanly', () => {
    assert.strictEqual(calculateNextOccurrence('2026-01-31', 'weekly'), '2026-02-07');
  });
});
