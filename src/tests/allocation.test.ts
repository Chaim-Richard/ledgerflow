import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { allocateCents } from '../kernel/money/Allocation';
import { validateSplitAllocations } from '../lib/dimensionUtils';
import fc from 'fast-check';

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

  test('property: sum of allocateCents strictly equals total cents under any weights', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000000, max: 10000000 }),
        fc.array(fc.double({ min: 0, max: 100000 }), { minLength: 1, maxLength: 50 }),
        (totalCents, weights) => {
          const result = allocateCents(totalCents, weights);
          assert.equal(result.length, weights.length);
          const sum = result.reduce((a, b) => a + b, 0);
          assert.equal(sum, totalCents, `Allocation sum ${sum} must equal total ${totalCents}`);
        }
      )
    );
  });

  test('property: validateSplitAllocations behavior invariants', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            weight: fc.oneof(
              fc.double(),
              fc.constant(NaN),
              fc.constant(Infinity),
              fc.constant(-Infinity)
            ),
            dimensions: fc.constant({})
          }),
          { maxLength: 10 }
        ),
        (splits) => {
          const result = validateSplitAllocations(splits);
          const sum = splits.reduce((acc, s) => acc + (s.weight || 0), 0);
          const hasInvalidWeight = splits.some(s => typeof s.weight !== 'number' || isNaN(s.weight) || s.weight < 0 || s.weight > 1.0);

          if (result.valid) {
            assert.equal(hasInvalidWeight, false, "Should not be valid if splits has invalid weight");
            assert.ok(Math.abs(result.sum - 1.0) <= 0.001, "Valid splits must sum to approximately 1.0");
          } else {
            assert.ok(hasInvalidWeight || Math.abs(sum - 1.0) > 0.001, "Invalid splits must fail weight range or sum validation");
          }
        }
      )
    );
  });
});
