import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv';
import { normalizeZohoBooksCsv } from '../lib/zohoBooksImport';
import { guessMapping, applyMapping, prepareImport, type ImportKind } from '../lib/recordImport';

const fixture = (name: string) => parseCsv(readFileSync(new URL('./fixtures/zoho/' + name, import.meta.url), 'utf8'));

function prepared(kind: ImportKind, source: string[][]) {
  const table = normalizeZohoBooksCsv(kind, source);
  return { table, prepared: prepareImport(kind, applyMapping(kind, table.slice(1), guessMapping(kind, table[0]))) };
}

test('E-46 Zoho customers keep display name, company-less person, billing address and terms', () => {
  const { prepared: result } = prepared('customers', fixture('customers.csv'));
  assert.deepEqual(result.errors, []);
  const [acme, aya] = result.records.map(r => r.data);
  assert.equal(acme.name, 'Acme Trading');
  assert.equal(acme.email, 'office@acme.example');
  assert.equal(acme.phone, '+972-3-555-0111');
  assert.equal(acme.address, '5 Dizengoff St, Suite 4, Tel Aviv, Tel Aviv, 6433001, Israel');
  assert.equal(acme.currency, 'ILS');
  assert.equal(acme.website, 'acme.example');
  assert.equal(String(acme.paymentTerms), 'Net 30');
  assert.equal(aya.name, 'North Wind Studio');
  assert.equal(aya.address, '1200 Broadway, New York, NY, 10001, US');
});

test('E-46 Zoho vendors read email, phone, billing address and tax number', () => {
  const { prepared: result } = prepared('vendors', fixture('vendors.csv'));
  assert.deepEqual(result.errors, []);
  const [paper, snacks] = result.records.map(r => r.data);
  assert.equal(paper.name, 'Paper World Ltd');
  assert.equal(paper.email, 'orders@paperworld.example');
  assert.equal(paper.address, '12 Haifa Rd, Haifa, Haifa, 3100001, Israel');
  assert.equal(paper.taxId, '515987654');
  assert.equal(snacks.name, 'City Office Snacks');
  assert.equal(snacks.taxId, undefined, 'a blank Zoho tax number stays out of the record');
});

test('E-46 Zoho chart of accounts maps documented types; a Zoho-specific type is a named row error', () => {
  const { prepared: result } = prepared('accounts', fixture('chart-of-accounts.csv'));
  const byCode = new Map(result.records.map(r => [r.data.code, r.data]));
  assert.equal(byCode.get('1010')?.type, 'asset');
  assert.equal(byCode.get('1010')?.category, 'Cash');
  assert.equal(byCode.get('1020')?.category, 'Cash');
  assert.equal(byCode.get('1100')?.category, 'Accounts Receivable');
  assert.equal(byCode.get('2000')?.category, 'Accounts Payable');
  assert.equal(byCode.get('1200')?.type, 'asset', 'Other Current Asset → asset');
  assert.equal(byCode.get('4000')?.type, 'revenue');
  assert.equal(byCode.get('5000')?.type, 'cost_of_goods');
  assert.equal(byCode.get('6100')?.type, 'expense');
  // "Payment Clearing Account" is Zoho-specific: the row is refused with its problem named, never reclassified
  assert.ok(result.errors.some(e => e.row === 10 && /Payment Clearing Account/.test(e.message)), JSON.stringify(result.errors));
  const rowNumbersWithError = new Set(result.errors.map(e => e.row));
  assert.deepEqual([...rowNumbersWithError], [10], 'exactly one row refused');
});

test('E-46 Zoho items carry catalogue prices but never stage opening stock', () => {
  const { table, prepared: result } = prepared('items', fixture('items.csv'));
  assert.deepEqual(result.errors, []);
  assert.equal(table[1][5], '', 'quantity on hand column is empty by design');
  const [consult, paper] = result.records.map(r => r.data);
  assert.equal(consult.name, 'Consulting Hour');
  assert.equal(consult.unitPriceCents, 15000);
  assert.equal(consult.unitCostCents, 0);
  assert.equal(consult.quantityAtHand, 0);
  assert.equal(paper.unitCostCents, 2500);
  assert.equal(paper.reorderPoint, 20);
  assert.equal(paper.measurementUnit, 'box');
});
