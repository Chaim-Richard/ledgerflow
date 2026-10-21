/**
 * A-114: stock transfers, read back as the out/in pairs the server wrote (transfer-out then
 * transfer-in: same item, day, quantity and written moment). Hand-checked: the two halves pair
 * by those shared facts, a half whose pair is missing shows alone with the reason, nothing is
 * paired by force, other move kinds are ignored, and the CSV carries every shown column.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STOCK_TRANSFERS_CSV_HEADERS, stockTransfersCsvRows, transferPairs,
} from '../lib/stockTransfers';

const stamp = '2026-10-05T10:00:00.000Z';
const moves = [
  { id: 'out1', workspaceId: 'w1', itemId: 'i1', itemName: 'Widget', date: '2026-10-05', kind: 'transfer-out', quantity: -2, quantityBefore: 10, quantityAfter: 8, seq: 'b1', locationId: 'loc-a', createdAt: stamp },
  { id: 'in1', workspaceId: 'w1', itemId: 'i1', itemName: 'Widget', date: '2026-10-05', kind: 'transfer-in', quantity: 2, quantityBefore: 0, quantityAfter: 2, seq: 'b2', locationId: 'loc-b', createdAt: stamp },
  { id: 'out2', workspaceId: 'w1', itemId: 'i1', itemName: 'Widget', date: '2026-10-06', kind: 'transfer-out', quantity: -1, quantityBefore: 8, quantityAfter: 7, seq: 'b3', locationId: 'loc-b', createdAt: '2026-10-06T09:00:00.000Z' },
  { id: 'sale1', workspaceId: 'w1', itemId: 'i1', itemName: 'Widget', date: '2026-10-06', kind: 'sale', quantity: -1, quantityBefore: 7, quantityAfter: 6, seq: 'b4', locationId: 'loc-a', createdAt: '2026-10-06T11:00:00.000Z' },
  { id: 'in9', workspaceId: 'w1', itemId: 'i2', itemName: 'Gadget', date: '2026-10-04', kind: 'transfer-in', quantity: 3, quantityBefore: 0, quantityAfter: 3, seq: 'b0', locationId: 'loc-c', createdAt: '2026-10-04T08:00:00.000Z' },
];
const label = (id: string) => ({ 'loc-a': 'Shelf A', 'loc-b': 'Shelf B', 'loc-c': 'Shelf C' } as Record<string, string>)[id] || id;

test('the two halves pair by item, day, quantity and written moment, newest first', () => {
  const got = transferPairs(moves as never);
  assert.equal(got.length, 3);
  assert.equal(got[0].complete, false, 'the newest move is the unpaired out2');
  const pair = got.find(p => p.complete);
  assert.ok(pair);
  assert.equal(pair.itemName, 'Widget');
  assert.equal(pair.quantity, 2);
  assert.equal(pair.from, 'loc-a');
  assert.equal(pair.to, 'loc-b');
  assert.equal(pair.date, '2026-10-05');
  assert.equal(pair.createdAt, stamp);
  assert.equal(pair.problem, undefined);
  assert.ok(got.every(p => p.key.indexOf('sale1') === -1), 'a sale is not a transfer');
});

test('a half whose pair is missing shows alone with the reason', () => {
  const got = transferPairs(moves as never);
  const out = got.find(p => p.key === 'out:out2');
  assert.ok(out && !out.complete);
  assert.equal(out.from, 'loc-b');
  assert.equal(out.to, '');
  assert.equal(out.problem, 'Its move-in half is not in the loaded history.');
  const into = got.find(p => p.key === 'in:in9');
  assert.ok(into && !into.complete);
  assert.equal(into.from, '');
  assert.equal(into.to, 'loc-c');
  assert.equal(into.problem, 'Its move-out half is not in the loaded history.');
});

test('two outs on one day never share one in', () => {
  const extra = [...moves, { id: 'out3', workspaceId: 'w1', itemId: 'i1', itemName: 'Widget', date: '2026-10-05', kind: 'transfer-out', quantity: -2, quantityBefore: 8, quantityAfter: 6, seq: 'b5', locationId: 'loc-a', createdAt: stamp }];
  const got = transferPairs(extra as never);
  assert.equal(got.filter(p => p.complete).length, 1, 'only one pair forms');
  assert.equal(got.filter(p => !p.complete).length, 3, 'the extra out shows alone');
});

test('the CSV carries every shown column', () => {
  assert.equal(STOCK_TRANSFERS_CSV_HEADERS.length, 7);
  const csv = stockTransfersCsvRows(transferPairs(moves as never), label);
  assert.equal(csv.length, 3);
  assert.deepEqual(csv[1], ['2026-10-05', 'Widget', 2, 'Shelf A', 'Shelf B', 'yes', '']);
  assert.equal(csv[0].length, 7);
});
