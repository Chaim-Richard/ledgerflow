import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv';
import { normalizeWaveCsv } from '../lib/waveImport';
import { guessMapping, applyMapping, prepareImport, type ImportKind } from '../lib/recordImport';

const fixture = (name: string) => parseCsv(readFileSync(new URL('./fixtures/wave/' + name, import.meta.url), 'utf8'));

function prepared(kind: ImportKind, source: string[][]) {
  const table = normalizeWaveCsv(kind, source);
  return { table, prepared: prepareImport(kind, applyMapping(kind, table.slice(1), guessMapping(kind, table[0]))) };
}

test('E-45 a Wave customers CSV reads names, phones, address, currency and notes', () => {
  const { prepared: result } = prepared('customers', fixture('customers.csv'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 2);
  const [delta, maya] = result.records.map(r => r.data);
  assert.equal(delta.name, 'Delta Bakery');
  assert.equal(delta.email, 'delta@example.com');
  assert.equal(delta.phone, '+1-716-555-0100');
  assert.equal(delta.address, '41 Main St, Buffalo, New York, 14203, US');
  assert.equal(delta.currency, 'USD');
  assert.equal(delta.notes, 'Net 15 by email');
  // a person-only customer: first+last name, mobile phone, Hebrew notes kept as-is
  assert.equal(maya.name, 'Maya Levi');
  assert.equal(maya.phone, '+972-50-555-0188');
  assert.equal(maya.notes, 'שבתיח');
});

test('E-45 only the documented customers export is normalised; other kinds pass through untouched', () => {
  const source = [['Account Type', 'Account Name'], ['Expected Payments from Customers', 'Acme']];
  const table = normalizeWaveCsv('accounts', source);
  assert.deepEqual(table, source.map(row => [...row]), 'Wave chart CSVs keep their headers for the standard spreadsheet review');
  const result = prepareImport('accounts', applyMapping('accounts', [['a b', '1'], ['1', '2']], { name: 1, code: -1, type: 0, category: -1, subtype: -1, description: -1, currency: -1 }));
  assert.ok(result, 'the standard path still governs validation');
});

test('E-45 a Wave shape missing every name column surfaces as row problems, not defaults', () => {
  const { prepared: result } = prepared('customers', [
    ['Email', 'Phone'],
    ['nobody@example.com', '555'],
  ]);
  assert.equal(result.records.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /Name is missing/);
});
