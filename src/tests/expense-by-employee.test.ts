/**
 * A-191: expense by employee with receipt status. Hand-checked on the receipt checklist's own
 * terms (A-133): a claim is a bill with `metadata.expenseClaim`; evidence is a recorded receipt
 * address or a linked file; here the attachment index is complete, so no evidence = missing.
 *
 * Noa: two claims — 12,000 ILS approved with a receipt address recorded; 3,500 ILS waiting, no
 * evidence. Omar: one 2,000 USD claim rejected with a linked file. Amounts never mix currencies:
 * Noa's row totals only ILS. A plain bill (no claim metadata) is not an expense claim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseByEmployee, expenseByEmployeeCsvRows } from '../lib/expenseByEmployee';

const claimBill = (over: Record<string, unknown>) => ({
  id: 'b', number: 'B-1', vendorId: 'v1', vendorName: 'Noa Levi', date: '2026-09-05',
  currency: 'ILS', amountCents: 0, amountPaidCents: 0, status: 'draft',
  metadata: { expenseClaim: { state: 'submitted', submittedByName: 'Noa Levi' } },
  ...over,
});
const bills = [
  claimBill({ id: 'b1', amountCents: 12_000, receiptUrl: 'https://example.test/receipts/1',
    metadata: { expenseClaim: { state: 'approved', submittedByName: 'Noa Levi' } } }),
  claimBill({ id: 'b2', amountCents: 3_500 }),
  claimBill({ id: 'b3', vendorId: 'v2', vendorName: 'Omar Haddad', currency: 'USD', amountCents: 2_000,
    metadata: { expenseClaim: { state: 'rejected', submittedByName: 'Omar Haddad' } } }),
  { id: 'b4', number: 'B-9', vendorId: 'v9', vendorName: 'Paper Supplier', date: '2026-09-06', currency: 'ILS', amountCents: 99_000, status: 'approved' },
];
const report = expenseByEmployee({
  bills: bills as never,
  attachmentLinks: [{ id: 'att1', linkedId: 'b3', linkedCollection: 'bills' }],
  attachmentIndexComplete: true,
});

test('claims group by the employee on the bill, per currency, with the checklist verdicts', () => {
  assert.equal(report.claims.length, 3, 'the supplier bill without claim metadata is not a claim');
  const dana = report.rows.find(r => r.employee === 'Noa Levi')!;
  assert.ok(dana);
  assert.equal(dana.claims, 2);
  assert.deepEqual(dana.totals, [{ currency: 'ILS', cents: 15_500 }]);
  assert.equal(dana.approved, 1);
  assert.equal(dana.waiting, 1);
  assert.equal(dana.receiptsRecorded, 1);
  assert.equal(dana.receiptsMissing, 1);
  const omar = report.rows.find(r => r.employee === 'Omar Haddad')!;
  assert.deepEqual(omar.totals, [{ currency: 'USD', cents: 2_000 }], 'USD is never added to the ILS row');
  assert.equal(omar.rejected, 1);
  assert.equal(omar.claimsWithFiles, 1);
  assert.equal(omar.receiptsRecorded, 1);
  assert.equal(report.rows[0].employee, 'Noa Levi', 'the most missing receipts come first');
});

test('when the attachment index could not be read, evidence is not-checked, never missing', () => {
  const unknown = expenseByEmployee({
    bills: bills as never, attachmentLinks: [], attachmentIndexComplete: false,
  });
  const dana = unknown.rows.find(r => r.employee === 'Noa Levi')!;
  assert.equal(dana.receiptsMissing, 0);
  assert.equal(dana.receiptsNotChecked, 1, 'the claim without a receipt address cannot be called missing');
  const csv = expenseByEmployeeCsvRows(report.rows);
  assert.equal(csv.length, 2, 'one CSV row per employee and currency');
});
