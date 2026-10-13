/**
 * A-79: barcode scanning for items. Scanner text is cleaned (Enter and Tab are not part of the
 * code), the item is found by its SKU (exact first, then loosely), duplicates are never picked
 * silently, and a fast burst of keys reads as a scanner.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { findItemByBarcode, isScannerBurst, readScan } from '../lib/barcodeScan';

const items = [
  { id: 'a', sku: '5901234123457', name: 'Chair' },
  { id: 'b', sku: 'ABC-100', name: 'Desk' },
  { id: 'c', sku: 'abc-100', name: 'Desk (old label)' },
  { id: 'd', sku: 'LAMP-9', name: 'Lamp' },
  { id: 'e', sku: 'ＬＡＭＰ-9', name: 'Lamp (full width)' },
];

describe('A-79 barcode scanning', () => {
  test('the code is read from scanner text; Enter, Tab and stray control characters are not part of it', () => {
    assert.deepEqual(readScan('5901234123457\r\n'), { ok: true, code: '5901234123457' });
    assert.deepEqual(readScan('  LAMP-9\t'), { ok: true, code: 'LAMP-9' });
  });

  test('empty, non-text and too-long input are refused in plain words', () => {
    assert.equal(readScan('   ').ok, false);
    assert.equal(readScan(undefined).ok, false);
    const long = readScan('X'.repeat(40));
    assert.equal(long.ok, false);
    assert.match(String(!long.ok && long.reason), /at most 32/);
  });

  test('the item with that SKU is found; an unknown code is none', () => {
    const found = findItemByBarcode(items, '5901234123457');
    assert.equal(found.status, 'found');
    assert.equal(found.status === 'found' && found.item.id, 'a');
    assert.deepEqual(findItemByBarcode(items, 'NOPE'), { status: 'none' });
  });

  test('an exact match wins over a loose one', () => {
    const found = findItemByBarcode(items, 'ABC-100');
    assert.equal(found.status === 'found' && found.item.id, 'b');
  });

  test('a code that matches two items only loosely is ambiguous, never picked', () => {
    const three = [{ id: 'x', sku: 'Q-1' }, { id: 'y', sku: 'q-1' }];
    const result = findItemByBarcode(three, 'Q-1');
    assert.equal(result.status, 'found', 'the exact one wins');
    const loose = findItemByBarcode([{ id: 'p', sku: 'q-2' }, { id: 'r', sku: 'Q-2' }], 'q-2');
    assert.equal(loose.status, 'found');
    const twin = findItemByBarcode([{ id: 'p', sku: 'Z-7' }, { id: 'r', sku: 'Z-7' }], 'Z-7');
    assert.equal(twin.status, 'ambiguous');
  });

  test('a full-width code matches the half-width SKU', () => {
    const found = findItemByBarcode(items, 'lamp-9');
    assert.equal(found.status, 'ambiguous', 'LAMP-9 and its full-width twin both match loosely');
  });

  test('a burst of keys is a scanner; slow typing is not', () => {
    assert.equal(isScannerBurst([0, 8, 16, 24, 31, 40]), true);
    assert.equal(isScannerBurst([0, 300, 700, 1200, 1800]), false);
    assert.equal(isScannerBurst([0, 8, 16]), false, 'too short to tell');
  });
});
