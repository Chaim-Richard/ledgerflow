/**
 * A-32 (units on items) and A-34 (consignment stock). Hand-checked: 2 packs of 12 is 24 each;
 * 2 kg is 2000 g; a box is not a kg and the conversion refuses instead of inventing a factor;
 * a supplier's 10 units at $3.50 are $35.00 of consignment in; two directions are summarised apart.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNITS, UNIT_IDS, unit, unitLabel, unitPlural, formatQuantity, sameKind, convertQuantity, singles, packages, lineQuantityLabel, priceUnitLabel,
} from '../lib/units';
import {
  CONSIGNMENT_OPTIONS, consignmentKind, consignmentLabel, consignmentRows, consignmentSummary, consignmentCsvRows, consignmentValueCents, isConsignment,
} from '../lib/consignmentStock';

test('the unit list is a small shared vocabulary with unique ids', () => {
  assert.equal(new Set(UNIT_IDS).size, UNIT_IDS.length);
  assert.ok(UNITS.length >= 20);
  for (const u of UNITS) {
    assert.match(u.id, /^[a-z]+$/);
    assert.ok(u.label && u.plural && u.kind);
  }
  assert.ok(['count', 'weight', 'volume', 'time', 'length'].includes(unit('kg')!.kind));
});

test('a known unit is labelled, an unknown word is shown as it is, nothing is invented', () => {
  assert.equal(unitLabel('kg'), 'kg');
  assert.equal(unitLabel('KG'), 'kg', 'matched case-insensitively');
  assert.equal(unitLabel('sack'), 'sack', 'a word typed before this list existed stays readable');
  assert.equal(unitLabel(''), '');
  assert.equal(unit('sack'), undefined);
  assert.equal(unitPlural('box', 2), 'boxes');
  assert.equal(unitPlural('box', 1), 'box');
  assert.equal(unitPlural('each', 3), 'each');
  assert.equal(formatQuantity(2.5, 'kg'), '2.5 kg');
  assert.equal(formatQuantity(1, 'box'), '1 box');
  assert.equal(formatQuantity(3), '3');
});

test('conversions stay inside a kind and refuse across kinds', () => {
  assert.equal(sameKind('kg', 'g'), true);
  assert.equal(sameKind('kg', 'box'), false);
  assert.equal(convertQuantity(2, 'kg', 'g'), 2000);
  assert.equal(convertQuantity(1000, 'g', 'kg'), 1);
  assert.equal(convertQuantity(1, 'l', 'ml'), 1000);
  assert.equal(convertQuantity(12, 'in', 'cm'), 30.48);
  assert.equal(convertQuantity(2, 'kg', 'box'), undefined, 'no invented factor between kinds');
  assert.equal(convertQuantity(2, 'kg', 'sack'), undefined);
});

test('packages and singles both ways, with a missing conversion meaning one', () => {
  assert.equal(singles(2, 12), 24);
  assert.equal(packages(24, 12), 2);
  assert.equal(singles(3), 3);
  assert.equal(packages(3, 0), 3);
  assert.equal(lineQuantityLabel(2, 'pack', 12), '2 packs (24 each)');
  assert.equal(lineQuantityLabel(2, 'pack'), '2 packs');
  assert.equal(lineQuantityLabel(2, null, 12), '', 'an item with no unit shows nothing extra');
  assert.equal(priceUnitLabel('hour'), 'per hour');
  assert.equal(priceUnitLabel(''), '');
});

test('consignment marks have two directions and one plain empty state', () => {
  assert.deepEqual(CONSIGNMENT_OPTIONS.map(o => o.value), ['', 'from-supplier', 'at-customer']);
  assert.equal(consignmentKind({ consignment: 'from-supplier' }), 'from-supplier');
  assert.equal(consignmentKind({ consignment: 'something-else' }), undefined, 'an unknown mark is not a direction');
  assert.equal(consignmentKind({}), undefined);
  assert.equal(isConsignment({ consignment: 'at-customer' }), true);
  assert.equal(consignmentLabel('at-customer'), 'Ours, held elsewhere');
});

const items = [
  { id: 'i1', name: 'Widgets on consignment', sku: 'W-1', quantityAtHand: 10, unitCostCents: 350, consignment: 'from-supplier', measurementUnit: 'each' },
  { id: 'i2', name: 'Demo unit', sku: 'D-9', quantityAtHand: 1, unitCostCents: 120_000, consignment: 'at-customer' },
  { id: 'i3', name: 'Ordinary stock', sku: 'O-1', quantityAtHand: 5, unitCostCents: 100 },
  { id: 'i4', name: 'More supplier stock', sku: 'W-2', quantityAtHand: 4, unitCostCents: 1000, consignment: 'from-supplier' },
];

test('rows carry direction, quantity and value at cost, and ordinary stock is left out', () => {
  const rows = consignmentRows(items);
  assert.deepEqual(rows.map(r => r.id), ['i4', 'i1', 'i2'], 'the supplier’s stock first, then ours elsewhere');
  assert.deepEqual(rows.map(r => r.valueCents), [4000, 3500, 120_000]);
  assert.equal(rows.find(r => r.id === 'i1')?.directionLabel, 'In (supplier’s)');
  assert.equal(rows.find(r => r.id === 'i2')?.directionLabel, 'Out (ours, elsewhere)');
  assert.equal(rows.some(r => r.id === 'i3'), false);
  assert.equal(consignmentValueCents(items[0]), 3500);
});

test('the summary keeps the two directions apart', () => {
  const summary = consignmentSummary(items);
  assert.equal(summary.items, 3);
  assert.equal(summary.heldCount, 2);
  assert.equal(summary.heldFromSupplierCents, 3500 + 4000);
  assert.equal(summary.atCount, 1);
  assert.equal(summary.atCustomerCents, 120_000);
  assert.equal(summary.totalCents, 127_500);
  assert.deepEqual(consignmentSummary([]), { items: 0, heldFromSupplierCents: 0, heldCount: 0, atCustomerCents: 0, atCount: 0, totalCents: 0 });
});

test('the CSV rows are the screen’s columns in the screen’s order', () => {
  const rows = consignmentCsvRows(items);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], ['Widgets on consignment', 'W-1', 'In (supplier’s)', 10, 'each', 3.5, 35]);
  assert.deepEqual(rows[0][0], 'More supplier stock');
});
