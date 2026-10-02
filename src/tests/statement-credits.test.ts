/**
 * Statements and balance summaries with credit notes, vendor credits and refunds (L-160): a credit
 * lowers what the customer owes, a refund of it puts that back; the statement's closing balance
 * and the Customer Balance Summary agree.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatement } from '../server/reports/computeReports';
import { computeCustomerBalanceSummary, computeVendorBalanceSummary } from '../server/reports/partyReports';
import { makeBill, makeCreditNote, makeCustomer, makeInvoice, makePayment, makeVendor, makeVendorCredit } from './fixtures';

const acme = makeCustomer({ id: 'c1', name: 'Acme' });
const invoices = [
  makeInvoice({ id: 'i1', number: 'INV-1', customerId: 'c1', amountCents: 100000, date: '2026-01-10', status: 'sent' }),
  makeInvoice({ id: 'i2', number: 'INV-2', customerId: 'c1', amountCents: 50000, date: '2026-03-05', status: 'sent' }),
];
const payments = [makePayment({ id: 'p1', contactId: 'c1', direction: 'received', status: 'posted', amountCents: 60000, date: '2026-03-10' })];
const credits = [
  makeCreditNote({ id: 'cn1', number: 'CN-1', customerId: 'c1', amountCents: 20000, remainingCents: 0, date: '2026-01-20', status: 'applied' }),
  makeCreditNote({ id: 'cn2', number: 'CN-2', customerId: 'c1', amountCents: 30000, remainingCents: 0, refundedCents: 30000, date: '2026-03-15', status: 'applied' }),
  makeCreditNote({ id: 'cn3', customerId: 'c1', amountCents: 99900, remainingCents: 99900, date: '2026-03-16', status: 'draft' }),
];

describe('statement with credits (L-160)', () => {
  test('a credit before the period lowers the opening balance; a refunded credit in the period nets to nothing', () => {
    const s = computeStatement(acme, invoices, [], payments, '2026-03-01', '2026-03-31', 'customer', credits);
    assert.equal(s.openingBalanceCents, 100000 - 20000);
    assert.deepEqual(s.entries.map(e => [e.reference, e.type, e.amountCents, e.runningBalanceCents]), [
      ['INV-2', 'Invoice', 50000, 130000],
      ['p1', 'Payment', -60000, 70000],
      ['CN-2', 'Credit note (refunded)', 0, 70000],
    ]);
    assert.equal(s.endingBalanceCents, 70000);
  });

  test('the closing balance matches the Customer Balance Summary', () => {
    const s = computeStatement(acme, invoices, [], payments, '2026-01-01', '2026-12-31', 'customer', credits);
    const [row] = computeCustomerBalanceSummary([acme], invoices, payments, credits, '2026-12-31');
    assert.equal(s.endingBalanceCents, 70000);
    assert.equal(row.balanceCents, s.endingBalanceCents);
    assert.equal(row.totalCreditNotesCents, 20000);   // CN-2 was paid back
  });

  test('vendors: vendor credits lower what is owed to the vendor, the same way', () => {
    const power = makeVendor({ id: 'v1', name: 'Power Co' });
    const bills = [makeBill({ id: 'b1', number: 'B-1', vendorId: 'v1', amountCents: 40000, date: '2026-02-01', status: 'approved' })];
    const vcs = [makeVendorCredit({ id: 'vc1', number: 'VC-1', vendorId: 'v1', amountCents: 5000, remainingCents: 5000, date: '2026-02-10', status: 'open' })];
    const s = computeStatement(power, [], bills, [], '2026-01-01', '2026-12-31', 'vendor', vcs);
    assert.equal(s.endingBalanceCents, 35000);
    const [row] = computeVendorBalanceSummary([power], bills, [], vcs, '2026-12-31');
    assert.equal(row.balanceCents, 35000);
  });

  test('without credits passed, the statement is as before', () => {
    const s = computeStatement(acme, invoices, [], payments, '2026-01-01', '2026-12-31', 'customer');
    assert.equal(s.endingBalanceCents, 90000);
  });
});
