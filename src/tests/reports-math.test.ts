import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeStatement,
  computeTaxLiability,
  computeCustomerBalanceSummary,
  computeVendorBalanceSummary,
  computeTransactionsByCustomer,
  computeTransactionsByVendor
} from '../server/reports/computeReports.js';
import type { Customer, Vendor, Invoice, Bill, Payment, CreditNote, VendorCredit } from '../types';
import {
  makeCustomer,
  makeVendor,
  makeInvoice,
  makeBill,
  makePayment,
  makeCreditNote,
  makeVendorCredit
} from './fixtures';

describe('Financial Report Math & Business Rules', () => {
  const mockCustomers: Customer[] = [
    makeCustomer({ id: 'cust-1', name: 'Acme Corp', email: 'acme@example.com', phone: '555-0101' }),
    makeCustomer({ id: 'cust-2', name: 'Beta LLC', email: 'beta@example.com', phone: '555-0102' })
  ];

  const mockVendors: Vendor[] = [
    makeVendor({ id: 'vend-1', name: 'Supplier One', email: 'sup1@example.com', phone: '555-0201' }),
    makeVendor({ id: 'vend-2', name: 'Supplier Two', email: 'sup2@example.com', phone: '555-0202' })
  ];

  it('computes Customer Balance Summary with issued invoices, payments, credit notes, and currency conversion', () => {
    const invoices: Invoice[] = [
      makeInvoice({ id: 'inv-1', customerId: 'cust-1', amountCents: 10000, status: 'sent', date: '2026-03-01' }),
      makeInvoice({ id: 'inv-2', customerId: 'cust-1', amountCents: 5000, status: 'draft', date: '2026-03-02' }), // Draft ignored
      makeInvoice({ id: 'inv-3', customerId: 'cust-1', amountCents: 10000, exchangeRate: 1.5, status: 'sent', date: '2026-03-03' }), // 15000 base
      makeInvoice({ id: 'inv-4', customerId: 'cust-2', amountCents: 20000, status: 'approved', date: '2026-03-04' })
    ];

    const payments: Payment[] = [
      makePayment({ id: 'pay-1', contactId: 'cust-1', amountCents: 8000, direction: 'received', status: 'posted', date: '2026-03-05' }),
      makePayment({ id: 'pay-2', contactId: 'cust-2', amountCents: 30000, direction: 'received', status: 'posted', date: '2026-03-06' }) // Overpayment -> credit balance
    ];

    const creditNotes: CreditNote[] = [
      makeCreditNote({ id: 'cn-1', customerId: 'cust-1', amountCents: 2000, status: 'open', date: '2026-03-07' })
    ];

    const summary = computeCustomerBalanceSummary(mockCustomers, invoices, payments, creditNotes);

    const cust1 = summary.find(r => r.customerId === 'cust-1');
    assert.ok(cust1);
    // Invoiced = 10000 + 15000 = 25000
    assert.equal(cust1?.totalInvoicedCents, 25000);
    // Credit notes = 2000
    assert.equal(cust1?.totalCreditNotesCents, 2000);
    // Paid = 8000
    assert.equal(cust1?.totalPaidCents, 8000);
    // Balance = 25000 - 2000 - 8000 = 15000
    assert.equal(cust1?.balanceCents, 15000);

    const cust2 = summary.find(r => r.customerId === 'cust-2');
    assert.ok(cust2);
    // Invoiced = 20000, Paid = 30000 -> negative balance (credit) = -10000
    assert.equal(cust2?.balanceCents, -10000);
  });

  it('includes unpaid invoices from prior years in the customer balance summary as-of date', () => {
    const invoices: Invoice[] = [
      makeInvoice({ id: 'inv-old', customerId: 'cust-1', amountCents: 50000, status: 'sent', date: '2025-06-15' }),
      makeInvoice({ id: 'inv-new', customerId: 'cust-1', amountCents: 20000, status: 'sent', date: '2026-03-01' })
    ];

    // Compute balance as of 2026-03-31 - should include the 2025 unpaid invoice
    const summary = computeCustomerBalanceSummary(mockCustomers, invoices, [], [], '2026-03-31');
    const cust1 = summary.find(r => r.customerId === 'cust-1');
    assert.ok(cust1);
    assert.equal(cust1?.totalInvoicedCents, 70000);
    assert.equal(cust1?.balanceCents, 70000);
  });

  it('computes Vendor Balance Summary with issued bills, vendor credits, and payments', () => {
    const bills: Bill[] = [
      makeBill({ id: 'bill-1', vendorId: 'vend-1', amountCents: 12000, status: 'pending', date: '2026-03-01' }),
      makeBill({ id: 'bill-2', vendorId: 'vend-1', amountCents: 4000, status: 'draft', date: '2026-03-02' }), // Draft ignored
      makeBill({ id: 'bill-3', vendorId: 'vend-1', amountCents: 10000, exchangeRate: 1.2, status: 'approved', date: '2026-03-03' }) // 12000 base
    ];

    const payments: Payment[] = [
      makePayment({ id: 'pay-v1', contactId: 'vend-1', amountCents: 10000, direction: 'made', status: 'posted', date: '2026-03-04' })
    ];

    const vendorCredits: VendorCredit[] = [
      makeVendorCredit({ id: 'vc-1', vendorId: 'vend-1', amountCents: 3000, status: 'open', date: '2026-03-05' })
    ];

    const summary = computeVendorBalanceSummary(mockVendors, bills, payments, vendorCredits);
    const vend1 = summary.find(r => r.vendorId === 'vend-1');
    assert.ok(vend1);
    // Billed = 12000 + 12000 = 24000
    assert.equal(vend1?.totalBilledCents, 24000);
    assert.equal(vend1?.totalVendorCreditsCents, 3000);
    assert.equal(vend1?.totalPaidCents, 10000);
    // Balance = 24000 - 3000 - 10000 = 11000
    assert.equal(vend1?.balanceCents, 11000);
  });

  it('computes Transactions by Customer with date filter and proper amounts', () => {
    const invoices: Invoice[] = [
      makeInvoice({ id: 'inv-1', customerId: 'cust-1', amountCents: 10000, status: 'sent', date: '2026-02-15' }),
      makeInvoice({ id: 'inv-2', customerId: 'cust-1', amountCents: 20000, status: 'sent', date: '2026-03-15' })
    ];
    const payments: Payment[] = [
      makePayment({ id: 'pay-1', contactId: 'cust-1', amountCents: 5000, direction: 'received', status: 'posted', date: '2026-03-20' })
    ];
    const creditNotes: CreditNote[] = [
      makeCreditNote({ id: 'cn-1', customerId: 'cust-1', amountCents: 1000, status: 'open', date: '2026-03-25' })
    ];

    const txs = computeTransactionsByCustomer(mockCustomers, invoices, payments, creditNotes, '2026-03-01', '2026-03-31');
    // Only 3 transactions in March (inv-2, pay-1, cn-1)
    assert.equal(txs.length, 3);
    assert.equal(txs[0].date, '2026-03-25');
    assert.equal(txs[0].type, 'Credit Note');
    assert.equal(txs[0].amountCents, -1000);
  });

  it('computes Transactions by Vendor with proper negative amounts for payments and credits', () => {
    const bills: Bill[] = [
      makeBill({ id: 'bill-1', vendorId: 'vend-1', amountCents: 15000, status: 'pending', date: '2026-03-10' })
    ];
    const vendorCredits: VendorCredit[] = [
      makeVendorCredit({ id: 'vc-1', vendorId: 'vend-1', amountCents: 2000, status: 'open', date: '2026-03-12' })
    ];
    const payments: Payment[] = [
      makePayment({ id: 'pay-1', contactId: 'vend-1', amountCents: 8000, direction: 'made', status: 'posted', date: '2026-03-14' })
    ];

    const txs = computeTransactionsByVendor(mockVendors, bills, payments, vendorCredits);
    assert.equal(txs.length, 3);
    const billRow = txs.find(t => t.type === 'Bill');
    const creditRow = txs.find(t => t.type === 'Vendor Credit');
    const payRow = txs.find(t => t.type === 'Vendor Payment');

    assert.equal(billRow?.amountCents, 15000);
    assert.equal(creditRow?.amountCents, -2000);
    assert.equal(payRow?.amountCents, -8000);
  });

  it('computes Statement with correct running balance', () => {
    const contact: Customer = makeCustomer({ id: 'cust-1', name: 'Acme Corp' });
    const invoices: Invoice[] = [
      makeInvoice({ id: 'inv-1', customerId: 'cust-1', amountCents: 10000, status: 'sent', date: '2026-01-10' }),
      makeInvoice({ id: 'inv-2', customerId: 'cust-1', amountCents: 15000, status: 'sent', date: '2026-02-10' })
    ];
    const payments: Payment[] = [
      makePayment({ id: 'pay-1', contactId: 'cust-1', amountCents: 5000, direction: 'received', status: 'posted', date: '2026-02-15' })
    ];

    const stmt = computeStatement(contact, invoices, [], payments, '2026-02-01', '2026-02-28', 'customer');
    assert.equal(stmt.openingBalanceCents, 10000);
    assert.equal(stmt.entries.length, 2);
    assert.equal(stmt.endingBalanceCents, 20000);
  });

  it('computes Tax Liability accurately from sales and purchases', () => {
    const invoices: Invoice[] = [
      makeInvoice({ id: 'inv-1', amountCents: 11000, taxCents: 1000, status: 'sent', date: '2026-03-01' })
    ];
    const bills: Bill[] = [
      makeBill({ id: 'bill-1', amountCents: 5500, taxCents: 500, status: 'pending', date: '2026-03-02' })
    ];

    const tax = computeTaxLiability(invoices, bills, '2026-03-01', '2026-03-31');
    assert.equal(tax.taxCollectedCents, 1000);
    assert.equal(tax.taxPaidCents, 500);
    assert.equal(tax.netTaxLiabilityCents, 500);
  });
});
