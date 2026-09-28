/**
 * Foreign-currency documents are posted once converted (L-105): a EUR 100 invoice at 1.10 is
 * 110.00 in the ledger, not 121.00. Runs the real LedgerPostService with the server call
 * captured (the body it would send to /api/v1/transactions/bulk).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { lineAmount } from '../lib/txFilters';
import { makeBill, makeChartAccount, makeInvoice, makeTransaction } from './fixtures';
import { findPostingMismatches } from '../lib/postingCheck';
import { allocateCents } from '../kernel/templates/TransactionTemplates';
import type { Invoice, Transaction, Workspace } from '../types';

type Posted = Transaction & { metadata?: Record<string, unknown> };

describe('Foreign-currency postings', () => {
  const sent: Posted[][] = [];
  const realFetch = globalThis.fetch;
  let LedgerPostService: typeof import('../services/LedgerPostService').LedgerPostService;

  before(async () => {
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      sent.push(JSON.parse(String(init?.body || '{}')).transactions || []);
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    ({ LedgerPostService } = await import('../services/LedgerPostService'));
  });
  after(() => { globalThis.fetch = realFetch; });

  const context = () => ({
    lockDate: null,
    transactions: [],
    inventory: [],
    workspaces: [{ id: 'w1', uid: 'u1', name: 'W', currency: 'USD' } as Workspace],
    accounts: [
      makeChartAccount({ id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }),
      makeChartAccount({ id: 'ap', name: 'Accounts Payable', type: 'liability', category: 'Payables' }),
      makeChartAccount({ id: 'cash', name: 'Checking', type: 'asset', category: 'Cash' }),
      makeChartAccount({ id: 'rev', name: 'Sales', type: 'income', category: 'Revenue' }),
      makeChartAccount({ id: 'exp', name: 'Supplies', type: 'expense' }),
      makeChartAccount({ id: 'tax', name: 'Sales Tax Payable', type: 'liability', category: 'Taxes' }),
      makeChartAccount({ id: 'ret', name: 'Sales Returns', type: 'income', category: 'Revenue' }),
    ],
  });
  const byAccount = (tx: Posted) => Object.fromEntries(tx.lines.map(l => [l.accountId, lineAmount(l, tx)]));

  test('an invoice and its payment are posted in the base currency, once converted', async () => {
    sent.length = 0;
    await LedgerPostService.postInvoiceLedger('inv1', {
      number: 'INV-1', customerId: 'c1', customerName: 'Acme', date: '2026-03-10', dueDate: '2026-04-10',
      amountCents: 10000, currency: 'EUR', exchangeRate: 1.1, status: 'paid', amountPaidCents: 10000,
    }, 'w1', 'u1', undefined, context());
    const [accrual, payment] = sent[0];
    assert.equal(byAccount(accrual).ar, 11000, 'EUR 100 at 1.10 = USD 110');
    assert.equal(byAccount(accrual).rev, -11000);
    assert.equal(accrual.currency, 'USD');
    assert.equal(accrual.metadata?.documentCurrency, 'EUR');
    assert.equal(accrual.metadata?.documentExchangeRate, 1.1);
    assert.equal(byAccount(payment).cash, 11000);
    for (const tx of sent[0]) assert.equal(tx.lines.reduce((s, l) => s + lineAmount(l, tx), 0), 0, 'balanced in the base currency');
  });

  test('bills, credit notes, vendor credits and payments too', async () => {
    sent.length = 0;
    const ctx = context();
    await LedgerPostService.postBillLedger('b1', { number: 'B-1', vendorId: 'v1', vendorName: 'Supplier', date: '2026-03-10', dueDate: '2026-04-10', amountCents: 20000, currency: 'EUR', exchangeRate: 1.1, status: 'pending', splits: [{ accountId: 'exp', amountCents: 20000 }] }, 'w1', 'u1', undefined, ctx);
    await LedgerPostService.postCreditNoteLedger('cn1', { number: 'CN-1', customerId: 'c1', customerName: 'Acme', date: '2026-03-10', amountCents: 5000, currency: 'EUR', exchangeRate: 1.1, status: 'open' }, 'w1', 'u1', undefined, ctx);
    await LedgerPostService.postVendorCreditLedger('vc1', { number: 'VC-1', vendorId: 'v1', vendorName: 'Supplier', date: '2026-03-10', amountCents: 5000, currency: 'EUR', exchangeRate: 1.1, status: 'open' }, 'w1', 'u1', undefined, ctx);
    await LedgerPostService.postPaymentLedger('p1', { direction: 'received', contactId: 'c1', contactName: 'Acme', date: '2026-03-12', amountCents: 3000, currency: 'EUR', exchangeRate: 1.1, depositAccountId: 'cash' }, 'w1', 'u1', undefined, ctx);
    const [bill] = sent[0];
    assert.equal(byAccount(bill).ap, -22000);
    assert.equal(byAccount(sent[1][0]).ar, -5500);
    assert.equal(byAccount(sent[2][0]).ap, 5500);
    assert.equal(byAccount(sent[3][0]).cash, 3300);
    for (const batch of sent) for (const tx of batch) assert.equal(tx.lines.reduce((s, l) => s + lineAmount(l, tx), 0), 0);
  });

  const withSecondAccounts = () => {
    const ctx = context();
    ctx.accounts.push(
      makeChartAccount({ id: 'rev2', name: 'Consulting Income', type: 'income', category: 'Revenue' }),
      makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense' }),
    );
    return ctx;
  };

  test('L-115: invoice lines post to their own income accounts; tax added on top is owed (L-113)', async () => {
    sent.length = 0;
    // 60.00 products + 40.00 consulting, 20% on top: 100.00 + 20.00 = 120.00 owed (saved by the form as taxVersion 2)
    await LedgerPostService.postInvoiceLedger('inv2', {
      number: 'INV-2', customerId: 'c1', customerName: 'Acme', date: '2026-03-10', dueDate: '2026-04-10', status: 'sent',
      amountCents: 12000, taxAmountCents: 2000, taxInclusive: true, taxVersion: 2, lineSumCents: 10000,
      items: [
        { id: 'a', description: 'Products', quantity: 1, rateCents: 6000, amountCents: 6000, accountId: 'rev' },
        { id: 'b', description: 'Consulting', quantity: 1, rateCents: 4000, amountCents: 4000, accountId: 'Consulting Income' },
      ],
    }, 'w1', 'u1', undefined, withSecondAccounts());
    const lines = byAccount(sent[0][0]);
    assert.deepEqual([lines.ar, lines.rev, lines.rev2, lines.tax], [12000, -6000, -4000, -2000]);
  });

  test('prices including tax: revenue is split net of tax, to the cent', async () => {
    sent.length = 0;
    // two lines of 60.00 including 20%: 120.00 owed, tax 20.00, revenue 100.00 → 50.00 each
    await LedgerPostService.postInvoiceLedger('inv3', {
      number: 'INV-3', customerId: 'c1', customerName: 'Acme', date: '2026-03-10', dueDate: '2026-04-10', status: 'sent',
      amountCents: 12000, taxAmountCents: 2000, taxInclusive: true, taxVersion: 2, pricesIncludeTax: true,
      items: [
        { id: 'a', description: 'A', quantity: 1, rateCents: 6000, amountCents: 6000, accountId: 'rev' },
        { id: 'b', description: 'B', quantity: 1, rateCents: 6000, amountCents: 6000, accountId: 'rev2' },
      ],
    }, 'w1', 'u1', undefined, withSecondAccounts());
    const lines = byAccount(sent[0][0]);
    assert.deepEqual([lines.rev, lines.rev2, lines.tax], [-5000, -5000, -2000]);
  });

  test('bill lines post to their own expense accounts; a line without an account uses the default', async () => {
    sent.length = 0;
    await LedgerPostService.postBillLedger('b2', {
      number: 'B-2', vendorId: 'v1', vendorName: 'Landlord', date: '2026-03-10', dueDate: '2026-04-10', status: 'pending', amountCents: 4000,
      splits: [{ accountId: 'rent', amountCents: 3000 }, { accountId: 'exp', amountCents: 700 }, { accountId: '', amountCents: 300 }],
    }, 'w1', 'u1', undefined, withSecondAccounts());
    const lines = byAccount(sent[0][0]);
    assert.deepEqual([lines.rent, lines.exp, lines.ap], [3000, 1000, -4000]);
  });

  test('splitting an amount by weights adds up exactly', () => {
    assert.deepEqual(allocateCents(100, [1, 1, 1]), [34, 33, 33]);
    assert.deepEqual(allocateCents(10000, [6000, 4000]), [6000, 4000]);
    assert.deepEqual(allocateCents(500, [0, 0]), [500, 0]);
  });
});

describe('Repost check', () => {
  const inv = (fields: Partial<Invoice>): Invoice => makeInvoice({ customerId: 'c1', customerName: 'Acme', dueDate: '2026-04-10', ...fields });
  const accrual = (id: string, invoiceId: string, cents: number, fields: Partial<Transaction> = {}): Transaction => makeTransaction({
    id, date: '2026-03-10', status: 'completed', exchangeRate: 1,
    metadata: { invoiceId, type: 'invoice-accrual' },
    lines: [{ id: 'a', accountId: 'ar', amountCents: cents }, { id: 'b', accountId: 'rev', amountCents: -cents }],
    ...fields,
  });

  test('finds missing, doubled, left-over and wrong-amount entries; a correct one is fine', () => {
    const issues = findPostingMismatches({
      invoices: [
        inv({ id: 'ok', number: 'INV-1', amountCents: 5000, status: 'sent' }),
        inv({ id: 'missing', number: 'INV-2', amountCents: 5000, status: 'sent' }),
        inv({ id: 'double', number: 'INV-3', amountCents: 5000, status: 'sent' }),
        inv({ id: 'voided', number: 'INV-4', amountCents: 5000, status: 'void' }),
        inv({ id: 'fx', number: 'INV-5', amountCents: 10000, exchangeRate: 1.1, status: 'sent' }),
        inv({ id: 'reposted', number: 'INV-6', amountCents: 5000, status: 'sent' }),
        inv({ id: 'disc', number: 'INV-7', amountCents: 9000, discountCents: 1000, status: 'sent' }),
        inv({ id: 'draft', number: 'INV-8', amountCents: 5000, status: 'draft' }),
      ],
      bills: [],
      transactions: [
        accrual('t-ok', 'ok', 5000),
        accrual('t-d1', 'double', 5000), accrual('t-d2', 'double', 5000),
        accrual('t-void', 'voided', 5000),
        // the old double conversion: 11000 base cents stored with rate 1.1 → 12100
        accrual('t-fx', 'fx', 11000, { exchangeRate: 1.1 }),
        // an old entry reversed, then a correct one
        accrual('t-old', 'reposted', 4000), makeTransaction({ id: 't-rev', date: '2026-03-11', status: 'completed', metadata: { invoiceId: 'reposted', type: 'invoice-reversal', reversesTxId: 't-old', isReversal: true }, lines: [] }),
        accrual('t-new', 'reposted', 5000),
        accrual('t-disc', 'disc', 10000),
        accrual('t-draft', 'draft', 5000, { status: 'draft' }),
      ],
    });
    assert.deepEqual(issues.map(i => [i.id, i.issue, i.expectedCents, i.postedCents]), [
      ['missing', 'missing', 5000, 0],
      ['double', 'duplicate', 5000, 10000],
      ['voided', 'orphan', 0, 5000],
      ['fx', 'amount', 11000, 12100],
    ]);
  });

  test('bills: the payable side is checked', () => {
    const issues = findPostingMismatches({
      invoices: [],
      bills: [makeBill({ id: 'b1', number: 'B-1', vendorId: 'v', vendorName: 'Supplier', amountCents: 7000, status: 'pending', dueDate: '2026-04-01' } as never)],
      transactions: [makeTransaction({ id: 'tb', date: '2026-03-01', status: 'completed', metadata: { billId: 'b1', type: 'bill-accrual' }, lines: [{ id: 'x', accountId: 'exp', amountCents: 6000 }, { id: 'y', accountId: 'ap', amountCents: -6000 }] })],
    });
    assert.deepEqual(issues.map(i => [i.id, i.issue, i.expectedCents, i.postedCents]), [['b1', 'amount', 7000, 6000]]);
  });
});

const dbUrl = process.env.LF_TEST_DATABASE_URL;

describe('Foreign-currency payments recorded by the server', { skip: !dbUrl && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_fxpay_${Math.random().toString(16).slice(2, 10)}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: import('../server/db/pgFirestore').Firestore;
  let createPaymentAtomic: typeof import('../server/services/paymentService').createPaymentAtomic;

  before(async () => {
    process.env.DATABASE_URL = dbUrl;
    ({ createPaymentAtomic } = await import('../server/services/paymentService'));
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'o', name: 'FX', currency: 'USD' });
    await db.collection('chartAccounts').doc(id('cash')).set({ workspaceId: ws, name: 'Checking', type: 'asset', category: 'Cash', code: '1000' });
    await db.collection('chartAccounts').doc(id('ar')).set({ workspaceId: ws, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1200' });
    await db.collection('invoices').doc(id('eur')).set({ workspaceId: ws, customerId: 'c', number: 'E1', amountCents: 10000, currency: 'EUR', exchangeRate: 1.1, status: 'sent', date: '2026-03-01' });
    await db.collection('invoices').doc(id('usd')).set({ workspaceId: ws, customerId: 'c', number: 'U1', amountCents: 5000, status: 'sent', date: '2026-03-01' });
  });

  after(async () => {
    for (const table of ['transactions', 'payments', 'invoices', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  const pay = (allocations: { documentId: string; amountCents: number }[], amountCents: number) => createPaymentAtomic(db, {
    workspaceId: ws, uid: 'o', paymentDate: '2026-03-15', amountCents, customerId: 'c', cashAccountId: id('cash'),
    allocations: allocations.map(a => ({ ...a, documentType: 'invoice' as const })),
  });

  test('EUR 100 paid on a EUR invoice at 1.10 is 110.00 in the ledger; the invoice is paid', async () => {
    const result = await pay([{ documentId: id('eur'), amountCents: 10000 }], 10000);
    assert.equal(result.payment.currency, 'EUR');
    assert.equal(result.payment.exchangeRate, 1.1);
    const tx = result.ledgerTransaction;
    assert.equal(tx.currency, 'USD');
    assert.deepEqual(tx.lines.map((l: { amountCents: number }) => l.amountCents), [11000, -11000]);
    assert.equal((await db.collection('invoices').doc(id('eur')).get()).data()?.status, 'paid');
  });

  test('documents in two currencies can\'t share one payment', async () => {
    await db.collection('invoices').doc(id('eur2')).set({ workspaceId: ws, customerId: 'c', number: 'E2', amountCents: 1000, currency: 'EUR', exchangeRate: 1.1, status: 'sent', date: '2026-03-01' });
    await assert.rejects(pay([{ documentId: id('eur2'), amountCents: 1000 }, { documentId: id('usd'), amountCents: 5000 }], 6000), /same currency/);
    const plain = await pay([{ documentId: id('usd'), amountCents: 5000 }], 5000);
    assert.deepEqual(plain.ledgerTransaction.lines.map((l: { amountCents: number }) => l.amountCents), [5000, -5000]);
  });
});
