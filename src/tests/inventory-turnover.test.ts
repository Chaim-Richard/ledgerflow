/**
 * A-192: inventory turnover by item. Hand-checked from a small stock history over 2026-01-01 →
 * 2026-01-31 (31 days):
 * - Widget: opens 100 units worth 40,000; buys 50 for 20,000; sells 110 taking 44,000 of value;
 *   one comes back (return +1, +400); a count writes 5 off (adjustment, −5, −2,000 — issued,
 *   never sold). Closing 36 units, value 40,000+20,000−44,000+400−2,000 = 14,400.
 *   Sold net = 109. Average units = (100+36)/2 = 68 → turnover 109/68 = 1.6029.
 *   Cost of what sold = 44,000−400 = 43,600. Average value = (40,000+14,400)/2 = 27,200 →
 *   value turnover 43,600/27,200 = 1.6029. Days of stock = 31/1.6029 ≈ 19.3.
 * - Gadget: bought and never sold → turnover not applicable (null), never zero.
 * - Ghost: negative closing stock → named, turnover not applicable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryTurnover, turnoverCsvRows } from '../lib/inventoryTurnover';

const move = (kind: string, quantity: number, valueCents: number) => ({
  key: `${kind}-${quantity}`, date: '2026-01-15', kind, quantity, quantityAfter: 0, valueCents, unitCostCents: 400,
});
const details = [
  {
    itemId: 'w', itemName: 'Widget',
    opening: { quantity: 100, valueCents: 40_000 },
    moves: [
      move('purchase', 50, 20_000),
      move('sale', -110, -44_000),
      move('return', 1, 400),
      move('adjustment', -5, -2_000),
    ],
    received: 51, issued: 115,
    closing: { quantity: 36, valueCents: 14_400 },
  },
  {
    itemId: 'g', itemName: 'Gadget',
    opening: { quantity: 0, valueCents: 0 },
    moves: [move('purchase', 10, 5_000)],
    received: 10, issued: 0,
    closing: { quantity: 10, valueCents: 5_000 },
  },
  {
    itemId: 'x', itemName: 'Ghost',
    opening: { quantity: 0, valueCents: 0 },
    moves: [move('sale', -3, -1_200)],
    received: 0, issued: 3,
    closing: { quantity: -3, valueCents: -1_200 },
  },
];
const rows = inventoryTurnover(details as never, '2026-01-01', '2026-01-31');
const byName = (name: string) => rows.find(r => r.itemName === name)!;

test('turnover is what sold over the average held, both in units and in value, by hand', () => {
  const widget = byName('Widget');
  assert.equal(widget.soldQty, 109, '110 sold less the one that came back; the 5 written off are not sales');
  assert.equal(widget.issuedQty, 115, 'issued keeps every reason stock left');
  assert.equal(widget.costOfSoldCents, 43_600);
  assert.equal(widget.averageQty, 68);
  assert.equal(widget.turnoverUnits, 1.6029);
  assert.equal(widget.averageValueCents, 27_200);
  assert.equal(widget.turnoverValue, 1.6029);
  assert.equal(widget.daysOfStock, 19.3);
  assert.equal(widget.note, '');
  assert.equal(rows[0].itemName, 'Widget', 'fastest turning first');
});

test('an item that never sold and an item in negative stock get no invented turnover', () => {
  const gadget = byName('Gadget');
  assert.equal(gadget.soldQty, 0);
  assert.equal(gadget.turnoverUnits, null, 'not zero: there is nothing to divide into');
  assert.equal(gadget.daysOfStock, null);
  const ghost = byName('Ghost');
  assert.equal(ghost.note, 'negative-stock');
  assert.equal(ghost.turnoverUnits, null, 'a negative average would make the ratio a lie');
  const csv = turnoverCsvRows(rows);
  assert.equal(csv.find(r => r[0] === 'Ghost')!.at(-1), 'Stock was negative at the start or end of the period');
});
