/**
 * YEAR-END-GOLD (RELEASE_GATE W9): a full year on a real database, every figure worked by hand — invoices, bills,
 * payments, a depreciation run, closing the year; then retained earnings, the next year's opening balances and the
 * trial balance; then reopening December and closing again gives the same numbers. Through the app's own code: the
 * opening-balance setup route, invoice and bill posting, the payments route, the depreciation run, close-year, the
 * month reopen and the report routes. The test runs when LF_TEST_DATABASE_URL is set.
 *
 * Worked figures (cents), calendar 2025:
 *   01-01  opening: Checking 1,000,000 / Opening Balance Equity 1,000,000
 *   01-15  equipment bought for cash: Equipment 120,000 / Checking 120,000
 *          (5 years, no salvage: 120,000 / 60 = 2,000 a month from February)
 *   03-10  INV-1 300,000 Sales       04-20  INV-1 paid in full: Checking +300,000
 *   04-05  B-1   80,000 Supplies     05-01  B-1 paid in full:   Checking −80,000
 *   11-20  INV-2 200,000 Sales (open at year end)    12-10  B-2 50,000 Supplies (open at year end)
 *   12     depreciation run: February–December = 11 × 2,000 = 22,000 (Depreciation / Accumulated Depreciation)
 *   2025 profit: 300,000 + 200,000 − 80,000 − 50,000 − 22,000 = 348,000 → close-year says 348,000
 *
 *   The next year opens on 2026-01-01 with:
 *     Checking 1,000,000 − 120,000 + 300,000 − 80,000 = 1,100,000; A/R 200,000; Equipment 120,000;
 *     Accumulated Depreciation −22,000 → assets 1,398,000
 *     A/P 50,000; Opening Balance Equity 1,000,000; retained earnings (profit to date) 348,000 → 1,398,000
 *     and 2026's own P&L starts at 0.
 *   Trial balance on 2025-12-31 (debits and credits as posted, per account):
 *     Checking 1,300,000 / 200,000 · A/R 500,000 / 300,000 · Equipment 120,000 / 0 · Accumulated Depreciation 0 / 22,000
 *     A/P 80,000 / 130,000 · Opening Balance Equity 0 / 1,000,000 · Sales 0 / 500,000 · Supplies 130,000 / 0
 *     Depreciation 22,000 / 0 → 2,152,000 = 2,152,000
 *   After the close a posting dated in 2025 is refused; December reopened → lock back to 2025-11-30; closed again
 *   → 348,000 again, lock 2025-12-31, the same balance sheet and trial balance.
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
import type { ChartAccount, Transaction, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('YEAR-END with worked figures', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_ye_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  let customerId = '';
  let vendorId = '';
  let bust = 0;
  const send = async (method: string, path: string, body?: unknown) => {
    const res = await realFetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': OWNER }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  // the report routes cache by address: each read asks afresh
  const report = async (path: string) => (await send('GET', `/api/v1/reports${path}&workspaceId=${ws}&_read=${++bust}`)).body;
  const all = async <T>(collection: string) => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as T);
  const workspace = async () => (await db.collection('workspaces').doc(ws).get()).data() || {};
  const context = async (): Promise<LedgerPostContext> => ({
    accounts: Object.values(acct), lockDate: null, uid: OWNER, inventory: [], transactions: await all<Transaction>('transactions'),
    workspaces: [{ id: ws, uid: OWNER, name: 'Harbor Tools', currency: 'USD' } as Workspace],
  });
  const invoice = async (n: string, date: string, cents: number) => {
    const id = `${ws}_${n}`;
    const data = {
      id, workspaceId: ws, uid: OWNER, number: n, customerId, customerName: 'Delta Builders', date, dueDate: date, status: 'sent' as const,
      amountCents: cents, amountPaidCents: 0, currency: 'USD', taxVersion: 2, taxAmountCents: 0,
      items: [{ id: 'l1', description: 'Tools', quantity: 1, rateCents: cents, amountCents: cents, accountId: acct['4000'].id }],
    };
    await postInvoiceLedger(id, data as never, ws, OWNER, { collection: 'invoices', docId: id, action: 'create', data }, await context());
    return id;
  };
  const bill = async (n: string, date: string, cents: number) => {
    const id = `${ws}_${n}`;
    const data = {
      id, workspaceId: ws, uid: OWNER, number: n, billNumber: n, vendorId, vendorName: 'Iron Supply', date, dueDate: date, status: 'approved' as const,
      amountCents: cents, amountPaidCents: 0, currency: 'USD', splits: [{ accountId: acct['6000'].id, amountCents: cents, description: 'Supplies' }],
    };
    await postBillLedger(id, data as never, ws, OWNER, { collection: 'bills', docId: id, action: 'create', data }, await context());
    return id;
  };
  const pay = (side: 'invoice' | 'bill', documentId: string, date: string, cents: number) => send('POST', '/api/v1/payments', {
    workspaceId: ws, amountCents: cents, paymentDate: date, cashAccountId: acct['1000'].id, paymentMethod: 'bank_transfer',
    ...(side === 'invoice' ? { customerId } : { vendorId }), allocations: [{ documentId, documentType: side, amountCents: cents }],
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
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Harbor Tools', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@harbor.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/reports', reportRouter);
    app.use('/api/v1/payments', paymentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
    const accounts = await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'accounts', rows: [
      { name: 'Checking', code: '1000', type: 'Bank' },
      { name: 'Accounts Receivable', code: '1100', type: 'Accounts receivable' },
      { name: 'Equipment', code: '1500', type: 'Fixed asset' },
      { name: 'Accumulated Depreciation', code: '1510', type: 'Fixed asset' },
      { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' },
      { name: 'Opening Balance Equity', code: '3000', type: 'Equity' },
      { name: 'Retained Earnings', code: '3100', type: 'Equity' },
      { name: 'Sales', code: '4000', type: 'Income' },
      { name: 'Supplies', code: '6000', type: 'Expense' },
      { name: 'Depreciation', code: '6500', type: 'Expense' },
    ] });
    assert.equal(accounts.status, 200, JSON.stringify(accounts.body));
    for (const a of await all<ChartAccount>('chartAccounts')) acct[String(a.code)] = a;
    assert.equal(Object.keys(acct).length, 10);
    assert.equal((await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'customers', rows: [{ name: 'Delta Builders' }] })).status, 200);
    assert.equal((await send('POST', `/api/v1/workspaces/${ws}/import-records`, { kind: 'vendors', rows: [{ name: 'Iron Supply' }] })).status, 200);
    customerId = (await all<{ id: string }>('customers'))[0].id;
    vendorId = (await all<{ id: string }>('vendors'))[0].id;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'payments', 'assets', 'periods', 'customers', 'vendors', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'documentSeries', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('the year: opening, equipment, two invoices, two bills, two payments, the December depreciation run of 22,000', async () => {
    const opening = await send('POST', `/api/v1/workspaces/${ws}/opening-balances`, { date: '2025-01-01', balances: [{ accountId: acct['1000'].id, amountCents: 1_000_000 }] });
    assert.equal(opening.status, 200, JSON.stringify(opening.body));
    const equipment = await send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{
      id: `${ws}_equipment`, uid: OWNER, workspaceId: ws, date: '2025-01-15', description: 'Table saw and drills', totalAmountCents: 120_000, currency: 'USD', status: 'completed', type: 'journal',
      lines: [{ accountId: acct['1500'].id, amountCents: 120_000 }, { accountId: acct['1000'].id, amountCents: -120_000 }],
    }] });
    assert.equal(equipment.status, 200, JSON.stringify(equipment.body));
    await db.collection('assets').doc(`${ws}_saw`).set({
      workspaceId: ws, name: 'Table saw and drills', purchaseDate: '2025-01-15', purchasePriceCents: 120_000, salvageValueCents: 0, usefulLifeYears: 5,
      depreciationMethod: 'straight-line', accumulatedDepreciationCents: 0, status: 'active', expenseAccountId: acct['6500'].id, accumulatedAccountId: acct['1510'].id, assetAccountId: acct['1500'].id,
    });

    const inv1 = await invoice('INV-1', '2025-03-10', 300_000);
    const b1 = await bill('B-1', '2025-04-05', 80_000);
    assert.equal((await pay('invoice', inv1, '2025-04-20', 300_000)).status, 200);
    assert.equal((await pay('bill', b1, '2025-05-01', 80_000)).status, 200);
    await invoice('INV-2', '2025-11-20', 200_000);
    await bill('B-2', '2025-12-10', 50_000);

    const run = await send('POST', `/api/v1/workspaces/${ws}/periods/2025-12/depreciation`, {});
    assert.equal(run.status, 200, JSON.stringify(run.body));
    assert.equal(run.body.totalCents, 22_000, 'February–December: 11 × 120,000 / 60');
    const pl = await report('/profit-and-loss?startDate=2025-01-01&endDate=2025-12-31');
    assert.deepEqual([pl.income.total, pl.expense.total, pl.netIncome], [500_000, 152_000, 348_000]);
  });

  test('closing 2025: profit 348,000, the year locked, a 2025 posting refused', async () => {
    const close = await send('POST', '/api/v1/transactions/close-year', { workspaceId: ws, closingDate: '2025-12-31', lockPeriod: true });
    assert.equal(close.status, 200, JSON.stringify(close.body));
    assert.deepEqual([close.body.netIncomeCents, close.body.yearStart, (await workspace()).lockDate], [348_000, '2025-01-01', '2025-12-31']);
    const late = await send('POST', '/api/v1/transactions/bulk', { workspaceId: ws, transactions: [{
      id: `${ws}_late`, uid: OWNER, workspaceId: ws, date: '2025-12-20', description: 'Late fee', totalAmountCents: 1_000, currency: 'USD', status: 'completed', type: 'journal',
      lines: [{ accountId: acct['6000'].id, amountCents: 1_000 }, { accountId: acct['1000'].id, amountCents: -1_000 }],
    }] });
    assert.ok(late.status >= 400, `a posting into the closed year is refused (${late.status})`);
  });

  const nextYearOpens = async () => {
    const bs = await report('/balance-sheet?endDate=2026-01-01');
    assert.deepEqual([bs.assets[acct['1000'].id], bs.assets[acct['1100'].id], bs.assets[acct['1500'].id], bs.assets[acct['1510'].id], bs.totalAssets], [1_100_000, 200_000, 120_000, -22_000, 1_398_000]);
    assert.deepEqual([bs.liabilities[acct['2000'].id], bs.equity[acct['3000'].id], bs.netIncome, bs.totalClaims, bs.isBalanced], [50_000, 1_000_000, 348_000, 1_398_000, true], 'retained earnings: the 348,000 profit to date');
    const pl2026 = await report('/profit-and-loss?startDate=2026-01-01&endDate=2026-01-01');
    assert.deepEqual([pl2026.income.total, pl2026.netIncome], [0, 0], 'the new year starts at nothing');
    const tb = await report('/trial-balance?asOfDate=2025-12-31');
    const row = (code: string) => { const r = tb.accounts.find((a: { id: string }) => a.id === acct[code].id); return [r.debit, r.credit]; };
    assert.deepEqual(['1000', '1100', '1500', '1510', '2000', '3000', '4000', '6000', '6500'].map(row), [
      [1_300_000, 200_000], [500_000, 300_000], [120_000, 0], [0, 22_000], [80_000, 130_000], [0, 1_000_000], [0, 500_000], [130_000, 0], [22_000, 0],
    ]);
    assert.deepEqual([tb.totalDebit, tb.totalCredit, tb.isBalanced], [2_152_000, 2_152_000, true]);
  };

  test('the next year opens with assets 1,398,000 = A/P 50,000 + equity 1,000,000 + retained 348,000; the trial balance agrees', nextYearOpens);

  test('December reopened, the year closed again: 348,000 again and the same figures', async () => {
    const reopen = await send('POST', `/api/v1/workspaces/${ws}/periods/2025-12/reopen`, { reason: 'Recheck the year-end figures' });
    assert.equal(reopen.status, 200, JSON.stringify(reopen.body));
    assert.equal((await workspace()).lockDate, '2025-11-30');
    const again = await send('POST', '/api/v1/transactions/close-year', { workspaceId: ws, closingDate: '2025-12-31', lockPeriod: true });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.deepEqual([again.body.netIncomeCents, (await workspace()).lockDate], [348_000, '2025-12-31']);
    await nextYearOpens();
    const closes = (await all<{ action?: string; details?: { netIncomeCents?: number } }>('auditLogs')).filter(l => l.action === 'FISCAL_YEAR_CLOSE');
    assert.deepEqual(closes.map(l => l.details?.netIncomeCents), [348_000, 348_000]);
  });
});
