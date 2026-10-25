/**
 * The Israeli annual party summary (found by the EG-10 review, FOR_YOU 25 Oct):
 *  - tax withheld at source comes from the payment's `withheldCents`, as paymentService stores it (it read only
 *    `withholdingTaxCents` and showed 0 for every real vendor payment);
 *  - the open balance at the year end adds back what was paid after 31 December.
 * Figures by hand (ILS): bill B-1 of 1,170.00 dated 2026-11-10, paid 500.00 on 2026-12-20 with 30.00 withheld, and the
 * rest (670.00) on 2027-01-15. At 31 Dec 2026: open 670.00; paid in the year 500.00; withheld 30.00. Invoice I-1 of
 * 2,340.00 dated 2026-12-01, fully paid on 2027-01-05: open 2,340.00 at 31 Dec 2026, collected in 2026: 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeIsraeliAnnualSummary } from '../lib/israeliAnnualPartySummary';

const bill = { id: 'b1', number: 'B-1', vendorId: 'v1', vendorName: 'Supplier', status: 'paid', date: '2026-11-10', amountCents: 117_000, amountPaidCents: 117_000, taxAmountCents: 17_000, currency: 'ILS' };
const invoice = { id: 'i1', number: 'I-1', customerId: 'c1', customerName: 'Client', status: 'paid', date: '2026-12-01', amountCents: 234_000, amountPaidCents: 234_000, taxAmountCents: 34_000, currency: 'ILS' };
const payments = [
  { id: 'p1', direction: 'made', contactId: 'v1', contactName: 'Supplier', status: 'completed', paymentDate: '2026-12-20', amountCents: 50_000, withheldCents: 3_000, allocations: [{ documentId: 'b1', documentType: 'bill', amountCents: 50_000 }] },
  { id: 'p2', direction: 'made', contactId: 'v1', contactName: 'Supplier', status: 'completed', paymentDate: '2027-01-15', amountCents: 67_000, allocations: [{ documentId: 'b1', documentType: 'bill', amountCents: 67_000 }] },
  { id: 'p3', direction: 'received', contactId: 'c1', contactName: 'Client', status: 'completed', paymentDate: '2027-01-05', amountCents: 234_000, allocations: [{ documentId: 'i1', documentType: 'invoice', amountCents: 234_000 }] },
];

const run = (year: number) => computeIsraeliAnnualSummary({
  year, baseCurrency: 'ILS',
  customers: [{ id: 'c1', name: 'Client' }] as never, vendors: [{ id: 'v1', name: 'Supplier' }] as never,
  invoices: [invoice] as never, creditNotes: [], bills: [bill] as never, vendorCredits: [], payments: payments as never,
});

test('2026: the year-end open balances add back what was paid in January; withholding comes from withheldCents', () => {
  const out = run(2026);
  const v = out.vendors.find(r => r.vendorId === 'v1')!;
  assert.deepEqual([v.closingOpenCents, v.paymentsInYearCents, v.taxWithheldCents], [67_000, 50_000, 3_000]);
  const c = out.customers.find(r => r.customerId === 'c1')!;
  assert.deepEqual([c.closingOpenCents, c.collectionsInYearCents], [234_000, 0]);
});

test('2027: both documents are paid by 31 Dec 2027, so nothing is open; the January payments count in 2027', () => {
  const out = run(2027);
  const v = out.vendors.find(r => r.vendorId === 'v1')!;
  assert.deepEqual([v.closingOpenCents, v.paymentsInYearCents, v.taxWithheldCents], [0, 67_000, 0]);
  const c = out.customers.find(r => r.customerId === 'c1')!;
  assert.deepEqual([c.closingOpenCents, c.collectionsInYearCents], [0, 234_000]);
});
