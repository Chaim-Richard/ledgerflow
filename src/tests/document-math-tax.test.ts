import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { calculateDocumentTax, calculateDocumentNet, normalizeTaxRate, calculateAmountDue } from '../lib/documentMath';
import { computeTaxLiability } from '../server/reports/computeReports';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';

describe('Document Math & Tax Engine (§14 Findings AE, AF, AG, AH)', () => {
  test('normalizes tax rates cleanly', () => {
    assert.equal(normalizeTaxRate(20), 0.20);
    assert.equal(normalizeTaxRate(8.25), 0.0825);
    assert.equal(normalizeTaxRate(0.05), 0.05);
    assert.equal(normalizeTaxRate(0), 0);
    assert.equal(normalizeTaxRate(undefined), 0);
  });

  test('calculates tax-exclusive amounts accurately (remedies AE defect)', () => {
    // $100.00 base (10,000 cents) at 20% tax rate
    const tax = calculateDocumentTax({
      amountCents: 10000,
      totalCents: 10000,
      taxRate: 20,
      taxInclusive: false
    });
    // In tax exclusive, $100 * 20% = $20 (2,000 cents), NOT $16.67 (1,667 cents)
    assert.equal(tax, 2000);

    const net = calculateDocumentNet({
      amountCents: 10000,
      totalCents: 10000,
      taxRate: 20,
      taxInclusive: false
    });
    assert.equal(net, 10000);
  });

  test('calculates tax-inclusive amounts accurately', () => {
    // $120.00 total inclusive (12,000 cents) at 20% tax rate
    // Tax = 120 - 120 / 1.2 = 20 (2,000 cents)
    const tax = calculateDocumentTax({
      totalCents: 12000,
      taxRate: 20,
      taxInclusive: true
    });
    assert.equal(tax, 2000);

    const net = calculateDocumentNet({
      totalCents: 12000,
      taxRate: 20,
      taxInclusive: true
    });
    assert.equal(net, 10000);
  });

  test('respects explicit taxAmountCents over computed rate', () => {
    const tax = calculateDocumentTax({
      totalCents: 10000,
      taxRate: 20,
      taxAmountCents: 1550 // manual override
    });
    assert.equal(tax, 1550);
  });

  test('handles discounts prior to tax computation in tax-exclusive mode', () => {
    // $100 base - $10 discount = $90 taxable base. 10% tax = $9.00 (900 cents)
    const tax = calculateDocumentTax({
      totalCents: 10000,
      discountCents: 1000,
      taxRate: 10,
      taxInclusive: false
    });
    assert.equal(tax, 900);
  });

  test('ties out perfectly between computeReports and document templates', () => {
    const invoices = [
      {
        id: 'inv-1',
        number: 'INV-101',
        customerName: 'Acme Corp',
        date: '2026-03-01',
        amountCents: 10000,
        totalCents: 10000,
        taxRate: 10,
        taxInclusive: false,
        status: 'approved' as const
      },
      {
        id: 'inv-2',
        number: 'INV-102',
        customerName: 'Beta LLC',
        date: '2026-03-05',
        amountCents: 11000,
        totalCents: 11000,
        taxRate: 10,
        taxInclusive: true,
        status: 'sent' as const
      }
    ];

    const bills = [
      {
        id: 'bill-1',
        date: '2026-03-02',
        amountCents: 5000,
        totalCents: 5000,
        taxRate: 10,
        taxInclusive: false,
        status: 'approved' as const
      }
    ];

    const report = computeTaxLiability(invoices, bills, '2026-03-01', '2026-03-31');
    
    // Inv 1: Tax = 1,000 cents, Net = 10,000 cents
    // Inv 2: Tax = 1,000 cents (11000 - 11000/1.1 = 1000), Net = 10,000 cents
    // Total taxable sales = 20,000 cents, total tax collected = 2,000 cents
    assert.equal(report.taxableSalesCents, 20000);
    assert.equal(report.taxCollectedCents, 2000);

    // Bill 1: Tax = 500 cents, Net = 5,000 cents
    assert.equal(report.taxablePurchasesCents, 5000);
    assert.equal(report.taxPaidCents, 500);
    assert.equal(report.netTaxLiabilityCents, 1500);

    // Verify Invoice 1 template lines balance exactly
    const inv1Tax = calculateDocumentTax(invoices[0]);
    const inv1Lines = TransactionTemplates.buildInvoiceLines({
      invoiceNumber: invoices[0].number,
      customerName: invoices[0].customerName,
      totalCents: invoices[0].totalCents,
      taxCents: inv1Tax,
      arAccount: { id: 'ar', name: 'A/R' },
      revenueAccount: { id: 'rev', name: 'Revenue' },
      taxAccount: { id: 'tax', name: 'Tax Payable' }
    });

    const totalDebits = inv1Lines.filter(l => l.amountCents > 0).reduce((s, l) => s + l.amountCents, 0);
    const totalCredits = inv1Lines.filter(l => l.amountCents < 0).reduce((s, l) => s + Math.abs(l.amountCents), 0);
    assert.equal(totalDebits, totalCredits);
  });

  test('calculates amount due with partial payments accurately', () => {
    assert.equal(calculateAmountDue({ totalCents: 15000, amountPaidCents: 5000 }), 10000);
    assert.equal(calculateAmountDue({ totalCents: 15000, paidAmountCents: 15000 }), 0);
    assert.equal(calculateAmountDue({ totalCents: 15000, amountPaidCents: 20000 }), 0);
  });
});
