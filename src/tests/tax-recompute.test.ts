/**
 * Tax recompute (AE-04): documents whose ledger tax differs from the document get one adjusting
 * entry between the tax account and revenue/expense; receivables/payables don't move, the old
 * entry is never edited, and a second run does nothing. The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';
import { findTaxDifferences, taxAdjustmentEntry } from '../lib/taxRecompute';
import { runDataChecks, DATA_CHECKS } from '../lib/dataChecks';
import { lineAmount } from '../lib/txFilters';
import { makeBill, makeInvoice, makeTransaction } from './fixtures';
import type { Bill, Invoice, Transaction } from '../types';
import type { Firestore } from '../server/db/pgFirestore';

const ar = { id: 'ar', name: 'Accounts Receivable' };
const ap = { id: 'ap', name: 'Accounts Payable' };
const rev = { id: 'rev', name: 'Sales' };
const exp = { id: 'exp', name: 'Supplies' };
const salesTax = { id: 'stax', name: 'Sales Tax Payable' };
const inputTax = { id: 'itax', name: 'Input Tax' };

// 120.00 owed with 20.00 tax; posted long ago as if the tax were only 18.18 (the old inclusive bug)
const invoice: Invoice = makeInvoice({ id: 'inv1', number: 'INV-1', customerName: 'Acme', amountCents: 12000, taxAmountCents: 2000, taxVersion: 2, date: '2026-03-10' });
const invoiceAccrual = (taxCents: number, extra: Partial<Transaction> = {}) => makeTransaction({
  id: 'acc-inv1', date: '2026-03-10', metadata: { invoiceId: 'inv1', type: 'invoice-accrual' },
  lines: TransactionTemplates.buildInvoiceLines({ invoiceNumber: 'INV-1', customerName: 'Acme', totalCents: 12000, taxCents, arAccount: ar, revenueAccount: rev, taxAccount: salesTax }),
  ...extra,
});
// a bill of 55.00 with 5.00 input tax, posted with none
const bill: Bill = makeBill({ id: 'b1', number: 'B-1', vendorName: 'Supplier', amountCents: 5500, taxAmountCents: 500, taxVersion: 2, date: '2026-03-11' });
const billAccrual = makeTransaction({
  id: 'acc-b1', date: '2026-03-11', metadata: { billId: 'b1', type: 'bill-accrual' },
  lines: TransactionTemplates.buildBillLines({ billNumber: 'B-1', vendorName: 'Supplier', totalCents: 5500, taxCents: 0, apAccount: ap, expenseAccount: exp, taxAccount: inputTax }),
});

const asTx = (entry: NonNullable<ReturnType<typeof taxAdjustmentEntry>['entry']>, id: string): Transaction => makeTransaction({ ...entry, id });
const sumOn = (txs: Transaction[], accountId: string) => txs.reduce((s, t) => s + (t.lines || []).filter(l => l.accountId === accountId).reduce((a, l) => a + lineAmount(l, t), 0), 0);

describe('Tax differences', () => {
  test('finds the invoice and the bill whose ledger tax differs, in cents', () => {
    const diffs = findTaxDifferences({ invoices: [invoice], bills: [bill], transactions: [invoiceAccrual(1818), billAccrual] });
    assert.deepEqual(diffs.map(d => [d.kind, d.id, d.postedTaxCents, d.expectedTaxCents, d.differenceCents]), [
      ['invoice', 'inv1', 1818, 2000, 182],
      ['bill', 'b1', 0, 500, 500],
    ]);
    assert.equal(diffs[0].taxAccount?.id, 'stax', 'the adjustment uses the accounts of the entry');
    assert.equal(diffs[0].offsetAccount?.id, 'rev');
    assert.equal(diffs[1].taxAccount, undefined, 'no tax line on the bill entry: the workspace account is used');
  });

  test('a correct posting, a draft, or a document without exactly one entry is not listed', () => {
    assert.deepEqual(findTaxDifferences({ invoices: [invoice], bills: [], transactions: [invoiceAccrual(2000)] }), []);
    assert.deepEqual(findTaxDifferences({ invoices: [{ ...invoice, status: 'draft' }], bills: [], transactions: [invoiceAccrual(1818)] }), []);
    assert.deepEqual(findTaxDifferences({ invoices: [invoice], bills: [], transactions: [] }), [], 'missing entry: the repost check lists it');
    assert.deepEqual(findTaxDifferences({ invoices: [invoice], bills: [], transactions: [invoiceAccrual(1818), invoiceAccrual(1818, { id: 'dup' })] }), []);
  });

  test('foreign currency: compared in the home currency at the document rate', () => {
    const eur = { ...invoice, currency: 'EUR', exchangeRate: 1.1 };
    // posted 18.18 EUR of tax as 20.00 USD; 20.00 EUR is 22.00 USD
    const diffs = findTaxDifferences({ invoices: [eur], bills: [], transactions: [invoiceAccrual(2000)] });
    assert.equal(diffs[0].expectedTaxCents, 2200);
    assert.equal(diffs[0].differenceCents, 200);
  });

  test('the adjusting entry moves only tax and revenue/expense, and a second run finds nothing', () => {
    const transactions = [invoiceAccrual(1818), billAccrual];
    const [invDiff, billDiff] = findTaxDifferences({ invoices: [invoice], bills: [bill], transactions });
    const invAdj = taxAdjustmentEntry(invDiff, '2026-10-02').entry!;
    const billAdj = taxAdjustmentEntry(billDiff, '2026-10-02', { tax: inputTax, offset: exp }).entry!;
    for (const entry of [invAdj, billAdj]) assert.equal(entry.lines.reduce((s, l) => s + l.amountCents, 0), 0, 'balanced');
    const after = [...transactions, asTx(invAdj, 'adj1'), asTx(billAdj, 'adj2')];
    assert.equal(sumOn(after, 'stax'), -2000, 'sales tax payable now holds the full 20.00');
    assert.equal(sumOn(after, 'rev'), -10000, 'revenue is the net 100.00');
    assert.equal(sumOn(after, 'ar'), 12000, 'receivables untouched');
    assert.equal(sumOn(after, 'itax'), 500);
    assert.equal(sumOn(after, 'exp'), 5000);
    assert.equal(sumOn(after, 'ap'), -5500, 'payables untouched');
    assert.deepEqual(findTaxDifferences({ invoices: [invoice], bills: [bill], transactions: after }), []);

    // reversing the adjustment (e.g. the document is reposted) counts it out again
    const reversal = makeTransaction({ id: 'rev-adj1', metadata: { invoiceId: 'inv1', isReversal: true, reversesTxId: 'adj1' }, lines: invAdj.lines.map(l => ({ ...l, amountCents: -l.amountCents })) });
    assert.equal(findTaxDifferences({ invoices: [invoice], bills: [bill], transactions: [...after, reversal] }).length, 1);
  });

  test('without accounts to use, the entry is refused with the reason', () => {
    const [, billDiff] = findTaxDifferences({ invoices: [invoice], bills: [bill], transactions: [invoiceAccrual(1818), billAccrual] });
    assert.match(taxAdjustmentEntry(billDiff, '2026-10-02').error || '', /input tax account/);
  });

  test('Data Health lists them', () => {
    const findings = runDataChecks({ transactions: [invoiceAccrual(1818)], accounts: [], invoices: [invoice], bills: [], recurring: [], today: '2026-10-02', baseCurrency: 'USD' }, DATA_CHECKS.filter(c => c.id === 'tax-posting'));
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].record, { type: 'invoice', id: 'inv1' });
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Tax recompute in the database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_taxfix_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let recompute: typeof import('../server/services/taxRecomputeService').recomputeDocumentTax;

  before(async () => {
    process.env.DATABASE_URL = url;
    process.env.SYSTEM_SALT = process.env.SYSTEM_SALT || 'test-tax-recompute-salt-32-chars-at-least';
    const { getDb } = await import('../server/db/firestore');
    ({ recomputeDocumentTax: recompute } = await import('../server/services/taxRecomputeService'));
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Tax fix', currency: 'USD', members: ['owner-1'], timezone: 'UTC' });
    for (const [name, fields] of [
      ['ar', { name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }],
      ['rev', { name: 'Sales', type: 'income', category: 'Revenue' }],
      ['stax', { name: 'Sales Tax Payable', type: 'liability', category: 'Taxes' }],
    ] as const) await db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, ...fields });
    await db.collection('invoices').doc(id('inv')).set({ ...invoice, id: id('inv'), workspaceId: ws });
    const accrual = makeTransaction({
      id: id('acc'), workspaceId: ws, uid: 'owner-1', date: '2026-03-10', totalAmountCents: 12000,
      metadata: { invoiceId: id('inv'), type: 'invoice-accrual' },
      lines: TransactionTemplates.buildInvoiceLines({ invoiceNumber: 'INV-1', customerName: 'Acme', totalCents: 12000, taxCents: 1818, arAccount: { id: id('ar'), name: 'AR' }, revenueAccount: { id: id('rev'), name: 'Sales' }, taxAccount: { id: id('stax'), name: 'Sales Tax Payable' } }),
    });
    await db.collection('transactions').doc(id('acc')).set(accrual);
  });

  after(async () => {
    for (const table of ['transactions', 'invoices', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  const adjustments = async () => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs
    .map(d => d.data() as Transaction).filter(t => (t.metadata as { type?: string } | undefined)?.type === 'tax-adjustment');

  test('dry run lists the difference and writes nothing', async () => {
    const result = await recompute(db, { workspaceId: ws, uid: 'owner-1' });
    assert.equal(result.differences.length, 1);
    assert.equal(result.differences[0].differenceCents, 182);
    assert.equal((await adjustments()).length, 0);
  });

  test('a closed period refuses the adjustment', async () => {
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-06-30' });
    const result = await recompute(db, { workspaceId: ws, uid: 'owner-1', apply: true, date: '2026-06-15' });
    assert.equal(result.posted.length, 0);
    assert.match(result.failed[0].error, /lock|closed/i);
    assert.equal((await adjustments()).length, 0);
  });

  test('apply posts one audited adjusting entry; a second run does nothing', async () => {
    const result = await recompute(db, { workspaceId: ws, uid: 'owner-1', apply: true, date: '2026-10-02' });
    assert.deepEqual(result.failed, []);
    assert.equal(result.posted.length, 1);
    const [adj] = await adjustments();
    assert.equal(adj.date, '2026-10-02');
    assert.equal(adj.lines.find(l => l.accountId === id('stax'))?.amountCents, -182);
    assert.equal(adj.lines.find(l => l.accountId === id('rev'))?.amountCents, 182);
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    assert.ok(audit.some(a => a.action === 'tax_recomputed'));

    const again = await recompute(db, { workspaceId: ws, uid: 'owner-1', apply: true, date: '2026-10-02' });
    assert.equal(again.differences.length, 0);
    assert.equal((await adjustments()).length, 1);
  });
});
