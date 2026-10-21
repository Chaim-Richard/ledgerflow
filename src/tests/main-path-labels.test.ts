/**
 * The main path with labels (DA-08, docs/ROADMAP.md), against a real database. A business that
 * tracks where its money goes by Location (Tel Aviv, Haifa) and by Project:
 * - an invoice with a line per location, and a bill split between them, posted by the app's own
 *   posting code (BF-09 labels on document lines);
 * - Location required on Office expenses (Z-12): a bill without one is listed by the check, and is
 *   gone once the bill is edited to carry it, with the books' totals unchanged;
 * - every report figure split by location adds back to the server's own P&L total, with nothing
 *   lost under "Unassigned".
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
import { reversalDate, type LedgerPostContext } from '../services/ledgerPost/postingKit';
import { getLineDimension } from '../lib/dimensionUtils';
import { isPostable, lineAmount } from '../lib/txFilters';
import { runDataChecks } from '../lib/dataChecks';
import { isIncomeAccount } from '../lib/accountUtils';
import type { Bill, ChartAccount, DimensionDefinition, Invoice, Transaction, Workspace } from '../types';
// the browser's posting host (stores + upload), as LedgerPostService registers it in the app (L-94)
import '../services/ledgerPost/postingKit';

const url = process.env.LF_TEST_DATABASE_URL;

describe('When a document is edited, voided or deleted', () => {
  test('its earlier entry is reversed on its own day while that day is open, and today once it is closed', () => {
    assert.equal(reversalDate('2026-05-10', '2026-10-07', { lockDate: null }), '2026-05-10');
    assert.equal(reversalDate('2026-05-10T00:00:00Z', '2026-10-07', { lockDate: '2026-04-30' }), '2026-05-10');
    assert.equal(reversalDate('2026-05-10', '2026-10-07', { lockDate: '2026-05-31' }), '2026-10-07', 'closed books are corrected in the current period');
    assert.equal(reversalDate(undefined, '2026-10-07', { lockDate: null }), '2026-10-07');
  });
});

describe('The main path with labels', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_labels_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  const dimensions: DimensionDefinition[] = [
    { id: 'category', name: 'Category', systemDefault: true },
    { id: 'location', name: 'Location', requiredOn: { accountIds: [], since: '2026-05-01' } },
    { id: 'project', name: 'Project' },
  ];
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  const unlabelledBill = `${ws}_bill2`;

  const report = async (path: string) => (await (await realFetch(`${base}/api/v1/reports${path}&workspaceId=${ws}`, { headers: { 'x-test-uid': OWNER } })).json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const workspace = (): Workspace => ({ id: ws, uid: OWNER, name: 'סניפים / Branches', currency: 'USD', dimensions } as Workspace);
  const entries = async () => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as Transaction);
  const context = async (): Promise<LedgerPostContext> => ({ accounts: Object.values(acct), lockDate: null, transactions: await entries(), inventory: [], uid: OWNER, workspaces: [workspace()] });
  /** income and expenses of May per location, from the posted entries (labels on lines or on the entry) */
  const byLocation = async () => {
    const sums: Record<string, { income: number; expense: number }> = {};
    for (const tx of await entries()) {
      if (!isPostable(tx) || tx.date < '2026-05-01' || tx.date > '2026-05-31') continue;
      for (const line of tx.lines || []) {
        const account = Object.values(acct).find(a => a.id === line.accountId);
        if (!account || !(isIncomeAccount(account) || account.type === 'expense')) continue;
        const where = getLineDimension(line, tx, 'location');
        const s = (sums[where] ||= { income: 0, expense: 0 });
        if (isIncomeAccount(account)) s.income += -lineAmount(line, tx); else s.expense += lineAmount(line, tx);
      }
    }
    return sums;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'סניפים / Branches', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/reports', reportRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // the app's own posting code calls the API by path (no host): send those calls to this server
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
    const imported = await realFetch(`${base}/api/v1/workspaces/${ws}/import-records`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': OWNER },
      body: JSON.stringify({ kind: 'accounts', rows: [
        { name: 'Checking', code: '1000', type: 'Bank' },
        { name: 'Accounts Receivable', code: '1100', type: 'Accounts receivable' },
        { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' },
        { name: 'ייעוץ / Consulting', code: '4000', type: 'Income' },
        { name: 'Office expenses', code: '6000', type: 'Expense' },
      ] }),
    });
    assert.equal(imported.status, 200);
    for (const d of (await db.collection('chartAccounts').where('workspaceId', '==', ws).get()).docs) acct[d.data().code] = { ...d.data(), id: d.id } as ChartAccount;
    // the rule: Location is required on Office expenses from May on (Settings → Dimensions → Required labels)
    dimensions[1].requiredOn = { accountIds: [acct['6000'].id], since: '2026-05-01' };
    await db.collection('workspaces').doc(ws).update({ dimensions });
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('an invoice with a line per location, and bills split between them, are posted with their labels', async () => {
    const invoice: Partial<Invoice> = {
      id: `${ws}_inv1`, workspaceId: ws, uid: OWNER, number: 'INV-1', customerName: 'לקוח', date: '2026-05-05', dueDate: '2026-06-04', status: 'sent' as const,
      amountCents: 100000, amountPaidCents: 0, currency: 'USD',
      items: [
        { id: 'l1', description: 'Workshop', quantity: 1, rateCents: 60000, amountCents: 60000, accountId: acct['4000'].id, dimensions: { location: 'TLV', project: 'Hotel' } },
        { id: 'l2', description: 'סדנה / Workshop', quantity: 1, rateCents: 40000, amountCents: 40000, accountId: acct['4000'].id, dimensions: { location: 'HFA' } },
      ],
    };
    await postInvoiceLedger(invoice.id!, invoice, ws, OWNER, { collection: 'invoices', docId: invoice.id!, action: 'create', data: invoice }, await context());
    const bill = {
      id: `${ws}_bill1`, workspaceId: ws, uid: OWNER, number: 'B-1', vendorId: `${ws}_vendor`, vendorName: 'Supplies Ltd', date: '2026-05-10', dueDate: '2026-06-09', status: 'approved' as const,
      amountCents: 25000, currency: 'USD',
      splits: [
        { accountId: acct['6000'].id, amountCents: 15000, description: 'Paper TLV', dimensions: { location: 'TLV' } },
        { accountId: acct['6000'].id, amountCents: 10000, description: 'Paper HFA', dimensions: { location: 'HFA' } },
      ],
    };
    await postBillLedger(bill.id, bill as Partial<Bill>, ws, OWNER, { collection: 'bills', docId: bill.id, action: 'create', data: bill }, await context());
    const plain = { ...bill, id: unlabelledBill, number: 'B-2', amountCents: 5000, splits: [{ accountId: acct['6000'].id, amountCents: 5000, description: 'Coffee' }] };
    await postBillLedger(plain.id, plain as Partial<Bill>, ws, OWNER, { collection: 'bills', docId: plain.id, action: 'create', data: plain }, await context());
    const revenue = (await entries()).flatMap(t => t.lines).filter(l => l.accountId === acct['4000'].id);
    assert.deepEqual(revenue.map(l => [l.amountCents, l.dimensions]).sort(), [[-60000, { location: 'TLV', project: 'Hotel' }], [-40000, { location: 'HFA' }]].sort());
  });

  test('every figure split by location adds back to the P&L total; only the unlabelled bill is "Unassigned"', async () => {
    const pl = await report('/profit-and-loss?startDate=2026-05-01&endDate=2026-05-31');
    assert.deepEqual([pl.income.total, pl.expense.total], [100000, 30000]);
    const split = await byLocation();
    assert.deepEqual(split, { TLV: { income: 60000, expense: 15000 }, HFA: { income: 40000, expense: 10000 }, Unassigned: { income: 0, expense: 5000 } });
    const sum = Object.values(split).reduce((s, v) => ({ income: s.income + v.income, expense: s.expense + v.expense }), { income: 0, expense: 0 });
    assert.deepEqual([sum.income, sum.expense], [pl.income.total, pl.expense.total]);
  });

  test('the bill without a location is listed by the check; edited to carry one, it is gone and the totals stay the same', async () => {
    const check = async () => runDataChecks({ transactions: await entries(), accounts: Object.values(acct), invoices: [], bills: [], recurring: [], today: '2026-10-07', baseCurrency: 'USD', dimensions })
      .filter(f => f.checkId === 'missing-label');
    const found = await check();
    assert.equal(found.length, 1);
    assert.match(found[0].title, /no Location on Office expenses/);
    const flagged = (await entries()).find(t => t.id === found[0].record!.id)!;
    assert.equal(flagged.metadata?.billId, unlabelledBill, 'the finding opens the bill\'s entry');

    const stored = (await db.collection('bills').doc(unlabelledBill).get()).data() as Bill;
    const edited = { ...stored, id: unlabelledBill, splits: [{ accountId: acct['6000'].id, amountCents: 5000, description: 'Coffee', dimensions: { location: 'HFA' } }] };
    await postBillLedger(unlabelledBill, edited, ws, OWNER, { collection: 'bills', docId: unlabelledBill, action: 'update', data: edited }, await context());
    assert.equal((await check()).length, 0);
    const pl = await report('/profit-and-loss?startDate=2026-05-01&endDate=2026-05-31&after=edit');
    assert.deepEqual([pl.income.total, pl.expense.total], [100000, 30000], 'the edit moved a label, not money');
    // the old unlabelled entry and its reversal are both in May now, so "Unassigned" nets to zero
    assert.deepEqual(await byLocation(), { TLV: { income: 60000, expense: 15000 }, HFA: { income: 40000, expense: 15000 }, Unassigned: { income: 0, expense: 0 } });
  });
});
