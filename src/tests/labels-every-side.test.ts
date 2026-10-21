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

test('#152: odd cents in tax and discount — every label still balances exactly (random cases too)', () => {
  const sum = (lines: ReturnType<typeof TransactionTemplates.buildInvoiceLines>, loc: string) =>
    lines.filter(l => (l as { dimensions?: Record<string, string> }).dimensions?.location === loc).reduce((n, l) => n + l.amountCents, 0);
  const lines = TransactionTemplates.buildInvoiceLines({
    invoiceNumber: 'R-1', customerName: 'T', totalCents: 23499, taxCents: 3600, discountCents: 101,
    arAccount: acct('ar'), revenueAccount: acct('sales'), taxAccount: acct('vat'), discountAccount: acct('discount'),
    lineAccounts: [{ account: acct('sales'), weightCents: 10000, dimensions: { location: 'A' } }, { account: acct('sales'), weightCents: 10000, dimensions: { location: 'B' } }],
  });
  assert.equal(sum(lines, 'A'), 0);
  assert.equal(sum(lines, 'B'), 0);
  let seed = 3; const r = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 500; i++) {
    const w = [1 + r(9999), 1 + r(9999), r(3) === 0 ? 0 : 1 + r(9999)];
    const net = w.reduce((a, b) => a + b, 0);
    const tax = r(2000), disc = r(3) === 0 ? r(500) : 0, ret = r(4) === 0 ? r(300) : 0;
    const build = i % 2 ? TransactionTemplates.buildBillLines : TransactionTemplates.buildInvoiceLines;
    const out = build({ invoiceNumber: 'X', billNumber: 'X', customerName: 'c', vendorName: 'v', totalCents: net - disc + tax, taxCents: tax, discountCents: disc, retainageCents: ret,
      arAccount: acct('ar'), apAccount: acct('ap'), revenueAccount: acct('s'), expenseAccount: acct('e'), taxAccount: acct('t'), discountAccount: acct('d'), retainageAccount: acct('r'),
      lineAccounts: w.map((x, k) => ({ account: acct(i % 2 ? 'e' : 's'), weightCents: x, ...(k < 2 ? { dimensions: { location: k ? 'B' : 'A' } } : {}) })) } as never);
    assert.equal(out.reduce((n, l) => n + l.amountCents, 0), 0, `entry ${i} balances`);
    for (const loc of ['A', 'B']) assert.equal(sum(out, loc), 0, `entry ${i}: ${loc} balances`);
  }
});

test('DIM-1 payments: the payment of a labelled invoice carries its labels; each label balances and a full payment clears each label', () => {
  const loc = (l: { dimensions?: Record<string, string> }) => l.dimensions?.location || '';
  const sum = (lines: Array<{ accountId: string; amountCents: number; dimensions?: Record<string, string> }>, account: string, place: string) =>
    lines.filter(l => l.accountId === account && loc(l) === place).reduce((n, l) => n + l.amountCents, 0);
  let worst = 0;
  for (let i = 0; i < 300; i++) {
    const a = 1 + Math.floor(Math.random() * 50000), b = 1 + Math.floor(Math.random() * 50000), tax = Math.floor(Math.random() * 9000);
    const lineAccounts = [
      { account: acct('sales'), weightCents: a, dimensions: { location: 'Tel Aviv' } },
      { account: acct('sales'), weightCents: b, dimensions: { location: 'Haifa' } },
    ];
    const total = a + b + tax;
    const invoice = TransactionTemplates.buildInvoiceLines({ invoiceNumber: 'P', customerName: 'C', totalCents: total, taxCents: tax, arAccount: acct('ar'), revenueAccount: acct('sales'), taxAccount: acct('vat'), lineAccounts });
    const payment = TransactionTemplates.buildPaymentLines({ documentNumber: 'P', entityName: 'C', amountCents: total, cashAccount: acct('bank'), offsetAccount: acct('ar'), isReceipt: true, lineAccounts });
    assert.ok(payment.every(l => loc(l as { dimensions?: Record<string, string> })), 'every payment line has a location');
    assert.equal(payment.reduce((n, l) => n + l.amountCents, 0), 0, 'the payment balances');
    for (const place of ['Tel Aviv', 'Haifa']) {
      assert.equal(payment.filter(l => loc(l as { dimensions?: Record<string, string> }) === place).reduce((n, l) => n + l.amountCents, 0), 0, `${place} balances on its own`);
      worst = Math.max(worst, Math.abs(sum(invoice as never, 'ar', place) + sum(payment as never, 'ar', place)));
    }
  }
  assert.equal(worst, 0, 'a full payment leaves no receivable on any label');
});

test('DIM-1 payments: a payment without labels is unchanged', () => {
  const lines = TransactionTemplates.buildPaymentLines({ documentNumber: 'B', entityName: 'V', amountCents: 1000, cashAccount: acct('bank'), offsetAccount: acct('ap'), isReceipt: false });
  assert.equal(lines.length, 2);
  assert.ok(lines.every(l => !(l as { dimensions?: unknown }).dimensions));
});
