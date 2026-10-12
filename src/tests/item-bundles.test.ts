/**
 * A-19 (BF-03): item bundles. Hand-checked: a starter pack of 3 widgets + 1 cable expands to
 * 6 widgets and 2 cables when two packs are chosen; each line keeps the part's own price; a bundle
 * of a bundle, a part listed twice, a missing part and a bundle containing itself are refused with
 * a sentence a person can read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUNDLE_MAX_PARTS, bundleKeepsNoStock, bundlePartChoices, bundleProblem, bundleSummary, bundleValueCents, expandBundle, isBundle,
} from '../lib/itemBundles';

const items = [
  { id: 'widget', name: 'Widget', unitPriceCents: 2500, unitCostCents: 1500, itemType: 'stock' as const },
  { id: 'cable', name: 'Cable', unitPriceCents: 400, unitCostCents: 150, itemType: 'stock' as const },
  { id: 'pack', name: 'Starter pack', unitPriceCents: 0, bundleParts: [{ itemId: 'widget', quantity: 3 }, { itemId: 'cable', quantity: 1 }] },
  { id: 'double', name: 'Double pack', unitPriceCents: 0, bundleParts: [{ itemId: 'pack', quantity: 2 }] },
  { id: 'service', name: 'Setup', unitPriceCents: 10_000, itemType: 'service' as const },
];

test('a bundle is an item with parts', () => {
  assert.equal(isBundle(items[2]), true);
  assert.equal(isBundle(items[0]), false);
  assert.equal(isBundle(undefined), false);
  assert.equal(bundleKeepsNoStock(items[2]), true, 'the parts hold the stock');
  assert.equal(bundleKeepsNoStock(items[0]), false);
});

test('choosing a bundle adds its parts, each at its own price', () => {
  const lines = expandBundle(items[2], 1, items);
  assert.deepEqual(lines, [
    { itemId: 'widget', description: 'Widget', quantity: 3, unitPriceCents: 2500 },
    { itemId: 'cable', description: 'Cable', quantity: 1, unitPriceCents: 400 },
  ]);
});

test('a chosen quantity multiplies every part (two packs: 6 widgets, 2 cables)', () => {
  const lines = expandBundle(items[2], 2, items);
  assert.deepEqual(lines.map(l => [l.itemId, l.quantity]), [['widget', 6], ['cable', 2]]);
  assert.equal(lines[0].unitPriceCents, 2500, 'the price is per part, not per bundle');
});

test('a part that is gone is left out rather than invented', () => {
  const short = { id: 'pack', name: 'Starter pack', bundleParts: [{ itemId: 'widget', quantity: 1 }, { itemId: 'gone', quantity: 1 }] };
  assert.deepEqual(expandBundle(short, 1, items).map(l => l.itemId), ['widget']);
});

test('a quantity of zero or a fraction adds nothing', () => {
  assert.deepEqual(expandBundle(items[2], 0, items), []);
  assert.deepEqual(expandBundle(items[2], 1.5, items), []);
  assert.deepEqual(expandBundle(items[0], 1, items), [], 'a plain item has no parts to expand');
});

test('refusals name the rule in plain words', () => {
  assert.equal(bundleProblem(items[2], [], items), 'A bundle needs at least one part.');
  assert.equal(bundleProblem(items[2], [{ itemId: 'widget', quantity: 0 }], items), 'A part’s quantity must be a positive whole number.');
  assert.equal(bundleProblem(items[2], [{ itemId: 'widget', quantity: 1 }, { itemId: 'widget', quantity: 2 }], items), 'The same part is listed twice; change its quantity instead.');
  assert.equal(bundleProblem(items[2], [{ itemId: 'pack', quantity: 1 }], items), 'A bundle cannot contain itself.');
  assert.equal(bundleProblem(items[2], [{ itemId: 'double', quantity: 1 }], items), 'Bundles do not contain other bundles; add the inner items here instead.');
  assert.equal(bundleProblem(items[2], [{ itemId: 'gone', quantity: 1 }], items), 'A part is not in the item list any more.');
  assert.equal(bundleProblem(items[2], Array.from({ length: BUNDLE_MAX_PARTS + 1 }, (_, i) => ({ itemId: `x${i}`, quantity: 1 })), items), `A bundle can hold at most ${BUNDLE_MAX_PARTS} parts.`);
  assert.equal(bundleProblem(items[2], [{ itemId: 'widget', quantity: 3 }, { itemId: 'cable', quantity: 1 }], items), undefined);
});

test('the parts chooser never offers the bundle itself or another bundle', () => {
  const choices = bundlePartChoices('pack', [items[0], items[1], items[2], items[3]]);
  assert.deepEqual(choices.map(i => i.id), ['widget', 'cable']);
});

test('the summary and the value are display figures from the parts', () => {
  assert.equal(bundleSummary(items[2], items), '3 × Widget, 1 × Cable');
  const gone = { id: 'm', name: 'Many', bundleParts: [{ itemId: 'x', quantity: 1 }, { itemId: 'y', quantity: 2 }] };
  assert.equal(bundleSummary(gone, items), '1 × a removed item, 2 × a removed item');
  assert.equal(bundleSummary({ id: 's', name: 'Service', bundleParts: [{ itemId: 'service', quantity: 1 }] }, items), '1 × Setup');
  assert.deepEqual(bundleValueCents(items[2], items), { priceCents: 3 * 2500 + 400, costCents: 3 * 1500 + 150 });
});
