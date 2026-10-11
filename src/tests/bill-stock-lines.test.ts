/**
 * The item lines of a bill (J-08, BA-03): each item line's value is its share of what the bill posts;
 * a line spread over the items is added to them in proportion to their values (or their units when
 * they have none), in whole cents that add up exactly; without item lines nothing is spread.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { billItemProblem, billStockLines } from '../lib/billStock';

test('item lines with their shares; landed cost spread by value, exactly', () => {
  const splits = [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 1 }, { landedCost: true }, {}];
  assert.deepEqual(billStockLines(splits, [3000, 1000, 101, 999]), [
    { itemId: 'a', quantity: 2, valueCents: 3076, line: 0 },
    { itemId: 'b', quantity: 1, valueCents: 1025, line: 1 },
  ], '101 cents spread 3:1 → 76 and 25, nothing lost');
  assert.deepEqual(billStockLines([{ itemId: 'a', quantity: 3 }, { itemId: 'b', quantity: 1 }, { landedCost: true }], [0, 0, 400]).map(l => l.valueCents), [300, 100], 'by units when the items cost nothing');
  assert.deepEqual(billStockLines([{ landedCost: true }, {}], [500, 100]), [], 'no items: nothing to spread');
});

test('an item line needs its units and an amount', () => {
  assert.equal(billItemProblem({ itemId: 'a', quantity: 2, amountCents: 100 }), null);
  assert.equal(billItemProblem({ amountCents: 100 }), null, 'not an item line');
  assert.match(String(billItemProblem({ itemId: 'a', amountCents: 100 })), /how many units/);
  assert.match(String(billItemProblem({ itemId: 'a', quantity: 1 })), /cost/);
  assert.match(String(billItemProblem({ itemId: 'a', quantity: 0.1234567, amountCents: 1 })), /Six decimals/);
});
