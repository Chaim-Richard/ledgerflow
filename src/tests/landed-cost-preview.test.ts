/**
 * A-63: landed cost preview. Freight and duty are spread by value or by quantity with exact cents
 * (the shares add up to the extra cost), with a plain reason when there is nothing to spread over.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { landedCostPreview, spreadCents, type LandedCostLine } from '../lib/landedCostPreview';

const lines: LandedCostLine[] = [
  { id: 'a', description: 'Motor', quantity: 2, unitCostCents: 5000 },
  { id: 'b', description: 'Bracket', quantity: 10, unitCostCents: 500 },
];

describe('A-63 landed cost preview', () => {
  test('spread by value: each line gets its share of the goods value, to the cent', () => {
    const result = landedCostPreview(lines, 3000, 'value');
    assert.ok(result.ok);
    const [motor, bracket] = result.preview.lines;
    assert.equal(result.preview.goodsCents, 15000, 'goods: 2×5000 + 10×500');
    assert.equal(motor.allocatedCents, 2000, 'two thirds of 3000 (10000 of 15000)');
    assert.equal(bracket.allocatedCents, 1000);
    assert.equal(motor.landedUnitCents, Math.round((10000 + 2000) / 2));
    assert.equal(bracket.landedUnitCents, Math.round((5000 + 1000) / 10));
  });

  test('spread by quantity: units share the costs equally', () => {
    const result = landedCostPreview(lines, 1200, 'quantity');
    assert.ok(result.ok);
    assert.deepEqual(result.preview.lines.map(l => l.allocatedCents), [200, 1000]);
    assert.equal(result.preview.landedCents, 15000 + 1200);
  });

  test('the allocations always add up to the extra cost, even when it does not divide', () => {
    const three = [1, 1, 1].map((q, i) => ({ id: String(i), description: `L${i}`, quantity: q, unitCostCents: 100 }));
    const result = landedCostPreview(three, 100, 'value');
    assert.ok(result.ok);
    const allocated = result.preview.lines.map(l => l.allocatedCents);
    assert.equal(allocated.reduce((s, x) => s + x, 0), 100);
    assert.deepEqual(allocated, [34, 33, 33], 'the leftover cent goes to the earliest line on a tie');
  });

  test('spreadCents is exact for large amounts too', () => {
    const shares = spreadCents(9_007_199_254_740_000, [3, 7, 11]);
    assert.equal(shares.reduce((s, x) => s + x, 0), 9_007_199_254_740_000);
  });

  test('no extra cost gives zero allocations and the goods as the landed cost', () => {
    const result = landedCostPreview(lines, 0, 'value');
    assert.ok(result.ok);
    assert.equal(result.preview.landedCents, result.preview.goodsCents);
    assert.ok(result.preview.lines.every(l => l.allocatedCents === 0));
  });

  test('refused with a plain reason: negative or fractional costs, zero quantities, nothing to spread over', () => {
    const negative = landedCostPreview(lines, -1, 'value');
    assert.equal(negative.ok, false);
    assert.match(String(!negative.ok && negative.problem), /0 or more/);
    const fractional = landedCostPreview(lines, 10.5, 'value');
    assert.equal(fractional.ok, false);
    assert.match(String(!fractional.ok && fractional.problem), /whole cents/);
    const zero = landedCostPreview([{ ...lines[0], quantity: 0 }], 100, 'value');
    assert.equal(zero.ok, false);
    assert.match(String(!zero.ok && zero.problem), /quantity above zero/);
    const free = [{ id: 'f', description: 'Sample', quantity: 4, unitCostCents: 0 }];
    const value = landedCostPreview(free, 500, 'value');
    assert.equal(value.ok, false);
    assert.match(String(!value.ok && value.problem), /spread by quantity instead/);
    assert.ok(landedCostPreview(free, 500, 'quantity').ok, 'spreading by quantity still works for free goods');
    const none = landedCostPreview([], 100, 'value');
    assert.equal(none.ok, false);
    assert.match(String(!none.ok && none.problem), /no lines/);
  });
});
