/**
 * The main path (DA-07, docs/ROADMAP.md), one simple business, end to end against a real database:
 * import the accounts, the customer and the vendor → a bank statement's lines → an invoice and a bill
 * (posted by the app's own posting code) → a part payment of the invoice and the bill paid in full →
 * the two bank lines matched to those payments → the reports (trial balance, profit and loss,
 * balance sheet, receivables aging) → the month closed, and a write into it refused → a backup and a
 * restore that give the same figures → a report figure traced back to its entries, its invoice and
 * its bank line. Hebrew and English data together.
 *
 * Every step goes through the routes and services the app uses (the browser's posting code's
 * requests are sent to the same server routes here). A signed-in browser run of the same path needs
 * a local Supabase sign-in stack and is not part of this test.
 * The test runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import type { ChartAccount, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('The main path, one simple business', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const ws = `ws_main_${suffix}`;
  const OWNER = 'owner-1';
  const MAY_END = '2026-05-31';
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  let customerId = '';
  let vendorId = '';
  const invoiceId = `${ws}_inv1`;
  const billId = `${ws}_bill1`;
  const bankLine = { deposit: `${ws}_bl1`, withdrawal: `${ws}_bl2` };
  const paid: Record<'invoice' | 'bill', string> = { invoice: '', bill: '' };
  let earlyBackup: unknown;

  const send = async (method: string, path: string, body?: unknown) => {
    const res = await realFetch(`${base}${path}`, {
      method, headers: { 'content-type': 'application/json', 'x-test-uid': OWNER }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const report = async (path: string) => (await send('GET', `/api/v1/reports${path}${path.includes('?') ? '&' : '?'}workspaceId=${ws}`)).body;
  const cents = (tb: Record<string, { debit: number; credit: number }>) => Object.values(tb).reduce((s, r) => ({ d: s.d + r.debit, c: s.c + r.credit }), { d: 0, c: 0 });
  const context = (): LedgerPostContext => ({
    accounts: Object.values(acct), lockDate: null, transactions: [], inventory: [], uid: OWNER,
    workspaces: [{ id: ws, uid: OWNER, name: 'חנות הדוגמה / Sample Shop', currency: 'USD' } as Workspace],
  });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { paymentRouter } = await import('../server/routes/paymentRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    // 1. the books: a new workspace, its owner, its home currency
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'חנות הדוגמה / Sample Shop', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@shop.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/reports', reportRouter);
    app.use('/api/v1/payments', paymentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // the app's own posting code calls the API by path (no host): send those calls to this server, as the owner
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'payments', 'bankLines', 'customers', 'vendors', 'chartAccounts', 'periods', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('2. the accounts, the customer and the vendor are imported', async () => {
    const accounts = await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'accounts', rows: [
      { name: 'Checking', code: '1000', type: 'Bank' },
      { name: 'Accounts Receivable', code: '1100', type: 'Accounts receivable' },
      { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' },
      { name: 'מכירות / Sales', code: '4000', type: 'Income' },
      { name: 'Office expenses', code: '6000', type: 'Expense' },
    ] });
    assert.equal(accounts.status, 200, JSON.stringify(accounts.body));
    assert.equal(accounts.body.created, 5);
    for (const d of (await db.collection('chartAccounts').where('workspaceId', '==', ws).get()).docs) acct[d.data().code] = { ...d.data(), id: d.id } as ChartAccount;
    assert.deepEqual(Object.keys(acct).sort(), ['1000', '1100', '2000', '4000', '6000']);

    const customers = await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'customers', rows: [{ name: 'לקוח Acme בע"מ', email: 'ap@acme.test' }] });
    const vendors = await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'vendors', rows: [{ name: 'Office Depot' }] });
    assert.equal(customers.status, 200, JSON.stringify(customers.body));
    assert.equal(vendors.status, 200, JSON.stringify(vendors.body));
    customerId = (await db.collection('customers').where('workspaceId', '==', ws).get()).docs[0].id;
    vendorId = (await db.collection('vendors').where('workspaceId', '==', ws).get()).docs[0].id;
  });

  test('3. the bank statement\'s lines wait to be matched', async () => {
    await db.collection('bankLines').doc(bankLine.deposit).set({ workspaceId: ws, accountId: acct['1000'].id, date: '2026-05-20', amountCents: 60000, description: 'DEPOSIT ACME 0520', status: 'pending' });
    await db.collection('bankLines').doc(bankLine.withdrawal).set({ workspaceId: ws, accountId: acct['1000'].id, date: '2026-05-22', amountCents: -25000, description: 'OFFICE DEPOT #12', status: 'pending' });
    assert.equal((await db.collection('bankLines').where('workspaceId', '==', ws).get()).docs.length, 2);
  });

  test('4. an invoice and a bill are posted by the app\'s own posting code', async () => {
    const invoice = {
      id: invoiceId, workspaceId: ws, uid: OWNER, number: 'INV-1001', customerId, customerName: 'לקוח Acme בע"מ', date: '2026-05-05', dueDate: '2026-06-04',
      status: 'sent' as const, amountCents: 100000, amountPaidCents: 0, currency: 'USD',
      items: [{ id: 'l1', description: 'ייעוץ / Consulting', quantity: 10, rateCents: 10000, amountCents: 100000, accountId: acct['4000'].id }],
    };
    await postInvoiceLedger(invoiceId, invoice, ws, OWNER, { collection: 'invoices', docId: invoiceId, action: 'create', data: invoice }, context());
    const bill = {
      id: billId, workspaceId: ws, uid: OWNER, number: 'B-77', vendorId, vendorName: 'Office Depot', date: '2026-05-10', dueDate: '2026-06-09',
      status: 'approved' as const, amountCents: 25000, currency: 'USD', splits: [{ accountId: acct['6000'].id, amountCents: 25000, description: 'נייר / Paper' }],
    };
    await postBillLedger(billId, bill as never, ws, OWNER, { collection: 'bills', docId: billId, action: 'create', data: bill }, context());
    assert.equal((await db.collection('invoices').doc(invoiceId).get()).data()?.number, 'INV-1001');
    assert.equal((await db.collection('bills').doc(billId).get()).data()?.number, 'B-77');
    const entries = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    assert.ok(entries.some(e => e.metadata?.invoiceId === invoiceId), 'the invoice is in the ledger');
    assert.ok(entries.some(e => e.metadata?.billId === billId), 'the bill is in the ledger');
  });

  test('5. the customer pays part of the invoice; the bill is paid in full', async () => {
    const customer = await send('POST', '/api/v1/payments', {
      workspaceId: ws, amountCents: 60000, paymentDate: '2026-05-20', cashAccountId: acct['1000'].id, paymentMethod: 'transfer', customerId, entityName: 'לקוח Acme בע"מ',
      allocations: [{ documentId: invoiceId, documentType: 'invoice', amountCents: 60000 }],
    });
    assert.equal(customer.status, 200, JSON.stringify(customer.body));
    paid.invoice = customer.body.data.transactionId;
    const vendor = await send('POST', '/api/v1/payments', {
      workspaceId: ws, amountCents: 25000, paymentDate: '2026-05-22', cashAccountId: acct['1000'].id, paymentMethod: 'transfer', vendorId, entityName: 'Office Depot',
      allocations: [{ documentId: billId, documentType: 'bill', amountCents: 25000 }],
    });
    assert.equal(vendor.status, 200, JSON.stringify(vendor.body));
    paid.bill = vendor.body.data.transactionId;
    assert.equal((await db.collection('invoices').doc(invoiceId).get()).data()?.amountPaidCents, 60000);
    assert.equal((await db.collection('bills').doc(billId).get()).data()?.status, 'paid');
  });

  test('6. each bank line is matched to its payment', async () => {
    const match = await send('POST', '/api/v1/transactions/reconcile', { workspaceId: ws, operations: [
      { type: 'updateBankLine', id: bankLine.deposit, data: { status: 'matched', matchedTransactionId: paid.invoice } },
      { type: 'updateTransaction', id: paid.invoice, data: { status: 'reconciled' } },
      { type: 'updateBankLine', id: bankLine.withdrawal, data: { status: 'matched', matchedTransactionId: paid.bill } },
      { type: 'updateTransaction', id: paid.bill, data: { status: 'reconciled' } },
    ] });
    assert.equal(match.status, 200, JSON.stringify(match.body));
    const lines = (await db.collection('bankLines').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    assert.deepEqual(lines.map(l => l.status), ['matched', 'matched']);
  });

  test('7. the reports agree with what happened', async () => {
    const tb = await report(`/trial-balance?asOfDate=${MAY_END}`);
    const totals = cents(tb);
    assert.equal(totals.d, totals.c, 'the trial balance balances');
    const pl = await report('/profit-and-loss?startDate=2026-05-01&endDate=2026-05-31');
    assert.deepEqual([pl.income.total, pl.expense.total, pl.netIncome], [100000, 25000, 75000]);
    // N-08: on cash basis, the 600.00 the customer paid of the 1,000.00 invoice, and the bill paid in full
    const cash = await report('/profit-and-loss?startDate=2026-05-01&endDate=2026-05-31&basis=cash');
    assert.deepEqual([cash.income.total, cash.expense.total, cash.netIncome, cash.basis, cash.leftOut], [60000, 25000, 35000, 'cash', 0]);
    // and the balance sheet on cash basis: no receivable, the cash-basis profit, still balanced
    const cashBs = await report(`/balance-sheet?endDate=${MAY_END}&basis=cash`);
    assert.deepEqual([cashBs.totalAssets, cashBs.netIncome, cashBs.notApplied, cashBs.isBalanced], [35000, 35000, 0, true]);
    const bs = await report(`/balance-sheet?endDate=${MAY_END}`);
    assert.equal(bs.isBalanced, true);
    assert.equal(bs.totalAssets, 35000 + 40000, 'checking 350.00 and receivables 400.00');
    assert.equal(bs.netIncome, 75000);
    const aging = await report('/aging?type=ar');
    const owed = JSON.stringify(aging);
    assert.match(owed, /40000/, 'the customer still owes 400.00');
    // a backup before the month is closed (step 9 shows it can't replace the closed month)
    const { exportWorkspaceBackup } = await import('../server/services/workspaceRestoreService');
    earlyBackup = await exportWorkspaceBackup(db, ws, OWNER);
  });

  test('8. the month is closed and a write into it is refused', async () => {
    const close = await send('POST', `/api/v1/workspaces/${ws}/periods/2026-05/close`, { mode: 'hard' });
    assert.equal(close.status, 200, JSON.stringify(close.body));
    const late = await send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{
      id: `${ws}_late`, uid: OWNER, workspaceId: ws, date: '2026-05-25', description: 'Late entry', totalAmountCents: 1000, currency: 'USD', status: 'completed', type: 'journal',
      lines: [{ accountId: acct['6000'].id, amountCents: 1000 }, { accountId: acct['1000'].id, amountCents: -1000 }],
    }] });
    assert.notEqual(late.status, 200, 'refused');
    assert.match(JSON.stringify(late.body), /lock|closed/i);
    assert.equal((await db.collection('transactions').doc(`${ws}_late`).get()).exists, false);
  });

  test('9. a backup made after the close restores the same figures; one from before it can\'t replace closed months', async () => {
    const { exportWorkspaceBackup, restoreWorkspaceBackup } = await import('../server/services/workspaceRestoreService');
    const before = await report(`/trial-balance?asOfDate=2026-06-30`);
    const backup = await exportWorkspaceBackup(db, ws, OWNER);
    // something goes wrong after the backup: an entry is deleted by mistake
    await db.collection('transactions').doc(paid.bill).delete();
    const broken = await report(`/trial-balance?asOfDate=2026-06-30&after=mistake`);
    assert.notDeepEqual(broken, before);
    // the backup taken before May was closed may not replace it
    await assert.rejects(restoreWorkspaceBackup(db, ws, earlyBackup as never), /made before any month was closed/);
    // the one taken after the close brings everything back
    await restoreWorkspaceBackup(db, ws, backup as never);
    const restored = await report(`/trial-balance?asOfDate=2026-06-30&after=restore`);
    assert.deepEqual(restored, before);
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.lockDate, MAY_END, 'May stays closed');
  });

  test('10. a report figure traces back to its entries, its invoice and its bank line', async () => {
    const gl = await report(`/general-ledger?startDate=2026-05-01&endDate=${MAY_END}&accountId=${acct['1100'].id}`);
    const receivables = (Array.isArray(gl) ? gl : gl.accounts || []).find((a: { accountId: string }) => a.accountId === acct['1100'].id);
    assert.equal(receivables.endingBalanceCents, 40000, 'the 400.00 on the balance sheet');
    const sum = receivables.entries.reduce((s: number, e: { debitCents: number; creditCents: number }) => s + e.debitCents - e.creditCents, 0);
    assert.equal(sum, receivables.endingBalanceCents, 'its entries add up to it');
    const sources = await Promise.all(receivables.entries.map(async (e: { transactionId: string }) => (await db.collection('transactions').doc(e.transactionId).get()).data()));
    const invoiceEntry = sources.find(t => t?.metadata?.invoiceId === invoiceId);
    assert.equal((await db.collection('invoices').doc(invoiceEntry!.metadata.invoiceId).get()).data()?.number, 'INV-1001', 'the entry opens its invoice');
    const paymentEntry = receivables.entries.find((e: { transactionId: string }) => e.transactionId === paid.invoice);
    assert.ok(paymentEntry, 'the payment is one of the entries');
    const line = (await db.collection('bankLines').doc(bankLine.deposit).get()).data();
    assert.equal(line?.matchedTransactionId, paid.invoice, 'and the payment opens its bank line');
  });
});
