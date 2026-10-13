import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBill } from './fixtures';
import { receiptChecklist, receiptChecklistCsvRows, RECEIPT_CHECKLIST_CSV_HEADERS } from '../lib/receiptChecklist';

const claimBill = (id: string, employee: string, overrides: Record<string, unknown> = {}) => makeBill({
  id,
  vendorName: employee,
  date: '2026-06-10',
  currency: 'USD',
  amountCents: 4250,
  status: 'draft',
  metadata: { expenseClaim: { state: 'submitted', submittedBy: `u-${id}`, submittedByName: 'Bookkeeper', submittedAt: '2026-06-10T10:00:00Z' } },
  ...overrides,
});

test('A-133 reports missing receipt evidence per employee without confusing attachment links with verified receipts', () => {
  const report = receiptChecklist({
    bills: [
      claimBill('b1', 'Alex'),
      claimBill('b2', 'Alex', { date: '2026-06-30', receiptUrl: 'https://example.test/receipt' }),
      claimBill('b3', 'Sam'),
      makeBill({ id: 'ordinary', vendorName: 'Other', date: '2026-06-10' }),
    ],
    attachmentLinks: [
      { id: 'file-1', linkedCollection: 'bills', linkedId: 'b3' },
      { id: 'invoice-file', linkedCollection: 'invoices', linkedId: 'b1' },
      { id: 'duplicate-file', linkedCollection: 'bills', linkedId: 'b3' },
    ],
    attachmentIndexComplete: true,
    from: '2026-06-01',
    to: '2026-06-30',
  });

  assert.equal(report.rows.length, 3);
  assert.deepEqual(report.missingByEmployee, [{ employeeName: 'Alex', claims: 1 }]);
  assert.equal(report.missingClaims, 1);
  assert.equal(report.notCheckedClaims, 0);
  assert.equal(report.rows.find(row => row.billId === 'b3')?.attachmentCount, 2);
  assert.equal(report.rows.find(row => row.billId === 'b2')?.evidenceStatus, 'recorded');
  assert.equal(report.rows.find(row => row.billId === 'b1')?.evidenceStatus, 'missing');
  assert.equal(report.rows.find(row => row.billId === 'b1')?.employeeName, 'Alex');
  assert.equal(report.rows.find(row => row.billId === 'b1')?.submittedBy, 'Bookkeeper');
});

test('a failed or capped attachment index makes absence unknown, while known receipt links stay visible', () => {
  const report = receiptChecklist({
    bills: [claimBill('b1', 'Alex'), claimBill('b2', 'Bea', { receiptUrl: 'legacy-url' })],
    attachmentLinks: [],
    attachmentIndexComplete: false,
    homeCurrency: 'ILS',
  });
  assert.equal(report.missingClaims, 0);
  assert.equal(report.notCheckedClaims, 1);
  assert.equal(report.rows.find(row => row.billId === 'b1')?.evidenceStatus, 'not-checked');
  assert.equal(report.rows.find(row => row.billId === 'b2')?.evidenceStatus, 'recorded');
  assert.equal(report.rows[0].currency, 'USD');
});

test('claim date bounds are inclusive and invalid periods do not silently widen the query', () => {
  const report = receiptChecklist({
    bills: [claimBill('before', 'A', { date: '2026-05-31' }), claimBill('on', 'A'), claimBill('after', 'A', { date: '2026-07-01' })],
    attachmentLinks: [],
    attachmentIndexComplete: true,
    from: '2026-06-10',
    to: '2026-06-10',
  });
  assert.deepEqual(report.rows.map(row => row.billId), ['on']);
  const invalid = receiptChecklist({ bills: [claimBill('on', 'A')], attachmentLinks: [], attachmentIndexComplete: true, from: '2026-06-31', to: '2026-07-01' });
  assert.deepEqual(invalid.rows, []);
});

test('CSV preserves the claim currency and labels absence as a review status', () => {
  const report = receiptChecklist({ bills: [claimBill('b1', 'Alex', { currency: 'EUR' })], attachmentLinks: [], attachmentIndexComplete: true });
  const [row] = receiptChecklistCsvRows(report.rows);
  assert.equal(row.length, RECEIPT_CHECKLIST_CSV_HEADERS.length);
  assert.equal(row[5], 'EUR');
  assert.equal(row[6], 4250);
  assert.equal(row[9], 'missing');
});
