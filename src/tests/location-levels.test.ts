/**
 * A-115: minimum/maximum stock per location. Hand-checked: the level validator accepts whole
 * units only with the maximum at least the minimum; the saved JSON parses back dropping invalid
 * rows; a location split is used only when the history proves it (it explains the item and starts
 * from zero); below-minimum locations suggest a top-up to the maximum in whole packages, priced
 * and grouped like the global suggestions; unprovable items are unplaced, never suggested; items
 * without levels and service/consignment items are left out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  levelProblem, locationOnHand, locationReorderSuggestions, parseLocationLevelsJson,
} from '../lib/locationLevels';

test('levels are whole units, nothing below zero, maximum at least the minimum', () => {
  assert.equal(levelProblem('', ''), null);
  assert.equal(levelProblem('4', '10'), null);
  assert.equal(levelProblem('0', '0'), null);
  assert.equal(levelProblem('1.5', '10'), 'The minimum is whole units, 0 or more.');
  assert.equal(levelProblem('-1', '10'), 'The minimum is whole units, 0 or more.');
  assert.equal(levelProblem('4', ''), 'The maximum is whole units, 0 or more.');
  assert.equal(levelProblem('11', '10'), 'The maximum cannot be below the minimum.');
});

test('the saved JSON parses back, dropping rows that are not valid levels', () => {
  assert.deepEqual(parseLocationLevelsJson('{"loc-a":{"min":4,"max":10}}'), { 'loc-a': { min: 4, max: 10 } });
  assert.deepEqual(parseLocationLevelsJson(''), {});
  assert.deepEqual(parseLocationLevelsJson('nope'), {});
  assert.deepEqual(parseLocationLevelsJson('{"loc-a":{"min":11,"max":10},"loc-b":{"min":2,"max":6}}'), { 'loc-b': { min: 2, max: 6 } });
  assert.deepEqual(parseLocationLevelsJson('{"loc-a":{"min":"4","max":10}}'), {});
});

const move = (over: Record<string, unknown>) => ({
  workspaceId: 'w1', itemId: 'i1', date: '2026-10-01', kind: 'purchase',
  quantity: 0, quantityBefore: 0, quantityAfter: 0, seq: 'a', locationId: 'loc-a', ...over,
});

test('the split is used only when the history proves it', () => {
  assert.deepEqual(locationOnHand({ quantityAtHand: 0 }, [] as never), { at: [], provable: true });
  const ghost = locationOnHand({ quantityAtHand: 5 }, [] as never);
  assert.equal(ghost.provable, false);
  assert.match(ghost.reason || '', /before the stock history/);
  const late = locationOnHand(
    { name: 'Widget', quantityAtHand: 5 },
    [move({ quantity: 3, quantityBefore: 2, quantityAfter: 5 })] as never,
  );
  assert.equal(late.provable, false);
  assert.match(late.reason || '', /starts before the ledger/);
  const broken = locationOnHand(
    { name: 'Widget', quantityAtHand: 5 },
    [move({ quantity: 3, quantityBefore: 0, quantityAfter: 3 })] as never,
  );
  assert.equal(broken.provable, false, 'history ends at 3 but 5 are on hand');
});

const history = [
  move({ seq: 'a', date: '2026-10-01', kind: 'purchase', quantity: 6, quantityBefore: 0, quantityAfter: 6, locationId: 'loc-a' }),
  move({ seq: 'b', date: '2026-10-02', kind: 'transfer-out', quantity: -2, quantityBefore: 6, quantityAfter: 4, locationId: 'loc-a' }),
  move({ seq: 'c', date: '2026-10-02', kind: 'transfer-in', quantity: 2, quantityBefore: 4, quantityAfter: 6, locationId: 'loc-b' }),
  move({ seq: 'd', date: '2026-10-03', kind: 'sale', quantity: -1, quantityBefore: 6, quantityAfter: 5, locationId: 'loc-a' }),
];
const item = {
  id: 'i1', name: 'Widget', sku: 'WDG', measurementUnit: 'pcs', unitCostCents: 500,
  quantityAtHand: 5, locationLevels: { 'loc-a': { min: 4, max: 10 }, 'loc-b': { min: 2, max: 6 } },
};
const bills = [{ vendorId: 'v1', date: '2026-09-01', splits: [{ itemId: 'i1', quantity: 10, amountCents: 10000 }] }];
const vendors = [{ id: 'v1', name: 'Vendor One' }];
const locationName = (id: string) => ({ 'loc-a': 'Shelf A', 'loc-b': 'Shelf B' } as Record<string, string>)[id] || id;

test('below-minimum locations suggest a top-up to the maximum, priced and grouped as usual', () => {
  const { groups, unplaced } = locationReorderSuggestions({
    items: [item] as never, movesByItem: new Map([['i1', history as never]]),
    bills, orders: [], vendors, locationName,
  });
  assert.deepEqual(unplaced, []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].vendorName, 'Vendor One');
  assert.equal(groups[0].lines.length, 1, 'Shelf B sits exactly on its minimum');
  const line = groups[0].lines[0];
  assert.equal(line.locationId, 'loc-a');
  assert.equal(line.locationName, 'Shelf A');
  assert.equal(line.onHand, 3);
  assert.equal(line.reorderPoint, 4);
  assert.equal(line.maxLevel, 10);
  assert.equal(line.suggestedQuantity, 7);
  assert.equal(line.unitCostCents, 1000);
  assert.equal(line.costSource, 'vendor-history');
});

test('the top-up rounds up to whole packages', () => {
  const packed = { ...item, unitsPerPackage: 6 };
  const { groups } = locationReorderSuggestions({
    items: [packed] as never, movesByItem: new Map([['i1', history as never]]),
    bills, orders: [], vendors, locationName,
  });
  assert.equal(groups[0].lines[0].suggestedQuantity, 12);
});

test('unprovable items are unplaced with the reason, never suggested', () => {
  const { groups, unplaced } = locationReorderSuggestions({
    items: [{ ...item, id: 'i2', name: 'Ghost' }] as never, movesByItem: new Map(),
    bills, orders: [], vendors, locationName,
  });
  assert.deepEqual(groups, []);
  assert.equal(unplaced.length, 1);
  assert.equal(unplaced[0].itemId, 'i2');
  assert.match(unplaced[0].reason, /before the stock history/);
});

test('items without levels, service items and consignment items are left out', () => {
  const { groups, unplaced } = locationReorderSuggestions({
    items: [
      { ...item, id: 'plain', locationLevels: {} },
      { ...item, id: 'svc', itemType: 'service' },
      { ...item, id: 'con', consignment: 'x' },
    ] as never,
    movesByItem: new Map([['plain', history as never], ['svc', history as never], ['con', history as never]]),
    bills, orders: [], vendors, locationName,
  });
  assert.deepEqual(groups, []);
  assert.deepEqual(unplaced, []);
});
