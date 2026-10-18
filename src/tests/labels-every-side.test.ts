import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';

// DIM-1: an invoice with two labelled lines — every line of the entry carries a label, and each
// label's part of the entry balances on its own.
const acct = (id: string) => ({ id, name: id });

test('receivable and tax are split by label, and each label balances', () => {
  const lines = TransactionTemplates.buildInvoiceLines({
    invoiceNumber: 'INV-1', customerName: 'Acme', totalCents: 11700, taxCents: 1700,
    arAccount: acct('ar'), revenueAccount: acct('sales'), taxAccount: acct('vat'),
    lineAccounts: [
      { account: acct('sales'), weightCents: 6000, dimensions: { location: 'Tel Aviv' } },
      { account: acct('sales'), weightCents: 4000, dimensions: { location: 'Haifa' } },
    ],
  });
  assert.ok(lines.every(l => (l as { dimensions?: Record<string, string> }).dimensions?.location), 'every line has a location');
  assert.equal(lines.reduce((s, l) => s + l.amountCents, 0), 0, 'the entry balances');
  for (const place of ['Tel Aviv', 'Haifa']) {
    const mine = lines.filter(l => (l as { dimensions?: Record<string, string> }).dimensions?.location === place);
    assert.equal(mine.reduce((s, l) => s + l.amountCents, 0), 0, `${place} balances on its own`);
  }
  const ar = lines.filter(l => l.accountId === 'ar');
  assert.deepEqual(ar.map(l => l.amountCents).sort((a, b) => a - b), [4680, 7020], 'receivable 60/40');
});

test('a bill without labels is unchanged', () => {
  const lines = TransactionTemplates.buildBillLines({
    billNumber: 'B-1', vendorName: 'V', totalCents: 1000, apAccount: acct('ap'), expenseAccount: acct('rent'),
  });
  assert.equal(lines.length, 2);
  assert.ok(lines.every(l => !(l as { dimensions?: unknown }).dimensions));
});
