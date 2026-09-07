import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';

describe('TransactionTemplates Double-Entry Generation', () => {
  test('buildInvoiceLines creates perfectly balanced lines for invoice with tax, discount, retainage', () => {
    const lines = TransactionTemplates.buildInvoiceLines({
      invoiceNumber: 'INV-101',
      customerName: 'Acme Corp',
      totalCents: 10000,
      taxCents: 800,
      discountCents: 500,
      retainageCents: 1000,
      exchangeRate: 1,
      arAccount: { id: 'ar-1', name: 'Accounts Receivable' },
      revenueAccount: { id: 'rev-1', name: 'Sales Revenue' },
      taxAccount: { id: 'tax-1', name: 'Sales Tax Payable' },
      discountAccount: { id: 'disc-1', name: 'Sales Discounts' },
      retainageAccount: { id: 'ret-1', name: 'Retainage Receivable' }
    });

    const sum = lines.reduce((acc, l) => acc + l.amountCents, 0);
    assert.equal(sum, 0, 'Invoice double-entry journal entry debits and credits must sum to zero');
  });

  test('buildBillLines creates perfectly balanced lines for bill with tax', () => {
    const lines = TransactionTemplates.buildBillLines({
      billNumber: 'BILL-500',
      vendorName: 'Supplier Inc',
      totalCents: 5000,
      taxCents: 400,
      exchangeRate: 1,
      apAccount: { id: 'ap-1', name: 'Accounts Payable' },
      expenseAccount: { id: 'exp-1', name: 'Office Expense' },
      taxAccount: { id: 'tax-1', name: 'Tax Asset' }
    });

    const sum = lines.reduce((acc, l) => acc + l.amountCents, 0);
    assert.equal(sum, 0, 'Bill double-entry journal entry debits and credits must sum to zero');
  });

  test('buildReversalLines reverses all line amounts', () => {
    const originalLines = [
      { accountId: 'a1', accountName: 'Cash', amountCents: 1000, description: 'Debit Cash' },
      { accountId: 'a2', accountName: 'Revenue', amountCents: -1000, description: 'Credit Revenue' }
    ];

    const reversals = TransactionTemplates.buildReversalLines(originalLines, 'Sale #1');
    assert.equal(reversals[0].amountCents, -1000);
    assert.equal(reversals[1].amountCents, 1000);
  });
});
