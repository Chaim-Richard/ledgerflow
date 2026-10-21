/**
 * W1-GOLD (RELEASE_GATE W1, "Verified"): the first hour of a new company, end to end on a real database, every figure
 * worked by hand. The chart comes from the template, the bank's opening balance from the setup route, the customer's
 * and the vendor's opening balances from the opening-balance documents the app posts (src/lib/partyOpeningBalance.ts
 * through postInvoiceLedger / postBillLedger), the first invoice from the app's own invoice posting, and the three
 * reports from their routes. The test runs when LF_TEST_DATABASE_URL is set.
 *
 * Worked figures (cents), books starting 2026-01-01, template "Creative Project":
 *   bank opening 5,000.00         Main Checking DR 500,000 / Opening Balance Equity CR 500,000
 *   Acme Corp owes 1,200.00       A/R DR 120,000 / Opening Balance Equity CR 120,000   (invoice OB-…)
 *   Paper Co is owed 800.00       Opening Balance Equity DR 80,000 / A/P CR 80,000     (bill OB-…)
 *   first invoice INV-0001        2 × 150.00 = 300.00 on 2026-01-15: A/R DR 30,000 / Project Revenue CR 30,000
 *
 *   P&L, January:       income 30,000; expenses 0; net income 30,000 (the opening documents are not income)
 *   Balance sheet 31 Jan: Checking 500,000 + A/R 150,000 = assets 650,000
 *                         A/P 80,000 + Opening Balance Equity 500,000 + 120,000 − 80,000 = 540,000 + profit 30,000
 *                         = 650,000 → balanced
 *   Trial balance 31 Jan: Checking DR 500,000; A/R DR 150,000; A/P CR 80,000; Opening Balance Equity DR 80,000,
 *                         CR 620,000 (net 540,000); Project Revenue CR 30,000 → debits 730,000 = credits 730,000
 */
