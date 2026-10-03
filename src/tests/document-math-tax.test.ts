import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateDocumentTax, calculateDocumentNet, normalizeTaxRate, calculateAmountDue } from '../lib/documentMath';
import { computeTaxLiability } from '../server/reports/computeReports';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';
import { Invoice, Bill } from '../types';
import { makeInvoice } from './fixtures';

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
      taxRate: 20,
      taxInclusive: false
    });
    // In tax exclusive, $100 * 20% = $20 (2,000 cents), NOT $16.67 (1,667 cents)
    assert.equal(tax, 2000);

    const net = calculateDocumentNet({
      amountCents: 10000,
      taxRate: 20,
      taxInclusive: false
    });
    assert.equal(net, 10000);
  });

  test('calculates tax-inclusive amounts accurately', () => {
    // $120.00 total inclusive (12,000 cents) at 20% tax rate
    // Tax = 120 - 120 / 1.2 = 20 (2,000 cents)
    const tax = calculateDocumentTax({
      amountCents: 12000,
      taxRate: 20,
      taxInclusive: true
    });
    assert.equal(tax, 2000);

    const net = calculateDocumentNet({
      amountCents: 12000,
      taxRate: 20,
      taxInclusive: true
    });
    assert.equal(net, 10000);
  });

  test('respects explicit taxAmountCents over computed rate', () => {
    const tax = calculateDocumentTax({
      amountCents: 10000,
      taxRate: 20,
      taxAmountCents: 1550 // manual override
    });
    assert.equal(tax, 1550);
  });

  test('handles discounts prior to tax computation in tax-exclusive mode', () => {
    // $100 base - $10 discount = $90 taxable base. 10% tax = $9.00 (900 cents)
    const tax = calculateDocumentTax({
      amountCents: 10000,
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

    const report = computeTaxLiability(invoices as unknown as Invoice[], bills as unknown as Bill[], '2026-03-01', '2026-03-31');
    
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

  test('multicurrency tie out with discount, retainage, and tax on top', () => {
    const invoice = makeInvoice({
      id: 'inv-eur-2',
      number: 'INV-EUR-200',
      customerName: 'Acme Europe 2',
      date: '2026-03-10',
      amountCents: 10000,
      discountCents: 1000,
      retainageCents: 500,
      taxRate: 20,
      taxInclusive: false,
      currency: 'EUR',
      exchangeRate: 1.1,
      status: 'approved'
    });

    const tax = calculateDocumentTax(invoice);
    const report = computeTaxLiability([invoice], [], '2026-03-01', '2026-03-31');
    // the report is in the home currency: €18.00 at 1.1 (it used to add the euro figure, L-169)
    assert.equal(report.taxCollectedCents, Math.round(tax * 1.1));

    const lines = TransactionTemplates.buildInvoiceLines({
      invoiceNumber: invoice.number || 'INV-EUR-200',
      customerName: invoice.customerName || 'Acme Europe 2',
      totalCents: invoice.amountCents,
      taxCents: tax,
      discountCents: invoice.discountCents,
      retainageCents: invoice.retainageCents,
      exchangeRate: invoice.exchangeRate,
      arAccount: { id: 'ar', name: 'A/R' },
      revenueAccount: { id: 'rev', name: 'Revenue' },
      taxAccount: { id: 'tax', name: 'Tax Payable' },
      discountAccount: { id: 'discount', name: 'Sales Discounts' },
      retainageAccount: { id: 'retainage', name: 'Retainage Receivable' }
    });

    const sum = lines.reduce((acc, line) => acc + line.amountCents, 0);
    assert.equal(sum, 0);
  });

  test('multicurrency tie out with discount and retainage', () => {
    const invoice = makeInvoice({
      id: 'inv-eur-1',
      number: 'INV-EUR-100',
      customerName: 'Acme Europe',
      date: '2026-03-10',
      amountCents: 10000,
      discountCents: 1000,
      retainageCents: 500,
      taxRate: 20,
      taxInclusive: false,
      currency: 'EUR',
      exchangeRate: 1.1,
      status: 'approved'
    });

    const tax = calculateDocumentTax(invoice);
    assert.equal(tax, 1800);

    const report = computeTaxLiability([invoice], [], '2026-03-01', '2026-03-31');
    assert.equal(report.taxCollectedCents, 1980); // €18.00 at 1.1 in the home currency (L-169)

    const lines = TransactionTemplates.buildInvoiceLines({
      invoiceNumber: invoice.number || 'INV-EUR-100',
      customerName: invoice.customerName || 'Acme Europe',
      totalCents: invoice.amountCents,
      taxCents: tax,
      discountCents: invoice.discountCents,
      retainageCents: invoice.retainageCents,
      exchangeRate: invoice.exchangeRate,
      arAccount: { id: 'ar', name: 'A/R' },
      revenueAccount: { id: 'rev', name: 'Revenue' },
      taxAccount: { id: 'tax', name: 'Tax Payable' },
      discountAccount: { id: 'discount', name: 'Sales Discounts' },
      retainageAccount: { id: 'retainage', name: 'Retainage Receivable' }
    });

    const totalDebits = lines.filter(l => l.amountCents > 0).reduce((s, l) => s + l.amountCents, 0);
    const totalCredits = lines.filter(l => l.amountCents < 0).reduce((s, l) => s + Math.abs(l.amountCents), 0);
    assert.equal(totalDebits, totalCredits);
    assert.equal(totalDebits, 11000); // 9500 (AR) + 500 (retainage) + 1000 (discount) = 11000
  });

  test('invoice carrying only salesTaxCents posts and reports the same number', () => {
    const invoice: Invoice = makeInvoice({
      id: 'inv-sales-tax-only',
      number: 'INV-ST-1',
      customerName: 'Gamma Corp',
      date: '2026-03-10',
      amountCents: 10000,
      salesTaxCents: 825, // explicit legacy salesTaxCents without taxAmountCents
      status: 'approved'
    });

    const calculatedTax = calculateDocumentTax(invoice);
    assert.equal(calculatedTax, 825);

    const report = computeTaxLiability([invoice], [], '2026-03-01', '2026-03-31');
    assert.equal(report.taxCollectedCents, 825);

    const postingLines = TransactionTemplates.buildInvoiceLines({
      invoiceNumber: invoice.number || 'INV-ST-1',
      customerName: invoice.customerName || 'Gamma Corp',
      totalCents: invoice.amountCents,
      taxCents: calculatedTax,
      arAccount: { id: 'ar', name: 'A/R' },
      revenueAccount: { id: 'rev', name: 'Revenue' },
      taxAccount: { id: 'tax', name: 'Tax Payable' }
    });

    const taxLine = postingLines.find(l => l.accountId === 'tax');
    assert.ok(taxLine, 'Tax line must exist');
    assert.equal(Math.abs(taxLine.amountCents), 825);
  });

  test('calculates amount due with partial payments accurately', () => {
    assert.equal(calculateAmountDue({ amountCents: 15000, amountPaidCents: 5000 }), 10000);
    assert.equal(calculateAmountDue({ amountCents: 15000, amountPaidCents: 15000 }), 0);
    assert.equal(calculateAmountDue({ amountCents: 15000, amountPaidCents: 20000 }), 0);
  });

  test('guard: no file except src/lib/documentMath.ts may contain "/ (1 +"', () => {
    function getFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const srcDir = path.resolve(process.cwd(), 'src');
    const allFiles = getFiles(srcDir);
    const violatingFiles: string[] = [];

    for (const filePath of allFiles) {
      const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
      if (relPath === 'src/lib/documentMath.ts' || relPath === 'src/tests/document-math-tax.test.ts') {
        continue;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('/ (1 +')) {
        violatingFiles.push(relPath);
      }
    }

    assert.deepEqual(violatingFiles, [], `Found inline tax division arithmetic in: ${violatingFiles.join(', ')}. Use calculateDocumentTax from src/lib/documentMath.ts instead.`);
  });
});
