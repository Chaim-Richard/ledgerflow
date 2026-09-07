import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { allocateCents } from '../kernel/money/Allocation';

describe('Canonical Money Allocation (Largest Remainder Method)', () => {
  test('conserves exact total cents when dividing 10000 cents across 3 equal 33.33% weights', () => {
    const totalCents = 10000; // $100.00
    const weights = [1 / 3, 1 / 3, 1 / 3];
    const result = allocateCents(totalCents, weights);

    assert.equal(result.length, 3);
    const sum = result.reduce((a, b) => a + b, 0);
    assert.equal(sum, totalCents, 'Sum of allocations must strictly equal total input cents');
    assert.deepEqual(result, [3334, 3333, 3333]);
  });

  test('handles 50/25/25 distribution cleanly', () => {
    const totalCents = 5000; // $50.00
    const weights = [0.5, 0.25, 0.25];
    const result = allocateCents(totalCents, weights);

    assert.equal(result.reduce((a, b) => a + b, 0), totalCents);
    assert.deepEqual(result, [2500, 1250, 1250]);
  });

  test('fallback handles zero weights safely', () => {
    const totalCents = 100;
    const weights = [0, 0];
    const result = allocateCents(totalCents, weights);

    assert.equal(result.reduce((a, b) => a + b, 0), totalCents);
    assert.deepEqual(result, [50, 50]);
  });
});
