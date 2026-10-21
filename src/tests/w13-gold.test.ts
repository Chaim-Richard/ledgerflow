/**
 * W13-GOLD (RELEASE_GATE W13, "Verified"): the stock journey end to end against a real database, figures by hand.
 * Bills and the invoice are posted by the app's own posting code; the server moves the stock, keeps the stock history
 * and the moving-average cost; the valuation, the past-date valuation, the profit and loss and the revaluation are
 * read through the code the screens use. The test runs when LF_TEST_DATABASE_URL is set.
 *
 * Worked figures (cents). Chairs, none on hand to start.
 *   2026-04-01  bill B-1 (Oak Supply):   10 at 4,000 = 40,000   → 10 on hand, average 4,000, Inventory 40,000
 *   2026-04-10  bill B-2 (Elm Supply):   10 at 4,600 = 46,000   → 20 on hand, average (40,000 + 46,000) / 20 = 4,300
 *   2026-04-15  invoice INV-1 (Acme):    12 at 9,000 = 108,000 revenue; cost of goods 12 × 4,300 = 51,600
 *                                        → 8 on hand, Inventory 86,000 − 51,600 = 34,400
 *   April P&L:  revenue 108,000 − cost of goods 51,600 = gross profit 56,400
 *   valuation 2026-04-30: 8 × 4,300 = 34,400 = the Inventory account 34,400 → difference 0
 *   valuation on 2026-04-12 (from the stock history): 20 units, 86,000
 *   2026-05-02  revaluation to 4,500:    8 × 4,500 − 8 × 4,300 = +1,600 → Inventory 36,000 = 8 × 4,500 → difference 0
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import { itemDetails, type StockMove } from '../lib/stockMoves';
import { inventoryAsOf } from '../lib/inventoryAsOf';
import type { ChartAccount, InventoryItem, Transaction, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('W13 with worked figures', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_w13_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  const chair = `${ws}_chair`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  const send = async (method: string, path: string, body?: unknown) => {
    const res = await realFetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': OWNER }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const all = async <T>(collection: string) => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as T);
  const item = async () => (await db.collection('inventory').doc(chair).get()).data() as InventoryItem;
  const context = async (): Promise<LedgerPostContext> => ({
    accounts: Object.values(acct), lockDate: null, uid: OWNER, inventory: [{ ...(await item()), id: chair }],
    transactions: await all<Transaction>('transactions'),
    workspaces: [{ id: ws, uid: OWNER, name: 'Chair Shop', currency: 'USD' } as Workspace],
  });
  const inventoryBalance = async (asOf: string) => (await all<Transaction>('transactions'))
    .filter(t => ['completed', 'approved', 'posted'].includes(String(t.status)) && String(t.date) <= asOf)
    .flatMap(t => t.lines || []).filter(l => l.accountId === acct['1300'].id).reduce((s, l) => s + l.amountCents, 0);
  const valuation = async (asOf: string) => {
    const { computeInventoryValuation } = await import('../server/reports/itemReports');
    return computeInventoryValuation([{ ...(await item()), id: chair }] as never, Object.values(acct), await all<Transaction>('transactions'), asOf);
  };
  const bill = async (id: string, number: string, vendorId: string, date: string, quantity: number, unitCents: number) => {
    const data = {
      id, workspaceId: ws, uid: OWNER, number, vendorId, vendorName: vendorId, date, dueDate: date, status: 'pending' as const, currency: 'USD',
      amountCents: quantity * unitCents, splits: [{ amountCents: quantity * unitCents, accountId: acct['1300'].id, description: 'Chairs', itemId: chair, quantity }],
    };
    await postBillLedger(id, data as never, ws, OWNER, { collection: 'bills', docId: id, action: 'update', data }, await context());
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { inventoryRouter } = await import('../server/routes/inventoryRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'Chair Shop', currency: 'USD', timezone: 'UTC', members: [OWNER] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@chairs.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/reports', reportRouter);
    app.use('/api/v1/inventory', inventoryRouter);
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
      { name: 'Inventory', code: '1300', type: 'Inventory' },
      { name: 'Accounts Payable', code: '2000', type: 'Accounts payable' },
      { name: 'Sales', code: '4000', type: 'Income' },
      { name: 'Cost of goods sold', code: '5000', type: 'Cost of goods sold' },
      { name: 'Inventory revaluation', code: '5150', type: 'Expense' },
    ] });
    assert.equal(accounts.status, 200, JSON.stringify(accounts.body));
    for (const a of await all<ChartAccount>('chartAccounts')) acct[String(a.code)] = a;
    await db.collection('inventory').doc(chair).set({ workspaceId: ws, name: 'Chair', sku: 'CH', itemType: 'stock', quantityAtHand: 0, unitCostCents: 0, unitPriceCents: 9_000, reorderPoint: 0, uid: OWNER });
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'bills', 'invoices', 'inventory', 'stockMoves', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('two bills at two prices: 20 chairs at an average of 4,300, Inventory 86,000', async () => {
    await bill(`${ws}_b1`, 'B-1', 'oak', '2026-04-01', 10, 4_000);
    assert.deepEqual([(await item()).quantityAtHand, (await item()).unitCostCents], [10, 4_000]);
    await bill(`${ws}_b2`, 'B-2', 'elm', '2026-04-10', 10, 4_600);
    assert.deepEqual([(await item()).quantityAtHand, (await item()).unitCostCents], [20, 4_300], '(40,000 + 46,000) / 20');
    assert.equal(await inventoryBalance('2026-04-10'), 86_000);
  });

  test('selling 12 at 90.00: revenue 108,000, cost of goods 51,600, 8 left, Inventory 34,400', async () => {
    const id = `${ws}_inv1`;
    const invoice = {
      id, workspaceId: ws, uid: OWNER, number: 'INV-1', customerId: 'acme', customerName: 'Acme', date: '2026-04-15', dueDate: '2026-05-15', status: 'sent' as const,
      amountCents: 108_000, amountPaidCents: 0, currency: 'USD', taxVersion: 2, taxAmountCents: 0,
      items: [{ id: 'l1', itemId: chair, description: 'Chair', quantity: 12, rateCents: 9_000, amountCents: 108_000, accountId: acct['4000'].id }],
    };
    await postInvoiceLedger(id, invoice as never, ws, OWNER, { collection: 'invoices', docId: id, action: 'create', data: invoice }, await context());
    assert.deepEqual([(await item()).quantityAtHand, (await item()).unitCostCents], [8, 4_300], 'a sale leaves the average as it was');
    const cogs = (await all<Transaction>('transactions')).filter(t => t.metadata?.type === 'invoice-cogs-auto');
    assert.deepEqual(cogs.map(t => t.totalAmountCents), [51_600], '12 × 4,300');
    assert.equal(await inventoryBalance('2026-04-30'), 34_400);
    const pl = (await send('GET', `/api/v1/reports/profit-and-loss?startDate=2026-04-01&endDate=2026-04-30&workspaceId=${ws}`)).body;
    assert.equal(pl.income.total, 108_000);
    assert.equal(pl.netIncome, 56_400, '108,000 − 51,600');
  });

  test('the valuation on 2026-04-30 is 8 × 4,300 = 34,400 and agrees with the books; on 2026-04-12 the history says 20 units, 86,000', async () => {
    const v = await valuation('2026-04-30');
    assert.deepEqual([v.totalValueCents, v.ledgerValueCents, v.differenceCents], [34_400, 34_400, 0]);
    const moves = await all<StockMove>('stockMoves');
    const past = inventoryAsOf({ asOf: '2026-04-12', items: [{ ...(await item()), id: chair }], toToday: itemDetails(moves, '1900-01-01', '2026-10-21') });
    assert.deepEqual(past.rows.map(r => [r.quantity, r.valueCents]), [[20, 86_000]]);
    assert.equal(past.complete, true);
  });

  test('revaluing the 8 chairs to 45.00 posts +1,600: the valuation 36,000 still agrees with the books', async () => {
    const res = await send('POST', '/api/v1/inventory/revalue', {
      workspaceId: ws, itemId: chair, newUnitCostCents: 4_500, inventoryAccountId: acct['1300'].id, offsetAccountId: acct['5150'].id,
      date: '2026-05-02', reason: 'Supplier price list', requestId: `w13-${crypto.randomBytes(6).toString('hex')}`,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.valueCents, 1_600, '8 × 4,500 − 8 × 4,300');
    const v = await valuation('2026-05-31');
    assert.deepEqual([v.totalValueCents, v.ledgerValueCents, v.differenceCents], [36_000, 36_000, 0]);
  });
});
