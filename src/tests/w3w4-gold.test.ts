/**
 * W3W4-GOLD (RELEASE_GATE W3 and W4, "Verified"): two journeys of one small business, end to end against a real
 * database, every figure worked out by hand below. Records go through the routes and services the app uses: bills and
 * the invoice are posted by the app's own posting code, the payment run by the Payment run dialog's own planning and
 * request code (billsDueBy, paymentPlan, recordPayments), the bank file is read by the US bank CSV reader and saved
 * through the bulk route, and lines are matched, paid and split through the reconcile routes.
 * The test runs when LF_TEST_DATABASE_URL is set.
 *
 * Worked figures (cents). Cedar Hardware, USD, checking opened 2026-04-01 with 5,000.00 (already reconciled in April).
 *
 * W3 — bills → payment run → vendor statement and A/P ageing
 *   bill A-101  Acme Supplies  dated 2026-04-01  due 2026-05-01  120,000  (Supplies)
 *   bill A-102  Acme Supplies  dated 2026-04-20  due 2026-05-20   80,000  (Supplies)
 *   bill B-201  Beta Parts     dated 2026-05-10  due 2026-06-09   45,000  (Supplies)
 *   A/P ageing on 2026-05-20: A-101 is 19 days late (1–30), A-102 is due today (current), B-201 not yet due (current)
 *     Acme  current 80,000 + 1–30 120,000 = 200,000;  Beta  current 45,000;  total 245,000
 *   payment run "due by 2026-05-20", paid 2026-05-21: A-101 + A-102 = one payment to Acme of 200,000; B-201 waits
 *   Acme's statement 2026-04-01..2026-05-31: opening 0; +120,000 → 120,000; +80,000 → 200,000; −200,000 → 0
 *   Beta's statement: opening 0; +45,000 → 45,000
 *   A/P ageing on 2026-06-30: B-201 is 21 days late → Beta 1–30 45,000; total 45,000 (= the Accounts Payable balance)
 *
 * W4 — bank CSV → match → reconciliation
 *   invoice INV-501 to Dune LLC, 2026-05-12, 250,000; rent cheque #1042 written 2026-05-30, 30,000 (not yet cashed)
 *   the bank's May file (Chase checking layout), newest first:
 *     05/31  DEBIT   service fee           −3,500   balance 546,500
 *     05/25  CREDIT  deposit Dune LLC    +250,000   balance 550,000
 *     05/21  DEBIT   ACH Acme Supplies   −200,000   balance 300,000
 *   matched: the deposit pays INV-501; the ACH is the payment run; the fee is split to Bank fees
 *   reconciliation at 2026-05-31: beginning 500,000 + cleared (250,000 − 200,000 − 3,500 = 46,500) = 546,500
 *     = the statement's ending balance → difference 0
 *   books: 500,000 + 250,000 − 200,000 − 3,500 − 30,000 = 516,500; cheque #1042 outstanding 30,000;
 *     what the bank should show = 516,500 + 30,000 = 546,500 = the statement
 *   kept difference (books − statement on 2026-05-31) = 516,500 − 546,500 = −30,000 (the outstanding cheque);
 *     a 10.00 entry backdated into May moves it to −31,000, and the drift check reports it
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
import { billsDueBy } from '../lib/paymentRun';
import { paymentPlan } from '../lib/bulkDocuments';
import { recordPayments } from '../services/bulkDocumentActions';
import { computePartyAging } from '../lib/aging';
import { parseUsBankCsv } from '../lib/usBankCsv';
import { bankClearance } from '../lib/bankClearance';
import { reconciliationDrift } from '../lib/reconciliationDrift';
import type { BankStatementLine, Bill, ChartAccount, Transaction, Workspace } from '../types';
// the browser's posting host (stores + upload), as LedgerPostService registers it in the app (L-94)
import '../services/ledgerPost/postingKit';

const url = process.env.LF_TEST_DATABASE_URL;

const MAY_CSV = [
  'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #',
  'DEBIT,05/31/2026,MONTHLY SERVICE FEE,-35.00,FEE_TRANSACTION,5465.00,',
  'CREDIT,05/25/2026,DEPOSIT DUNE LLC INV-501,2500.00,ACH_CREDIT,5500.00,',
  'DEBIT,05/21/2026,ACH PMT ACME SUPPLIES,-2000.00,ACH_DEBIT,3000.00,',
].join('\n');

describe('W3 and W4 with worked figures', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_w34_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  const vendor: Record<'acme' | 'beta', string> = { acme: '', beta: '' };
  let customerId = '';
  const bill = { a101: `${ws}_a101`, a102: `${ws}_a102`, b201: `${ws}_b201` };
  const invoiceId = `${ws}_inv501`;
  const openingId = `${ws}_opening`;
  const chequeId = `${ws}_cheque1042`;
  let runTransactionId = '';
  const lineIds = { fee: `${ws}_bl_fee`, deposit: `${ws}_bl_dep`, ach: `${ws}_bl_ach` };

  const send = async (method: string, path: string, body?: unknown) => {
    const res = await realFetch(`${base}${path}`, {
      method, headers: { 'content-type': 'application/json', 'x-test-uid': OWNER }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const report = async (path: string) => (await send('GET', `/api/v1/reports${path}${path.includes('?') ? '&' : '?'}workspaceId=${ws}`)).body;
  const ledgerBalance = async (code: string, endDate: string) => {
    const gl = await report(`/general-ledger?startDate=2026-01-01&endDate=${endDate}&accountId=${acct[code].id}`);
    return (Array.isArray(gl) ? gl : gl.accounts || []).find((a: { accountId: string }) => a.accountId === acct[code].id)?.endingBalanceCents;
  };
  const all = async <T>(collection: string) => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as T);
  const context = (): LedgerPostContext => ({
    accounts: Object.values(acct), lockDate: null, transactions: [], inventory: [], uid: OWNER,
    workspaces: [{ id: ws, uid: OWNER, name: 'Cedar Hardware', currency: 'USD' } as Workspace],
  });
  const journal = (id: string, date: string, description: string, debit: string, credit: string, cents: number) => send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{
    id, uid: OWNER, workspaceId: ws, date, description, totalAmountCents: cents, currency: 'USD', status: 'completed', type: 'journal',
    lines: [{ accountId: acct[debit].id, amountCents: cents }, { accountId: acct[credit].id, amountCents: -cents }],
  }] });
  const postBill = async (id: string, number: string, who: 'acme' | 'beta', date: string, dueDate: string, cents: number) => {
    const data = {
      id, workspaceId: ws, uid: OWNER, number, billNumber: number, vendorId: vendor[who], vendorName: who === 'acme' ? 'Acme Supplies' : 'Beta Parts', date, dueDate,
      status: 'approved' as const, amountCents: cents, amountPaidCents: 0, currency: 'USD', splits: [{ accountId: acct['6000'].id, amountCents: cents, description: 'Stock for the shop' }],
    };
    await postBillLedger(id, data as never, ws, OWNER, { collection: 'bills', docId: id, action: 'create', data }, context());
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { paymentRouter } = await import('../server/routes/paymentRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Cedar Hardware', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@cedar.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    app.use('/api/v1/reports', reportRouter);
    app.use('/api/v1/payments', paymentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // the app's own code calls the API by path (no host): send those calls to this server, as the owner
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;

    const accounts = await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'accounts', rows: [
      { name: 'Checking', code: '1000', type: 'Bank' },
      { name: 'Accounts Receivable', code: '1100', type: 'Accounts receivable' },
      { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' },
      { name: 'Opening Balance Equity', code: '3000', type: 'Equity' },
      { name: 'Sales', code: '4000', type: 'Income' },
      { name: 'Supplies', code: '6000', type: 'Expense' },
      { name: 'Bank fees', code: '6100', type: 'Expense' },
      { name: 'Rent', code: '6200', type: 'Expense' },
    ] });
    assert.equal(accounts.status, 200, JSON.stringify(accounts.body));
    for (const a of await all<ChartAccount>('chartAccounts')) acct[String(a.code)] = a;
    assert.equal(Object.keys(acct).length, 8);
    assert.equal((await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'vendors', rows: [{ name: 'Acme Supplies' }, { name: 'Beta Parts' }] })).status, 200);
    assert.equal((await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'customers', rows: [{ name: 'Dune LLC', email: 'ap@dune.test' }] })).status, 200);
    for (const v of await all<{ id: string; name: string }>('vendors')) vendor[v.name === 'Acme Supplies' ? 'acme' : 'beta'] = v.id;
    customerId = (await all<{ id: string }>('customers'))[0].id;
    // the opening 5,000.00, on April's statement (reconciled then)
    const opening = await journal(openingId, '2026-04-01', 'Opening balance', '1000', '3000', 500_000);
    assert.equal(opening.status, 200, JSON.stringify(opening.body));
    const april = await send('POST', '/api/v1/transactions/reconcile', { workspaceId: ws, operations: [{ type: 'updateTransaction', id: openingId, data: { status: 'reconciled' } }] });
    assert.equal(april.status, 200, JSON.stringify(april.body));
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'payments', 'bankLines', 'customers', 'vendors', 'chartAccounts', 'reconciliations', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('W3: three bills are posted; the A/P ageing on 2026-05-20 is Acme 80,000 current + 120,000 late, Beta 45,000 current', async () => {
    await postBill(bill.a101, 'A-101', 'acme', '2026-04-01', '2026-05-01', 120_000);
    await postBill(bill.a102, 'A-102', 'acme', '2026-04-20', '2026-05-20', 80_000);
    await postBill(bill.b201, 'B-201', 'beta', '2026-05-10', '2026-06-09', 45_000);
    const bills = await all<Bill>('bills');
    const vendors = [{ id: vendor.acme, name: 'Acme Supplies' }, { id: vendor.beta, name: 'Beta Parts' }];
    const ageing = computePartyAging(vendors, bills, 'vendor', '2026-05-20');
    assert.deepEqual(ageing.map(r => [r.partyName, r.buckets.current, r.buckets.d1_30, r.total]), [['Acme Supplies', 80_000, 120_000, 200_000], ['Beta Parts', 45_000, 0, 45_000]]);
    assert.equal((await report('/aging?type=ap')).total, 245_000, 'the report route owes the same 2,450.00');
    assert.equal(await ledgerBalance('2000', '2026-05-20'), 245_000, 'and so does the Accounts Payable account');
  });

  test('W3: the payment run "due by 2026-05-20" pays A-101 and A-102 in one 2,000.00 payment to Acme; B-201 waits', async () => {
    const bills = await all<Bill & { vendorName?: string }>('bills');
    const due = billsDueBy(bills, '2026-05-20');
    assert.deepEqual(due.map(b => b.number), ['A-101', 'A-102'], 'oldest due first');
    const { payments, skipped } = paymentPlan(due, 'bill', 'USD');
    assert.deepEqual([payments.length, skipped.length], [1, 0]);
    assert.deepEqual([payments[0].partyName, payments[0].amountCents, payments[0].allocations.map(a => [a.label, a.amountCents])], ['Acme Supplies', 200_000, [['A-101', 120_000], ['A-102', 80_000]]]);
    const result = await recordPayments(payments, { workspaceId: ws, side: 'bill', cashAccountId: acct['1000'].id, date: '2026-05-21', method: 'ach' });
    assert.deepEqual([result.done.length, result.failed.map(f => f.message)], [1, []]);
    const after = Object.fromEntries((await all<Bill>('bills')).map(b => [b.number, [b.status, b.amountPaidCents || 0]]));
    assert.deepEqual(after, { 'A-101': ['paid', 120_000], 'A-102': ['paid', 80_000], 'B-201': ['approved', 0] });
    const entry = (await all<Transaction>('transactions')).find(t => t.metadata?.paymentId && t.date === '2026-05-21');
    assert.ok(entry, 'the payment is in the ledger');
    runTransactionId = entry!.id;
    // DR Accounts Payable 200,000 / CR Checking 200,000
    const by = (code: string) => (entry!.lines || []).filter(l => l.accountId === acct[code].id).reduce((s, l) => s + (l.amountCents || 0), 0);
    assert.deepEqual([by('2000'), by('1000')], [200_000, -200_000]);
  });

  test('W3: Acme\'s statement runs 120,000 → 200,000 → 0; Beta\'s ends at 45,000; the ageing on 2026-06-30 is Beta 45,000 in 1–30', async () => {
    const acme = await report(`/statement?type=vendor&contactId=${vendor.acme}&startDate=2026-04-01&endDate=2026-05-31`);
    assert.equal(acme.openingBalanceCents, 0);
    assert.deepEqual(acme.entries.map((e: { type: string; amountCents: number; runningBalanceCents: number }) => [e.type, e.amountCents, e.runningBalanceCents]), [
      ['Bill', 120_000, 120_000], ['Bill', 80_000, 200_000], ['Payment', -200_000, 0],
    ]);
    assert.equal(acme.endingBalanceCents, 0);
    const beta = await report(`/statement?type=vendor&contactId=${vendor.beta}&startDate=2026-04-01&endDate=2026-05-31`);
    assert.deepEqual([beta.openingBalanceCents, beta.entries.length, beta.endingBalanceCents], [0, 1, 45_000]);
    const ageing = computePartyAging([{ id: vendor.acme, name: 'Acme Supplies' }, { id: vendor.beta, name: 'Beta Parts' }], await all<Bill>('bills'), 'vendor', '2026-06-30');
    assert.deepEqual(ageing.map(r => [r.partyName, r.buckets.current, r.buckets.d1_30, r.total]), [['Beta Parts', 0, 45_000, 45_000]], 'B-201 is 21 days late');
    assert.equal((await report('/aging?type=ap')).total, 45_000);
    assert.equal(await ledgerBalance('2000', '2026-05-31'), 45_000, 'the ageing equals the Accounts Payable balance');
  });

  test('W4: the invoice and the rent cheque are posted; the bank\'s CSV is read and saved as three waiting lines', async () => {
    const invoice = {
      id: invoiceId, workspaceId: ws, uid: OWNER, number: 'INV-501', customerId, customerName: 'Dune LLC', date: '2026-05-12', dueDate: '2026-06-11',
      status: 'sent' as const, amountCents: 250_000, amountPaidCents: 0, currency: 'USD',
      items: [{ id: 'l1', description: 'Shelving', quantity: 5, rateCents: 50_000, amountCents: 250_000, accountId: acct['4000'].id }],
    };
    await postInvoiceLedger(invoiceId, invoice, ws, OWNER, { collection: 'invoices', docId: invoiceId, action: 'create', data: invoice }, context());
    const cheque = await journal(chequeId, '2026-05-30', 'Rent, cheque #1042', '6200', '1000', 30_000);
    assert.equal(cheque.status, 200, JSON.stringify(cheque.body));

    const parsed = parseUsBankCsv(MAY_CSV, 'chase-checking');
    assert.deepEqual(parsed.map(l => [l.date, l.amountCents]), [['2026-05-31', -3_500], ['2026-05-25', 250_000], ['2026-05-21', -200_000]]);
    const ids = [lineIds.fee, lineIds.deposit, lineIds.ach];
    const saved = await send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [], bankLines: parsed.map((l, i) => ({
      id: ids[i], date: l.date, description: l.description, amountCents: l.amountCents, status: 'pending', accountId: acct['1000'].id,
    })) });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const lines = await all<BankStatementLine>('bankLines');
    assert.deepEqual(lines.map(l => l.status), ['pending', 'pending', 'pending']);
    assert.equal(lines.reduce((s, l) => s + (l.amountCents || 0), 0), 46_500, 'the month moves the bank by +465.00: 5,000.00 → 5,465.00');
  });

  test('W4: the deposit pays INV-501, the ACH is the payment run, the fee goes to Bank fees', async () => {
    const pay = await send('POST', `/api/v1/transactions/bank-lines/${lineIds.deposit}/pay`, { workspaceId: ws, allocations: [{ documentId: invoiceId, amountCents: 250_000 }] });
    assert.equal(pay.status, 200, JSON.stringify(pay.body));
    const match = await send('POST', '/api/v1/transactions/reconcile', { workspaceId: ws, operations: [
      { type: 'updateBankLine', id: lineIds.ach, data: { status: 'matched', matchedTransactionId: runTransactionId } },
      { type: 'updateTransaction', id: runTransactionId, data: { status: 'reconciled' } },
    ] });
    assert.equal(match.status, 200, JSON.stringify(match.body));
    const fee = await send('POST', `/api/v1/transactions/bank-lines/${lineIds.fee}/split`, { workspaceId: ws, splits: [{ accountId: acct['6100'].id, amountCents: 3_500, description: 'May service fee' }] });
    assert.equal(fee.status, 200, JSON.stringify(fee.body));
    assert.deepEqual((await all<BankStatementLine>('bankLines')).map(l => l.status), ['matched', 'matched', 'matched']);
    const inv = (await db.collection('invoices').doc(invoiceId).get()).data();
    assert.deepEqual([inv?.status, inv?.amountPaidCents], ['paid', 250_000]);
    assert.equal(await ledgerBalance('6100', '2026-05-31'), 3_500);
    assert.equal(await ledgerBalance('1100', '2026-05-31'), 0, 'nothing is owed by Dune LLC');
  });

  test('W4: May reconciles to the statement\'s 5,465.00 with cheque #1042 (300.00) outstanding; a backdated entry is caught', async () => {
    const transactions = await all<Transaction>('transactions');
    const bankLines = await all<BankStatementLine>('bankLines');
    const checking = acct['1000'].id;
    // the reconciliation screen's figures: beginning balance + what cleared in May = the statement's ending balance
    const statementEnding = 546_500;
    const clearance = bankClearance(checking, transactions, bankLines, '2026-05-01', '2026-05-31');
    // May's entries (the opening is April's, already reconciled), each cleared by its matched bank line
    const clearedInMay = clearance.rows.filter(r => r.clearedOn !== null).reduce((s, r) => s + r.amountCents, 0);
    assert.equal(clearedInMay, 46_500, '250,000 − 200,000 − 3,500');
    assert.equal(500_000 + clearedInMay - statementEnding, 0, 'difference 0');
    assert.deepEqual([clearance.bookBalanceCents, clearance.outstandingInCents, clearance.outstandingOutCents, clearance.bankBalanceCents], [516_500, 0, 30_000, statementEnding]);
    assert.deepEqual(clearance.rows.filter(r => r.clearedOn === null).map(r => [r.id, r.amountCents]), [[chequeId, -30_000]], 'only the cheque is outstanding');
    assert.equal(await ledgerBalance('1000', '2026-05-31'), 516_500, 'the general ledger shows the same book balance');

    // the reconciliation is saved as the Ledger screen saves it, and the kept difference is the outstanding cheque
    await db.collection('reconciliations').doc(`${ws}_may`).set({ workspaceId: ws, accountId: checking, accountName: 'Checking', statementDate: '2026-05-31', statementBalanceCents: statementEnding, status: 'completed' });
    const records = await all<{ id: string; accountId: string; statementDate: string; statementBalanceCents: number }>('reconciliations');
    const accounts = Object.values(acct);
    const first = reconciliationDrift(accounts, transactions, records);
    assert.deepEqual(first.baselines, { [`${ws}_may`]: -30_000 });
    assert.deepEqual(reconciliationDrift(accounts, transactions, records, first.baselines).drifted, [], 'nothing moved');
    // a 10.00 entry backdated into the reconciled month moves the books on 2026-05-31 to 515,500
    assert.equal((await journal(`${ws}_late`, '2026-05-15', 'Backdated supplies', '6000', '1000', 1_000)).status, 200);
    const later = reconciliationDrift(accounts, await all<Transaction>('transactions'), records, first.baselines);
    assert.deepEqual(later.drifted.map(d => [d.statementDate, d.thenCents, d.nowCents]), [['2026-05-31', -30_000, -31_000]]);
  });
});
