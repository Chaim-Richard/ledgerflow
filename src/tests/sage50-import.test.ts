import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv';
import { normalizeSage50Csv } from '../lib/sage50Import';
import { guessMapping, applyMapping, prepareImport, type ImportKind } from '../lib/recordImport';

const fixture = (name: string) => parseCsv(readFileSync(new URL('./fixtures/sage/' + name, import.meta.url), 'utf8'));

function prepared(kind: ImportKind, source: string[][]) {
  const table = normalizeSage50Csv(kind, source);
  return { table, prepared: prepareImport(kind, applyMapping(kind, table.slice(1), guessMapping(kind, table[0]))) };
}

test('E-47 Sage CHART.CSV translates every documented numeric type; Current Balance is never imported', () => {
  const { table, prepared: result } = prepared('accounts', fixture('chart.csv'));
  assert.equal(table[0].includes('Current Balance'), false, 'the export-only balance column is dropped');
  const byCode = new Map(result.records.map(r => [r.data.code, r.data]));
  assert.equal(byCode.get('10100')?.name, 'Operating Checking');
  assert.equal(byCode.get('10100')?.category, 'Cash', 'type 0 = Cash');
  assert.equal(byCode.get('11000')?.category, 'Accounts Receivable', 'type 1 = Accounts Receivable');
  assert.equal(byCode.get('14000')?.category, 'Inventory', 'type 2 = Inventory');
  assert.equal(byCode.get('15000')?.category, 'Fixed Assets', 'type 5 = Fixed Assets');
  assert.equal(byCode.get('20000')?.category, 'Accounts Payable', 'type 10 = Accounts Payable');
  assert.equal(byCode.get('23100')?.type, 'liability', 'type 14 = Long Term Liabilities');
  assert.equal(byCode.get('30000')?.type, 'equity', 'type 16 = Equity');
  assert.equal(byCode.get('4000-01')?.type, 'revenue', 'type 21 = Income');
  assert.equal(byCode.get('50000')?.type, 'cost_of_goods', 'type 23 = Cost of Sales');
  assert.equal(byCode.get('60000')?.type, 'expense', 'type 24 = Expenses');
  // type 6 = Accumulated Depreciation has no LedgerFlow counterpart: its row is refused for fixing
  assert.deepEqual(result.errors, [{ row: 6, field: 'type', message: 'Type is missing' }], 'only the contra-account row is refused');
  assert.ok(result.records.every(r => !('balanceCents' in r.data)), 'no exported balance lands in the chart');
});

test('E-47 an undocumented numeric type code stays blank and refused, never reclassified', () => {
  const { prepared: result } = prepared('accounts', [
    ['Account ID', 'Account Description', 'Account Type'],
    ['19999', 'Retainage Receivable', '3'],
    ['77777', 'Invented Code', '99'],
  ]);
  assert.equal(result.records.length, 0);
  assert.deepEqual(result.errors.map(e => e.row), [2, 3], 'both refuse with a visible problem');
});

test('E-47 Sage CUSTOMER.CSV reads contact, address, status and web site', () => {
  const { prepared: result } = prepared('customers', fixture('customers.csv'));
  assert.deepEqual(result.errors, []);
  const [delta, old] = result.records.map(r => r.data);
  assert.equal(delta.name, 'Delta Bakery');
  assert.equal(delta.email, 'delta@example.com');
  assert.equal(delta.phone, '+1-716-555-0100');
  assert.equal(delta.address, '41 Main St, Buffalo, NY, 14203, US');
  assert.equal(delta.website, 'www.deltabakery.example');
  assert.equal(delta.status, 'active', 'Inactive=False imports as active');
  assert.equal(old.status, 'inactive', 'Inactive=True imports as inactive');
});

test('E-47 Sage VENDOR.CSV reads vendor type, tax ID and the 1099 flag', () => {
  const { prepared: result } = prepared('vendors', fixture('vendors.csv'));
  assert.deepEqual(result.errors, []);
  const [paper, dana] = result.records.map(r => r.data);
  assert.equal(paper.name, 'Paper World Ltd');
  assert.equal(paper.category, 'SUPPLY');
  assert.equal(paper.taxId, '515987654');
  assert.equal(paper.is1099, false, '1099 Type 0 (None) is not marked');
  assert.equal(dana.name, 'Dana Consultant');
  assert.equal(dana.is1099, true, '1099 Type 2 (Misc) marks the flag');
  assert.equal(dana.taxId, '312555667');
  assert.equal(dana.status, 'active');
});

test('E-47 Sage ITEM.CSV reads catalogue fields; quantities never become an opening stock posting', () => {
  const { table, prepared: result } = prepared('items', fixture('items.csv'));
  const qtyAt = table[0].indexOf('Quantity on hand');
  assert.equal(table[1][qtyAt], '');
  assert.deepEqual(result.errors, []);
  const [lab, pap] = result.records.map(r => r.data);
  assert.equal(lab.name, 'Consulting Hour');
  assert.equal(lab.sku, 'LAB-1', 'a service item falls back to its Item ID');
  assert.equal(lab.unitPriceCents, 15000);
  assert.equal(lab.category, 'SERVICE');
  assert.equal(pap.sku, '729004120001', 'UPC/SKU wins over the Item ID');
  assert.equal(pap.unitCostCents, 2500);
  assert.equal(pap.reorderPoint, 20);
  assert.equal(pap.measurementUnit, 'box');
  assert.equal(pap.quantityAtHand, 0);
});
