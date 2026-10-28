import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv';
import { normalizeXeroCsv } from '../lib/xeroChartContactsImport';
import { guessMapping, applyMapping, prepareImport, type ImportKind } from '../lib/recordImport';

const fixture = (name: string) => parseCsv(readFileSync(new URL('./fixtures/xero/' + name, import.meta.url), 'utf8'));

function prepared(kind: ImportKind, source: string[][]) {
  const table = normalizeXeroCsv(kind, source);
  return { table, prepared: prepareImport(kind, applyMapping(kind, table.slice(1), guessMapping(kind, table[0]))) };
}

test('E-44 a Xero chart-of-accounts export reads every documented type, YTD never imported', () => {
  const { prepared: result } = prepared('accounts', fixture('chart-of-accounts.csv'));
  assert.deepEqual(result.errors, []);
  const byCode = new Map(result.records.map(r => [r.data.code, r.data]));
  assert.equal(byCode.get('090')?.name, 'Business Bank Account');
  assert.equal(byCode.get('090')?.type, 'asset');
  assert.equal(byCode.get('090')?.category, 'Cash', 'Bank parses to a cash account');
  assert.equal(byCode.get('710')?.type, 'asset');
  assert.equal(byCode.get('710')?.category, 'Fixed Assets');
  assert.equal(byCode.get('800')?.type, 'liability', 'Xero "Liability" maps to liability');
  assert.equal(byCode.get('200')?.type, 'revenue', 'Xero "Revenue" maps to revenue');
  assert.equal(byCode.get('429')?.type, 'expense', 'Xero "Depreciation" parses as an expense account');
  assert.equal(byCode.get('300')?.type, 'equity');
  assert.ok(result.records.every(r => !('balanceCents' in r.data) && !('balance' in r.data)), 'no balance or YTD figure is carried');
  assert.ok(result.records.every(r => String(r.data.currency || '') === ''), 'no invented account currency');
});

test('E-44 Xero contacts read into customers with the PO address and tax number', () => {
  const { prepared: result } = prepared('customers', fixture('contacts.csv'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 3);
  const acme = result.records[0].data;
  assert.equal(acme.name, 'Acme Ltd');
  assert.equal(acme.email, 'acme@example.com');
  assert.equal(acme.phone, '+972-3-555-0101');
  assert.equal(acme.address, '1 Herzl St, Floor 2, Tel Aviv, Tel Aviv, 6100001, Israel');
  assert.equal(acme.taxId, '516123456', 'TaxNumber lands in the tax ID field');
  const miriam = result.records[2].data;
  assert.equal(miriam.phone, '059555303', 'MobileNumber is used when there is no PhoneNumber');
  assert.equal(miriam.address, undefined, 'a blank Xero address stays out of the record');
});

test('E-44 the same Xero contacts file reads as vendors when the screen says vendors', () => {
  const { prepared: result } = prepared('vendors', fixture('contacts.csv'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 3);
  assert.equal(result.records[0].data.name, 'Acme Ltd');
  assert.equal(result.records[0].data.taxId, '516123456');
});

test('E-44 a header with a starred required column and an unstarred one are both found', () => {
  const table = normalizeXeroCsv('accounts', [
    ['*Code', 'Name', '*Type', 'Tax Code', 'Description'],
    ['100', 'Test Income', 'Revenue', 'Tax on Sales', 'row'],
  ]);
  assert.deepEqual(table[1].slice(0, 3), ['Test Income', '100', 'Revenue']);
});

test('E-44 a file that is not the documented Xero layout fails the required-name check rather than guessing', () => {
  const { prepared: result } = prepared('accounts', fixture('sales-invoices.csv'));
  assert.ok(result.errors.length > 0, 'an invoice export is not a chart of accounts — rows are named with their problems');
});
