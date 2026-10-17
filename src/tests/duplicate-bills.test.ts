import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateBills, duplicateBillCsvRows, DUPLICATE_BILL_CSV_HEADERS, type ReviewBill } from '../lib/duplicateBills';

const bill = (over: Partial<ReviewBill> & { id: string }): ReviewBill => ({
  vendorId: 'vendor-1',
  vendorName: 'Northwind Supplies',
  amountCents: 125000,
  currency: 'USD',
  status: 'approved',
  ...over,
});

test('A-195: same vendor, same amount, two days apart is a date-window pair', () => {
  const review = findDuplicateBills([
    bill({ id: 'b1', number: 'A-11', date: '2026-03-02' }),
    bill({ id: 'b2', number: 'A-12', date: '2026-03-04' }),
  ]);
  assert.equal(review.pairs.length, 1);
  assert.equal(review.pairs[0].daysApart, 2);
  assert.deepEqual(review.pairs[0].signals, ['within-3-days']);
  assert.equal(review.pairs[0].strength, 'date-window');
  assert.equal(review.pairs[0].amountCents, 125000);
});

test('A-195: a shared document number is documented evidence, and four days apart is not a pair', () => {
  const numbered = findDuplicateBills([
    bill({ id: 'b1', number: 'INV-778', date: '2026-03-02' }),
    bill({ id: 'b2', number: 'inv-778 ', date: '2026-03-04' }),
  ]);
  assert.deepEqual(numbered.pairs[0].signals, ['same-document-number', 'within-3-days']);
  assert.equal(numbered.pairs[0].strength, 'documented');

  const apart = findDuplicateBills([
    bill({ id: 'b1', number: 'INV-778', date: '2026-03-02' }),
    bill({ id: 'b2', number: 'INV-778', date: '2026-03-06' }),
  ]);
  assert.equal(apart.pairs.length, 0);
});

test('A-195: a shared order reference is documented evidence even on the same day', () => {
  const review = findDuplicateBills([
    bill({ id: 'b1', number: 'A-1', date: '2026-04-01', metadata: { poNumber: 'PO-90' } }),
    bill({ id: 'b2', number: 'A-2', date: '2026-04-01', metadata: { poNumber: 'po-90' } }),
  ]);
  assert.equal(review.pairs.length, 1);
  assert.deepEqual(review.pairs[0].signals, ['same-reference', 'same-day']);
  assert.equal(review.pairs[0].strength, 'documented');
});

test('A-195: a different amount, vendor or currency is never paired', () => {
  const base = bill({ id: 'b1', date: '2026-03-02' });
  assert.equal(findDuplicateBills([base, bill({ id: 'b2', date: '2026-03-02', amountCents: 125001 })]).pairs.length, 0);
  assert.equal(findDuplicateBills([base, bill({ id: 'b2', date: '2026-03-02', vendorId: 'vendor-2' })]).pairs.length, 0);
  assert.equal(findDuplicateBills([base, bill({ id: 'b2', date: '2026-03-02', currency: 'EUR' })]).pairs.length, 0);
});

test('A-195: void, cancelled and rejected bills are excluded and counted; a bill with no vendor is reported', () => {
  const review = findDuplicateBills([
    bill({ id: 'b1', date: '2026-03-02' }),
    bill({ id: 'b2', date: '2026-03-02', status: 'void' }),
    bill({ id: 'b3', date: '2026-03-02', status: 'cancelled' }),
    bill({ id: 'b4', date: '2026-03-02', status: 'rejected' }),
    bill({ id: 'b5', date: '2026-03-02', vendorId: '' }),
    bill({ id: 'b6', date: '2026-03-03' }),
  ]);
  assert.equal(review.excludedBills, 3);
  assert.equal(review.withoutVendor, 1);
  assert.equal(review.pairs.length, 1);
  assert.deepEqual(review.pairs[0].key.split('\u0000'), ['b1', 'b6']);
});

test('A-195: a bill with no readable date is never paired, and a huge same-amount group is reported instead of expanded', () => {
  const undated = findDuplicateBills([bill({ id: 'b1', date: undefined }), bill({ id: 'b2', date: '2026-03-02' })]);
  assert.equal(undated.pairs.length, 0);

  const many = Array.from({ length: 26 }, (_, index) => bill({ id: `b${index}`, date: '2026-03-02' }));
  const ambiguous = findDuplicateBills(many);
  assert.equal(ambiguous.pairs.length, 0);
  assert.equal(ambiguous.ambiguousGroups, 1);
});

test('A-195: the CSV carries the evidence and never offers an action column', () => {
  const review = findDuplicateBills([
    bill({ id: 'b1', number: 'A-1', date: '2026-03-02' }),
    bill({ id: 'b2', number: 'A-2', date: '2026-03-03' }),
  ]);
  const rows = duplicateBillCsvRows(review.pairs);
  assert.equal(DUPLICATE_BILL_CSV_HEADERS.length, rows[0].length);
  assert.equal(rows[0][2], 'b1');
  assert.equal(rows[0][7], '1250.00');
  assert.equal(rows[0][8], 'USD');
  assert.equal(rows[0][10], 'Within 3 days');
  assert.ok(!DUPLICATE_BILL_CSV_HEADERS.some(header => /delete|merge|action/i.test(header)));
});
