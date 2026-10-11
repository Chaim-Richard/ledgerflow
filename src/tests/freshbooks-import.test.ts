import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFreshBooksCsv } from '../lib/freshBooksImport';
import { guessMapping, applyMapping, prepareImport } from '../lib/recordImport';

const prepared = (kind: 'customers' | 'vendors' | 'items', table: string[][]) => {
  const normalized = normalizeFreshBooksCsv(kind, table);
  const mapping = guessMapping(kind, normalized[0]);
  return prepareImport(kind, applyMapping(kind, normalized.slice(1), mapping));
};

test('E-7 FreshBooks clients: company name wins; names and multi-column addresses map safely', () => {
  const out = prepared('customers', [
    ['First Name', 'Last Name', 'Company Name', 'Email Address', 'Address Line 1', 'Address Line 2', 'City', 'State', 'Zip Code', 'Country'],
    ['Sara', 'Cohen', 'Acme LLC', 'SAra@example.com', '1 Pine St', 'Suite 2', 'Portland', 'OR', '97201', 'US'],
    ['Avi', 'Levy', '', 'avi@example.com', '', '', 'Austin', 'TX', '78701', 'US'],
  ]);
  assert.deepEqual(out.errors, []);
  assert.equal(out.records[0].data.name, 'Acme LLC');
  assert.equal(out.records[0].data.address, '1 Pine St, Suite 2, Portland, OR, 97201, US');
  assert.equal(out.records[0].data.email, 'sara@example.com');
  assert.equal(out.records[1].data.name, 'Avi Levy');
});
test('E-7 vendors: company or personal name and email, no invoice or payment records', () => {
  const out = prepared('vendors', [
    ['First Name', 'Last Name', 'Company Name', 'Email', 'Phone'],
    ['David', 'M', '', 'vendor@example.com', '555-0100'],
    ['', '', 'Supplier Co', 'supplier@example.com', '555-0123'],
  ]);
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.records.map(r => r.data.name), ['David M', 'Supplier Co']);
  assert.deepEqual(Object.keys(out.records[0].data).sort(), ['category', 'email', 'name', 'phone', 'status']);
});
test('E-7 items: FreshBooks Rate becomes cents and duplicate names are refused by existing validation', () => {
  const out = prepared('items', [
    ['Name', 'Description', 'Rate', 'SKU'],
    ['Design', 'Work', '125.50', 'SERV-01'],
    ['Design', 'Work', '125.50', 'SERV-01'],
  ]);
  assert.equal(out.records[0].data.unitPriceCents, 12550);
  assert.ok(out.errors.some(e => /same|duplicate|appears/i.test(e.message)));
});
test('E-7 malformed source retains errors and never invents missing contact names', () => {
  const out = prepared('customers', [['First Name', 'Last Name', 'Email'], ['', '', 'invalid-email']]);
  assert.ok(out.errors.some(e => e.field === 'name'));
  assert.ok(out.errors.some(e => e.field === 'email'));
  assert.deepEqual(normalizeFreshBooksCsv('accounts', [['Code', 'Type'], ['1000', 'Bank']]), [['Code', 'Type'], ['1000', 'Bank']]);
});
