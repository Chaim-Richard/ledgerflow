/**
 * Independent audit Pass A — AF-002 label reconciliation cent correctness.
 * Every expected figure below is worked by hand in the comments; none is produced by the code
 * under review. Evidence: audit/function-audit/AF-002-label-cent-reconciliation.md
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';
import type { TransactionLine } from '../types';

const ar = { id: 'ar', name: 'A/R' };
const rev = { id: 'rev', name: 'Revenue' };
const taxAcct = { id: 'tax', name: 'Tax payable' };
const disc = { id: 'disc', name: 'Sales discounts' };
const ap = { id: 'ap', name: 'A/P' };
const exp = { id: 'exp', name: 'Expense' };
const cash = { id: 'cash', name: 'Cash' };

const labelOf = (l: TransactionLine) =>
  JSON.stringify((l as { dimensions?: Record<string, string> }).dimensions || {});
const perLabelSums = (lines: TransactionLine[]) => {
  const m = new Map<string, number>();
  for (const l of lines) m.set(labelOf(l), (m.get(labelOf(l)) || 0) + l.amountCents);
  return m;
};
const entrySum = (lines: TransactionLine[]) => lines.reduce((s, l) => s + l.amountCents, 0);

test('AF-002 mission example: two $100 labelled parts, $36 tax, $1.01 discount, $234.99 total', () => {
  const lines = TransactionTemplates.buildInvoiceLines({
    invoiceNumber: 'INV-1', customerName: 'Cust', totalCents: 23499, taxCents: 3600, discountCents: 101,
    arAccount: ar, revenueAccount: rev, taxAccount: taxAcct, discountAccount: disc,
    lineAccounts: [
      { account: rev, weightCents: 10000, dimensions: { property: 'A' } },
      { account: rev, weightCents: 10000, dimensions: { property: 'B' } },
    ],
  });
  assert.equal(entrySum(lines), 0, 'the entry itself balances');
  // hand work: discount 101 -> 51/50; tax 3600 -> 1800/1800; A/R is the balancer
  // A: -10000 + 51 - 1800 + 11749 = 0 ; B: -10000 + 50 - 1800 + 11750 = 0
  const byAcct = (acct: string, label: string) =>
    lines.filter(l => l.accountId === acct && labelOf(l) === JSON.stringify({ property: label })).reduce((s, l) => s + l.amountCents, 0);
  assert.equal(byAcct('disc', 'A'), 51);
  assert.equal(byAcct('disc', 'B'), 50);
  assert.equal(byAcct('tax', 'A'), -1800);
  assert.equal(byAcct('tax', 'B'), -1800);
  assert.equal(byAcct('ar', 'A'), 11749);
  assert.equal(byAcct('ar', 'B'), 11750);
  for (const [, v] of perLabelSums(lines)) assert.equal(v, 0, 'every label trial-balances to zero');
});

test('AF-002 three labels with a 1-cent discount and non-divisible tax still balance per label', () => {
  // total 30199, tax 100, discount 1 -> gross revenue 30100 split 10034/10033/10033
  const lines = TransactionTemplates.buildInvoiceLines({
    invoiceNumber: 'INV-2', customerName: 'Cust', totalCents: 30199, taxCents: 100, discountCents: 1,
    arAccount: ar, revenueAccount: rev, taxAccount: taxAcct, discountAccount: disc,
    lineAccounts: [
      { account: rev, weightCents: 10000, dimensions: { property: 'A' } },
      { account: rev, weightCents: 10000, dimensions: { property: 'B' } },
      { account: rev, weightCents: 10000, dimensions: { property: 'C' } },
    ],
  });
  assert.equal(entrySum(lines), 0);
  for (const [, v] of perLabelSums(lines)) assert.equal(v, 0);
});

test('AF-002 labelled payment: cash and the offset account split in the document proportions', () => {
  const lines = TransactionTemplates.buildPaymentLines({
    documentNumber: 'INV-1', entityName: 'Cust', amountCents: 10000, isReceipt: true,
    cashAccount: cash, offsetAccount: ar,
    lineAccounts: [
      { account: rev, weightCents: 7000, dimensions: { property: 'A' } },
      { account: rev, weightCents: 3000, dimensions: { property: 'B' } },
    ],
  });
  assert.deepEqual(perLabelSums(lines), new Map([[JSON.stringify({ property: 'A' }), 0], [JSON.stringify({ property: 'B' }), 0]]));
});

test('AF-002 labelled bill with tax and discount balances per label', () => {
  const lines = TransactionTemplates.buildBillLines({
    billNumber: 'B-1', vendorName: 'V', totalCents: 23499, taxCents: 3600, discountCents: 101,
    apAccount: ap, expenseAccount: exp, taxAccount: taxAcct, discountAccount: disc,
    lineAccounts: [
      { account: exp, weightCents: 10000, dimensions: { property: 'A' } },
      { account: exp, weightCents: 10000, dimensions: { property: 'B' } },
    ],
  });
  assert.equal(entrySum(lines), 0);
  for (const [, v] of perLabelSums(lines)) assert.equal(v, 0);
});

test('AF-002 property: 2,000 random invoice shapes all balance as an entry and per label', () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const n = 1 + (seed % 4);
    const weights = Array.from({ length: n }, (_, i) => ((seed * (i + 7)) % 9999) + 1);
    const total = (seed * 137) % 500000 + 1;
    const tax = seed % 3 === 0 ? seed % 5000 : 0;
    const discount = seed % 4 === 0 ? seed % 300 : 0;
    const out = TransactionTemplates.buildInvoiceLines({
      invoiceNumber: String(seed), customerName: 'c', totalCents: total, taxCents: tax, discountCents: discount,
      arAccount: ar, revenueAccount: rev, ...(tax ? { taxAccount: taxAcct } : {}), ...(discount ? { discountAccount: disc } : {}),
      lineAccounts: weights.map((w, i) => ({ account: rev, weightCents: w, dimensions: { property: `L${i}` } })),
    });
    assert.equal(entrySum(out), 0, `entry balance seed ${seed}`);
    for (const [k, v] of perLabelSums(out)) assert.equal(v, 0, `label ${k} seed ${seed}`);
  }
});

test('AF-002-F1 (latent): negative tax on a negative total silently drops the tax line -> unbalanced entry', () => {
  // Production posting guards amount <= 0 before calling the template (invoicePosting.ts/billPosting.ts),
  // so this is not reachable through document posting today; it is a defensive-contract gap in the
  // exported kernel primitive. Observed output locks the gap: no tax line is emitted because the
  // template gates on taxCents > 0, leaving sum = -1800 instead of 0.
  const lines = TransactionTemplates.buildInvoiceLines({
    invoiceNumber: 'CN-X', customerName: 'Cust', totalCents: -11800, taxCents: -1800,
    arAccount: ar, revenueAccount: rev, taxAccount: taxAcct,
    lineAccounts: [
      { account: rev, weightCents: 5000, dimensions: { property: 'A' } },
      { account: rev, weightCents: 5000, dimensions: { property: 'B' } },
    ],
  });
  assert.equal(lines.some(l => l.accountId === 'tax'), false, 'OBSERVED DEFECT: negative tax line omitted');
  assert.equal(entrySum(lines), -1800, 'OBSERVED DEFECT: unbalanced journal (-1800)');
});
