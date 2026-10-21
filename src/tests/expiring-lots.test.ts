/**
 * A-113: lots with expiry dates, read from goods receipts. Hand-checked: a lot with several
 * recorded expiry days is judged by the earliest and carries every distinct day; expired rows
 * come first, then by days left; lots without a date and sale-only lots come last; sale units
 * are a reference and never subtracted; the CSV carries every shown column.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPIRING_LOTS_CSV_HEADERS, daysBetween, expiringLotRows, expiringLotsCsvRows,
} from '../lib/expiringLots';

const received = [
  { itemId: 'i1', itemName: 'Milk', lotNumber: 'L1', expiryDate: '2026-10-25', quantity: 10, receiptNumber: 'GR-1', receivedDate: '2026-10-01', vendorName: 'Vendor One' },
  { itemId: 'i1', itemName: 'Milk', lotNumber: 'L1', expiryDate: '2026-10-20', quantity: 5, receiptNumber: 'GR-2', receivedDate: '2026-10-03', vendorName: 'Vendor One' },
  { itemId: 'i1', itemName: 'Milk', lotNumber: 'L9', expiryDate: '2026-10-17', quantity: 2, receiptNumber: 'GR-1', receivedDate: '2026-10-01', vendorName: 'Vendor One' },
  { itemId: 'i2', itemName: 'Flour', lotNumber: 'F1', expiryDate: '2027-01-15', quantity: 20, receiptNumber: 'GR-3', receivedDate: '2026-10-02', vendorName: 'Vendor Two' },
  { itemId: 'i2', itemName: 'Flour', lotNumber: 'F2', quantity: 3, receiptNumber: 'GR-3', receivedDate: '2026-10-02' },
  { itemId: 'i2', itemName: 'Flour', lotNumber: '', quantity: 7, receiptNumber: 'GR-3', receivedDate: '2026-10-02' },
  { itemId: 'i2', itemName: 'Flour', lotNumber: 'F3', expiryDate: 'soon', quantity: 4, receiptNumber: 'GR-3', receivedDate: '2026-10-02' },
];
const sales = [
  { itemId: 'i1', lotNumber: 'L1', quantity: 2, lastDate: '2026-10-19' },
  { itemId: 'i9', lotNumber: 'S1', quantity: 1, lastDate: '2026-10-18' },
];
const rows = () => expiringLotRows(received, sales, '2026-10-20', 30);

test('a lot is judged by its earliest expiry and carries every recorded day', () => {
  const lot = rows().find(r => r.lotNumber === 'L1');
  assert.ok(lot);
  assert.deepEqual(lot.expiryDates, ['2026-10-20', '2026-10-25']);
  assert.equal(lot.daysLeft, 0);
  assert.equal(lot.status, 'expiring');
  assert.equal(lot.receivedQty, 15);
  assert.deepEqual(lot.receiptNumbers, ['GR-1', 'GR-2']);
  assert.deepEqual(lot.receivedFrom, ['Vendor One']);
  assert.equal(lot.firstReceived, '2026-10-01');
  assert.equal(lot.lastReceived, '2026-10-03');
});

test('expired comes first, then by days left; dateless, sale-only and bad-date lots come last', () => {
  const got = rows();
  assert.deepEqual(got.map(r => r.lotNumber), ['L9', 'L1', 'F1', 'F2', 'F3', 'S1']);
  assert.equal(got[0].status, 'expired');
  assert.equal(got[0].daysLeft, -3);
  assert.equal(got.find(r => r.lotNumber === 'F2')?.status, 'no-date');
  assert.equal(got.find(r => r.lotNumber === 'F3')?.status, 'no-date', 'a bad date is not a date');
  const saleOnly = got.find(r => r.lotNumber === 'S1');
  assert.equal(saleOnly?.status, 'sale-only');
  assert.equal(saleOnly?.receivedQty, 0);
  assert.equal(saleOnly?.daysLeft, null);
  assert.ok(!got.some(r => !r.lotNumber), 'a lot-less line is skipped');
});

test('sale units are a reference and never subtracted', () => {
  const lot = rows().find(r => r.lotNumber === 'L1');
  assert.equal(lot?.soldQty, 2);
  assert.equal(lot?.lastSold, '2026-10-19');
  assert.equal(lot?.receivedQty, 15);
});

test('day math is date-only', () => {
  assert.equal(daysBetween('2026-10-20', '2026-10-20'), 0);
  assert.equal(daysBetween('2026-10-20', '2026-10-21'), 1);
  assert.equal(daysBetween('2026-10-21', '2026-10-20'), -1);
});

test('the CSV carries every shown column', () => {
  assert.equal(EXPIRING_LOTS_CSV_HEADERS.length, 12);
  const csv = expiringLotsCsvRows(rows());
  assert.equal(csv.length, 6);
  assert.deepEqual(csv[0].slice(0, 6), ['Milk', 'L9', 'expired', -3, '2026-10-17', 2]);
  assert.equal(csv[0].length, 12);
});