import './helpers/dom';
// registers the browser's posting host (L-94): the app's posting code sends its entries through it
import '../services/ledgerPost/postingKit';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import { openingBalanceDocument } from '../lib/partyOpeningBalance';
import type { ChartAccount, Transaction, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('W1 the first hour, with worked figures', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_w1_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  let acme = '';
  let paper = '';
  const send = async (method: string, path: string, body?: unknown) => {
    const res = await realFetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': OWNER }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const all = async <T>(collection: string) => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as T);
  const context = async (): Promise<LedgerPostContext> => ({
    accounts: Object.values(acct), lockDate: null, uid: OWNER, inventory: [], transactions: await all<Transaction>('transactions'),
    workspaces: [{ id: ws, uid: OWNER, name: 'Northwind Studio', currency: 'USD' } as Workspace],
  });
  const equity = () => ({ id: acct['3200'].id, name: acct['3200'].name });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    // the new company, as the app's "new workspace" writes it
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Northwind Studio', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@northwind.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/reports', reportRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // the app's own posting code calls the API by path: send those calls to this server, as the owner
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'customers', 'vendors', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('the chart template gives the accounts the first hour needs', async () => {
    const res = await send('POST', `/api/v1/workspaces/${ws}/apply-template`, { templateId: 'creative' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    for (const a of await all<ChartAccount>('chartAccounts')) acct[String(a.code)] = a;
    assert.deepEqual(['1010', '1200', '2000', '3200', '4000'].map(c => [acct[c]?.name, acct[c]?.type]), [
      ['Main Checking', 'asset'], ['Accounts Receivable', 'asset'], ['Accounts Payable', 'liability'], ['Opening Balance Equity', 'equity'], ['Project Revenue', 'income'],
    ]);
  });

  test('the bank opens at 5,000.00 against Opening Balance Equity', async () => {
    const res = await send('POST', `/api/v1/workspaces/${ws}/opening-balances`, { date: '2026-01-01', balances: [{ accountId: acct['1010'].id, amountCents: 500_000 }] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const entry = (await all<Transaction>('transactions')).find(t => t.id === res.body.transactionId);
    assert.deepEqual(entry?.lines?.map(l => [l.accountId, l.amountCents]).sort(), [[acct['1010'].id, 500_000], [acct['3200'].id, -500_000]].sort());
  });

  test('Acme Corp owes 1,200.00 and Paper Co is owed 800.00 at the start: opening documents against Opening Balance Equity', async () => {
    assert.equal((await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'customers', rows: [{ name: 'Acme Corp' }] })).status, 200);
    assert.equal((await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'vendors', rows: [{ name: 'Paper Co' }] })).status, 200);
    acme = (await all<{ id: string }>('customers'))[0].id;
    paper = (await all<{ id: string }>('vendors'))[0].id;

    const invoiceId = `${ws}_ob_acme`;
    const invoice = { ...openingBalanceDocument('customer', { id: acme, name: 'Acme Corp' }, equity(), 120_000, '2026-01-01', 'USD'), id: invoiceId, workspaceId: ws, uid: OWNER };
    await postInvoiceLedger(invoiceId, invoice, ws, OWNER, { collection: 'invoices', docId: invoiceId, action: 'create', data: invoice }, await context());
    const billId = `${ws}_ob_paper`;
    const bill = { ...openingBalanceDocument('vendor', { id: paper, name: 'Paper Co' }, equity(), 80_000, '2026-01-01', 'USD'), id: billId, workspaceId: ws, uid: OWNER };
    await postBillLedger(billId, bill, ws, OWNER, { collection: 'bills', docId: billId, action: 'create', data: bill }, await context());

    const entries = await all<Transaction>('transactions');
    const linesOf = (documentKey: 'invoiceId' | 'billId', id: string) => entries.filter(t => t.metadata?.[documentKey] === id).flatMap(t => t.lines || []).map(l => [l.accountId, l.amountCents]).sort();
    assert.deepEqual(linesOf('invoiceId', invoiceId), [[acct['1200'].id, 120_000], [acct['3200'].id, -120_000]].sort());
    assert.deepEqual(linesOf('billId', billId), [[acct['2000'].id, -80_000], [acct['3200'].id, 80_000]].sort());
  });

  test('the first invoice, 2 × 150.00 = 300.00 to Acme Corp', async () => {
    const id = `${ws}_inv1`;
    const invoice = {
      id, workspaceId: ws, uid: OWNER, number: 'INV-0001', customerId: acme, customerName: 'Acme Corp', date: '2026-01-15', dueDate: '2026-02-14', status: 'sent' as const,
      amountCents: 30_000, amountPaidCents: 0, currency: 'USD', taxVersion: 2, taxAmountCents: 0,
      items: [{ id: 'l1', description: 'Logo design', quantity: 2, rateCents: 15_000, amountCents: 30_000, accountId: acct['4000'].id }],
    };
    await postInvoiceLedger(id, invoice as never, ws, OWNER, { collection: 'invoices', docId: id, action: 'create', data: invoice }, await context());
    const lines = (await all<Transaction>('transactions')).filter(t => t.metadata?.invoiceId === id).flatMap(t => t.lines || []).map(l => [l.accountId, l.amountCents]).sort();
    assert.deepEqual(lines, [[acct['1200'].id, 30_000], [acct['4000'].id, -30_000]].sort());
  });

  test('January\'s P&L: income 30,000, net income 30,000 — the opening documents are not income', async () => {
    const pl = (await send('GET', `/api/v1/reports/profit-and-loss?workspaceId=${ws}&startDate=2026-01-01&endDate=2026-01-31`)).body;
    assert.deepEqual([pl.income.total, pl.expense.total, pl.netIncome], [30_000, 0, 30_000]);
  });

  test('the balance sheet on 31 Jan: assets 650,000 = A/P 80,000 + Opening Balance Equity 540,000 + profit 30,000', async () => {
    const bs = (await send('GET', `/api/v1/reports/balance-sheet?workspaceId=${ws}&endDate=2026-01-31`)).body;
    assert.deepEqual([bs.assets[acct['1010'].id], bs.assets[acct['1200'].id], bs.totalAssets], [500_000, 150_000, 650_000]);
    assert.deepEqual([bs.liabilities[acct['2000'].id], bs.totalLiabilities], [80_000, 80_000]);
    assert.deepEqual([bs.equity[acct['3200'].id], bs.totalEquity, bs.netIncome], [540_000, 540_000, 30_000], '500,000 + 120,000 − 80,000');
    assert.deepEqual([bs.totalClaims, bs.isBalanced], [650_000, true]);
  });

  test('the trial balance on 31 Jan: debits 730,000 = credits 730,000, each account as worked out', async () => {
    const tb = (await send('GET', `/api/v1/reports/trial-balance?workspaceId=${ws}&asOfDate=2026-01-31`)).body;
    const row = (code: string) => {
      const r = tb.accounts.find((a: { id: string }) => a.id === acct[code].id);
      return [r.debit, r.credit, r.netSigned];
    };
    assert.deepEqual(row('1010'), [500_000, 0, 500_000]);
    assert.deepEqual(row('1200'), [150_000, 0, 150_000], 'opening 120,000 + INV-0001 30,000');
    assert.deepEqual(row('2000'), [0, 80_000, 80_000]);
    assert.deepEqual(row('3200'), [80_000, 620_000, 540_000], 'credits 500,000 + 120,000, debit 80,000');
    assert.deepEqual(row('4000'), [0, 30_000, 30_000]);
    assert.deepEqual([tb.totalDebit, tb.totalCredit, tb.isBalanced], [730_000, 730_000, true]);
  });
});
