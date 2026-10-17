import test from 'node:test';
import assert from 'node:assert/strict';
import { vendor1099Readiness, vendor1099CsvRows, VENDOR_1099_CSV_HEADERS, type ReadinessPayment, type ReadinessVendor } from '../lib/vendor1099Readiness';

const vendor = (over: Partial<ReadinessVendor> & { id: string }): ReadinessVendor => ({ name: 'Vendor', ...over });
const payment = (over: Partial<ReadinessPayment> & { contactId: string }): ReadinessPayment =>
  ({ date: '2025-03-04', amountCents: 10000, currency: 'USD', direction: 'made', status: 'posted', ...over });

const report = (vendors: ReadinessVendor[], payments: ReadinessPayment[], taxYear = 2025) =>
  vendor1099Readiness({ vendors, payments, taxYear, homeCurrency: 'USD' });

test('A-188: posted outgoing payments in the year are added up per vendor', () => {
  const result = report([vendor({ id: 'v1', name: 'Ada Consulting' })], [
    payment({ contactId: 'v1', date: '2025-02-01', amountCents: 40000 }),
    payment({ contactId: 'v1', date: '2025-11-30', amountCents: 30000 }),
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].paidCents, 70000);
  assert.equal(result.thresholdCents, 60000);
  assert.equal(result.rows[0].overThreshold, true);
});

test('A-188: 2026 uses the raised threshold from the existing 1099 table', () => {
  const result = report([vendor({ id: 'v1' })], [payment({ contactId: 'v1', date: '2026-02-01', amountCents: 70000 })], 2026);
  assert.equal(result.thresholdCents, 200000);
  assert.equal(result.rows[0].overThreshold, false);
  assert.equal(result.rows[0].state, 'below-threshold');
});

test('A-188: a recorded tax ID is shown only as a mask and never in the CSV', () => {
  const result = report([
    vendor({ id: 'v1', name: 'Ada Consulting', address: '1 Main St', is1099: true, metadata: { taxPlace: { country: 'US' }, taxId: '12-3456789' } }),
  ], [payment({ contactId: 'v1', amountCents: 70000 })]);
  const row = result.rows[0];
  assert.equal(row.taxId.recorded, true);
  assert.equal(row.taxId.masked, '••••6789');
  assert.equal(row.taxId.raw, '');
  assert.equal(row.country, 'US');
  assert.equal(row.state, 'over-threshold');
  const csv = vendor1099CsvRows(result).flat().join(' ');
  assert.doesNotMatch(csv, /12-3456789/);
  assert.match(csv, /••••6789/);
  assert.equal(VENDOR_1099_CSV_HEADERS.length, vendor1099CsvRows(result)[0].length);
});

test('A-188: a vendor over the threshold without a tax ID or address needs details, and no country is assumed', () => {
  const result = report([vendor({ id: 'v1', name: 'No Papers Ltd', metadata: {} })], [payment({ contactId: 'v1', amountCents: 90000 })]);
  const row = result.rows[0];
  assert.equal(row.state, 'needs-tax-details');
  assert.equal(row.country, 'Not recorded');
  assert.equal(row.taxId.masked, '');
  assert.match(row.missing.join(' '), /No tax ID/);
  assert.match(row.missing.join(' '), /No address/);
  assert.match(row.missing.join(' '), /No tax country/);
  assert.match(row.missing.join(' '), /not marked as a 1099 vendor/);
  assert.match(row.missing.join(' '), /No W-9 or tax form is recorded/);
  assert.equal(result.unmarkedWithPayments, 1);
});

test('A-188: received money, drafts, other currencies and other years are not 1099 payments', () => {
  const result = report([vendor({ id: 'v1' })], [
    payment({ contactId: 'v1', direction: 'received', amountCents: 500000 }),
    payment({ contactId: 'v1', status: 'draft', amountCents: 500000 }),
    payment({ contactId: 'v1', status: 'void', amountCents: 500000 }),
    payment({ contactId: 'v1', currency: 'EUR', amountCents: 500000 }),
    payment({ contactId: 'v1', date: '2024-12-31', amountCents: 500000 }),
    payment({ contactId: 'v1', date: '2025-06-01', amountCents: 1000 }),
  ]);
  assert.equal(result.rows[0].paidCents, 1000);
  assert.equal(result.skippedForeignCurrencyPayments, 1);
  assert.equal(result.ignoredPayments, 3);
  assert.equal(result.outsideTaxYear, 1);
});

test('A-188: a payment whose vendor record is gone still appears, with what cannot be checked', () => {
  const result = report([], [payment({ contactId: 'gone', contactName: 'Old Vendor', amountCents: 80000 })]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].vendor, 'Old Vendor');
  assert.match(result.rows[0].missing.join(' '), /not loaded or was removed/);
  assert.equal(result.unmarkedWithPayments, 0);
});

test('A-188: rows are ordered by what was paid and say the threshold applies per vendor', () => {
  const result = report([vendor({ id: 'v1', name: 'Small' }), vendor({ id: 'v2', name: 'Large' })], [
    payment({ contactId: 'v1', amountCents: 1000 }),
    payment({ contactId: 'v2', amountCents: 90000 }),
  ]);
  assert.deepEqual(result.rows.map(row => row.vendor), ['Large', 'Small']);
  assert.equal(result.rows[0].thresholdCents, result.rows[1].thresholdCents);
});
