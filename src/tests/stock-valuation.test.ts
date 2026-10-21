/**
 * A-117: stock valuation by location and by lot, against figures worked by hand. Cents.
 *
 * By location (the stock-moves ledger, valued as Inventory Valuation values it — ISS-131):
 *   widget: bought 10 for 5,000 into L1; transferred 4 (2,000) L1 → L2; sold 3 (1,500) from L1
 *     → L1 3 units / 1,500; L2 4 units / 2,000; item 7 / 3,500
 *   gadget: history starts at 5 → unknown with the reason, never split
 *   odd: sold 2 from nothing → negative stock, valued 0 in the total, location rows as booked
 * By lot (goods receipts keep the lot and the price it arrived at):
 *   lot L-A: 10 received at 500 and 5 at 600 → 15 received / 8,000, average 533; 3 recorded at sale
 *   on-hand per lot is never computed (the stock ledger does not track lots)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  valuationByLocation, valuationByLots, stockValueLocationCsvRows, stockValueLotCsvRows,
  LOT_ON_HAND_LIMIT, NO_LOCATION, type LotReceiptLine, type LotSaleRef,
} from '../lib/stockValuation';
import { itemDetails, type StockMove } from '../lib/stockMoves';

let seq = 0;
const move = (over: Partial<StockMove> & { quantity: number; quantityBefore: number }): StockMove => ({
  workspaceId: 'ws', itemId: 'widget', date: '2026-01-05', kind: 'purchase',
  quantityAfter: over.quantityBefore + over.quantity, unitCostCents: 0, valueCents: 0,
  seq: `2026-01-01T00:00:00Z-${String(++seq).padStart(4, '0')}`, uid: 'u', createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const widgetMoves: StockMove[] = [
  move({ itemId: 'widget', date: '2026-01-05', kind: 'purchase', quantity: 10, quantityBefore: 0, quantityAfter: 10, unitCostCents: 500, valueCents: 5_000, locationId: 'L1' }),
  move({ itemId: 'widget', date: '2026-01-10', kind: 'transfer-out', quantity: -4, quantityBefore: 10, quantityAfter: 6, unitCostCents: 500, valueCents: -2_000, locationId: 'L1' }),
  move({ itemId: 'widget', date: '2026-01-10', kind: 'transfer-in', quantity: 4, quantityBefore: 6, quantityAfter: 10, unitCostCents: 500, valueCents: 2_000, locationId: 'L2' }),
  move({ itemId: 'widget', date: '2026-01-15', kind: 'sale', quantity: -3, quantityBefore: 10, quantityAfter: 7, unitCostCents: 500, valueCents: -1_500, locationId: 'L1' }),
];
const gadgetMoves: StockMove[] = [
  move({ itemId: 'gadget', date: '2026-01-05', kind: 'purchase', quantity: 3, quantityBefore: 5, quantityAfter: 8, unitCostCents: 200, valueCents: 600 }),
];
const oddMoves: StockMove[] = [
  move({ itemId: 'odd', date: '2026-01-05', kind: 'sale', quantity: -2, quantityBefore: 0, quantityAfter: -2, unitCostCents: 400, valueCents: -800, locationId: 'L1' }),
];
const items = [
  { id: 'widget', name: 'Widget', quantityAtHand: 7 },
  { id: 'gadget', name: 'Gadget', quantityAtHand: 8 },
  { id: 'odd', name: 'Odd', quantityAtHand: -2 },
];
const toToday = itemDetails([...widgetMoves, ...gadgetMoves, ...oddMoves], '1900-01-01', '2026-12-31');

test('A-117 by location: the widget is L1 3 / 1,500 and L2 4 / 2,000 at 31 Jan; the item is 7 / 3,500', () => {
  const report = valuationByLocation({ asOf: '2026-01-31', items, toToday });
  const widget = report.items.find(i => i.itemId === 'widget');
  assert.ok(widget);
  assert.equal(widget.valueCents, 3_500);
  assert.deepEqual(widget.rows.map(r => [r.locationId, r.quantity, r.valueCents, r.unitCostCents]), [
    ['L1', 3, 1_500, 500],
    ['L2', 4, 2_000, 500],
  ]);
  assert.deepEqual(report.byLocation.map(t => [t.locationId, t.quantity, t.valueCents]), [
    ['L1', 1, 1_500 - 800], // L1 also holds the odd item's booked row (−800)
    ['L2', 4, 2_000],
  ]);
  assert.equal(report.knownValueCents, 3_500 + 0, 'the odd item is valued at 0; gadget is unknown');
  assert.equal(report.complete, false);
  assert.equal(report.unknownItems, 1);
});

test('A-117 by location: an item its history does not explain is unknown with the reason, never split', () => {
  const report = valuationByLocation({ asOf: '2026-01-31', items, toToday });
  const gadget = report.items.find(i => i.itemId === 'gadget');
  assert.ok(gadget);
  assert.equal(gadget.quantity, null);
  assert.equal(gadget.valueCents, null);
  assert.deepEqual(gadget.rows, []);
  assert.match(gadget.unknownReason || '', /starts at 5 units/);
});

test('A-117 by location: negative stock is valued 0 with a note; a move with no location is its own row', () => {
  const report = valuationByLocation({ asOf: '2026-01-31', items, toToday });
  const odd = report.items.find(i => i.itemId === 'odd');
  assert.ok(odd);
  assert.equal(odd.quantity, -2);
  assert.equal(odd.valueCents, 0);
  assert.match(odd.note || '', /valued at 0/);
  assert.deepEqual(odd.rows.map(r => [r.locationId, r.quantity, r.valueCents]), [['L1', -2, -800]]);
  assert.equal(report.negativeStockItems, 1);

  const unplaced = valuationByLocation({
    asOf: '2026-01-31',
    items: [{ id: 'g', name: 'G', quantityAtHand: 3 }],
    toToday: itemDetails([move({ itemId: 'g', date: '2026-01-05', kind: 'purchase', quantity: 3, quantityBefore: 0, quantityAfter: 3, unitCostCents: 100, valueCents: 300 })], '1900-01-01', '2026-12-31'),
  });
  assert.deepEqual(unplaced.items[0].rows.map(r => [r.locationId, r.quantity]), [[NO_LOCATION, 3]]);
});

test('A-117 by lot: 15 received / 8,000 at an average 533, 3 recorded at sale, on-hand never computed', () => {
  const received: LotReceiptLine[] = [
    { itemId: 'widget', itemName: 'Widget', lotNumber: 'L-A', expiryDate: '2027-06-30', quantity: 10, unitPriceCents: 500, receiptNumber: 'R1', vendorName: 'Vendor V', receivedDate: '2026-01-05' },
    { itemId: 'widget', itemName: 'Widget', lotNumber: 'L-A', quantity: 5, unitPriceCents: 600, receiptNumber: 'R2', vendorName: 'Vendor V', receivedDate: '2026-01-20' },
    { itemId: 'widget', itemName: 'Widget', lotNumber: 'L-B', quantity: 4, unitPriceCents: 250, receiptNumber: 'R3', receivedDate: '2026-02-01' },
  ];
  const sales: LotSaleRef[] = [
    { itemId: 'widget', lotNumber: 'L-A', quantity: 3, lastDate: '2026-01-25' },
    { itemId: 'widget', lotNumber: 'SALE-ONLY', quantity: 2, lastDate: '2026-01-26' },
  ];
  const lots = valuationByLots(received, sales);
  assert.equal(lots.rows.length, 2, 'a lot only ever recorded at sale is not a received lot');
  const la = lots.rows.find(r => r.lotNumber === 'L-A');
  assert.ok(la);
  assert.deepEqual([la.receivedQty, la.receivedValueCents, la.unitCostCents, la.soldQty], [15, 8_000, 533, 3]);
  assert.deepEqual(la.expiryDates, ['2027-06-30']);
  assert.deepEqual(la.receiptNumbers, ['R1', 'R2']);
  assert.deepEqual(la.vendors, ['Vendor V']);
  assert.equal(la.onHandQuantity, null, 'on-hand per lot is not tracked and is never computed');
  assert.equal(lots.rows.find(r => r.lotNumber === 'L-B')?.receivedValueCents, 1_000);
  assert.equal(lots.receivedValueCents, 9_000);
  assert.equal(lots.limit, LOT_ON_HAND_LIMIT);
  assert.match(lots.limit, /not a stock-on-hand value/);
});

test('A-117 CSV rows say the on-hand column is not tracked and carry the worked values', () => {
  const lots = valuationByLots(
    [{ itemId: 'widget', itemName: 'Widget', lotNumber: 'L-A', quantity: 10, unitPriceCents: 500, receiptNumber: 'R1', receivedDate: '2026-01-05' }],
    [],
  );
  const csv = stockValueLotCsvRows(lots.rows);
  assert.deepEqual(csv[0].slice(0, 6), ['Widget', 'L-A', '', 10, '50.00', '5.00']);
  assert.equal(csv[0][csv[0].length - 1], 'not tracked');

  const report = valuationByLocation({ asOf: '2026-01-31', items, toToday });
  const loc = stockValueLocationCsvRows(report.items);
  assert.ok(loc.some(r => r[0] === 'Widget' && r[1] === 'L1' && r[2] === 3 && r[3] === '15.00'), JSON.stringify(loc));
  assert.ok(loc.some(r => r[0] === 'Gadget' && String(r[5]).includes('starts at 5')), JSON.stringify(loc));
});
