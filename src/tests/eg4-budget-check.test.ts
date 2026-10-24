/**
 * EG-4: the budget check when entries post (POST /transactions, /transactions/bulk, /documents/bills/:id/post), on the
 * local test database. Workspace in USD. Figures by hand:
 *   Rent (6100, expense): budget 1,000.00 a month from Oct 2026 (targetId = the account's id)
 *     already posted: 600.00 on 5 Oct; 500.00 on 20 Sep (another month, not counted)
 *   Travel (6200, expense): budget 3,000.00 a quarter from Oct 2026 (targetId = "Travel", by name) → Oct–Dec
 *     already posted: 2,500.00 on 3 Nov
 *   1. journal (bulk) Rent 300.00 on 15 Oct: 600.00 + 300.00 = 900.00 ≤ 1,000.00 → posted, no budgetWarnings
 *   2. journal (POST /transactions) Rent 200.00 on 20 Oct: 900.00 + 200.00 = 1,100.00 > 1,000.00, 100.00 over → posted with a warning
 *      "Over the budget for Rent (2026-10-01 to 2026-10-31): budget $1,000.00, spent $900.00, this $200.00 → $1,100.00, $100.00 over"
 *   3. bill Travel 600.00 on 10 Dec: 2,500.00 + 600.00 = 3,100.00 > 3,000.00, 100.00 over → posted with a warning
 *   4. the bill lowered to 500.00: the request reverses 600.00 and posts 500.00, net −100.00 → no warning (it lowers)
 *   5. a bookkeeper sets budgetControl → 403; 'never' → 400; the owner sets 'block' → 200
 *   6. block: Rent 50.00 on 25 Oct: 1,100.00 + 50.00 = 1,150.00 → 409 (both routes), nothing saved
 *      "Over the budget for Rent (2026-10-01 to 2026-10-31): budget $1,000.00, spent $1,100.00, this $50.00 → $1,150.00, $150.00 over"
 *   7. block: a Rent refund of 100.00 (credit) → posted (it lowers spending); Rent now 1,000.00
 *   8. block: Rent 30.00 on 3 Nov → posted (November: 0.00 + 30.00 ≤ 1,000.00)
 *   9. off: Rent 50.00 on 26 Oct → posted, no warnings (1,050.00 would be over)
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { BudgetWarning } from '../server/services/budgetGuard';

const url = process.env.LF_TEST_DATABASE_URL;

describe('EG-4: the budget check when posting', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg4_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-eg4', BOOKKEEPER = 'bk-eg4';
  let db: import('../server/db/pgFirestore').Firestore;
  let server: Server;
  let base = '';
  const id = (s: string) => `${ws}_${s}`;
  const accounts = [
    { id: id('bank'), name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
    { id: id('ap'), name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' },
    { id: id('rent'), name: 'Rent', type: 'expense', code: '6100' },
    { id: id('travel'), name: 'Travel', type: 'expense', code: '6200' },
  ].map(a => ({ ...a, workspaceId: ws }));
  const journal = (account: string, cents: number, date: string) => ({
    id: crypto.randomUUID(), workspaceId: ws, date, description: 'EG-4', totalAmountCents: Math.abs(cents), currency: 'USD', status: 'completed', type: 'actual',
    lines: [{ accountId: id(account), amountCents: cents, description: 'EG-4' }, { accountId: id('bank'), amountCents: -cents, description: 'EG-4' }],
  });
  const call = async (path: string, method: string, body: unknown, uid = OWNER) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid, 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> & { budgetWarnings?: BudgetWarning[]; error?: string; message?: string; code?: string } };
  };
  const bulk = (tx: ReturnType<typeof journal>) => call('/api/v1/transactions/bulk', 'POST', { workspaceId: ws, transactions: [tx] });
  const single = (tx: ReturnType<typeof journal>) => call('/api/v1/transactions', 'POST', { workspaceId: ws, transaction: tx });
  const setControl = (budgetControl: string, uid = OWNER) => call(`/api/v1/workspaces/${ws}/budget-control`, 'PUT', { budgetControl }, uid);
  const exists = async (txId: string) => (await db.collection('transactions').doc(txId).get()).exists;
  const bill = (cents: number) => ({
    id: id('bill1'), workspaceId: ws, vendorId: 'v1', vendorName: 'Airline', number: 'B-1', date: '2026-12-10', dueDate: '2027-01-09', status: 'pending', currency: 'USD',
    amountCents: cents, taxAmountCents: 0, splits: [{ accountId: id('travel'), amountCents: cents, description: 'Flights' }],
  });

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    await db.collection('workspaces').doc(ws).set({ id: ws, uid: OWNER, name: 'EG-4', currency: 'USD', timezone: 'UTC', members: [OWNER, BOOKKEEPER], roles: { [OWNER]: 'owner', [BOOKKEEPER]: 'bookkeeper' }, defaultAccountMappings: { ap: id('ap') } });
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set(a);
    await db.collection('budgets').doc(id('b_rent')).set({ id: id('b_rent'), workspaceId: ws, targetType: 'account', targetId: id('rent'), period: 'monthly', amountCents: 100_000, startDate: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' });
    await db.collection('budgets').doc(id('b_travel')).set({ id: id('b_travel'), workspaceId: ws, targetType: 'account', targetId: 'Travel', period: 'quarterly', amountCents: 300_000, startDate: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' });
    for (const [account, cents, date] of [['rent', 60_000, '2026-10-05'], ['rent', 50_000, '2026-09-20'], ['travel', 250_000, '2026-11-03']] as const) {
      const tx = journal(account, cents, date);
      await db.collection('transactions').doc(tx.id).set(tx);
    }
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'eg4@test' }; next(); });
    app.use('/api/v1/transactions', (await import('../server/routes/transactionRoutes')).transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    app.use('/api/v1/workspaces', (await import('../server/routes/workspaceRoutes')).workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'bills', 'budgets', 'chartAccounts', 'idempotencyKeys', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.terminate();
  });

  test('1. a 300.00 Rent journal (900.00 of 1,000.00): posted, no warnings', async () => {
    const res = await bulk(journal('rent', 30_000, '2026-10-15'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.budgetWarnings, undefined);
  });

  test('2. a 200.00 Rent journal (1,100.00 of 1,000.00): posted, with a warning', async () => {
    const tx = journal('rent', 20_000, '2026-10-20');
    const res = await single(tx);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(await exists(tx.id));
    const [w] = res.body.budgetWarnings!;
    assert.deepEqual([w.budgetCents, w.actualCents, w.thisCents, w.totalCents, w.overCents, w.startDate, w.endDate], [100_000, 90_000, 20_000, 110_000, 10_000, '2026-10-01', '2026-10-31']);
    assert.equal(w.message, 'Over the budget for Rent (2026-10-01 to 2026-10-31): budget $1,000.00, spent $900.00, this $200.00 → $1,100.00, $100.00 over');
  });

  test('3. a 600.00 Travel bill (3,100.00 of 3,000.00 for the quarter): posted, with a warning', async () => {
    const res = await call(`/api/v1/documents/bills/${id('bill1')}/post`, 'POST', { workspaceId: ws, action: 'create', data: bill(60_000) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [w] = res.body.budgetWarnings!;
    assert.deepEqual([w.accountId, w.budgetCents, w.actualCents, w.thisCents, w.totalCents, w.startDate, w.endDate], [id('travel'), 300_000, 250_000, 60_000, 310_000, '2026-10-01', '2026-12-31']);
  });

  test('4. the bill lowered to 500.00 (net −100.00): no warning', async () => {
    const res = await call(`/api/v1/documents/bills/${id('bill1')}/post`, 'POST', { workspaceId: ws, action: 'update', data: bill(50_000) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.budgetWarnings, undefined);
  });

  test('5. only an owner changes budgetControl', async () => {
    assert.equal((await setControl('block', BOOKKEEPER)).status, 403);
    assert.equal((await setControl('never')).status, 400);
    const res = await setControl('block');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.budgetControl, 'block');
  });

  test('6. block: a 50.00 Rent journal (1,150.00): 409 on both routes, nothing saved', async () => {
    const message = 'Over the budget for Rent (2026-10-01 to 2026-10-31): budget $1,000.00, spent $1,100.00, this $50.00 → $1,150.00, $150.00 over';
    const a = journal('rent', 5_000, '2026-10-25');
    const viaBulk = await bulk(a);
    assert.equal(viaBulk.status, 409, JSON.stringify(viaBulk.body));
    assert.equal(viaBulk.body.error, message);
    assert.equal(viaBulk.body.code, 'OVER_BUDGET');
    const b = journal('rent', 5_000, '2026-10-25');
    const viaSingle = await single(b);
    assert.equal(viaSingle.status, 409, JSON.stringify(viaSingle.body));
    assert.equal(viaSingle.body.message, message);
    assert.equal(await exists(a.id), false);
    assert.equal(await exists(b.id), false);
  });

  test('7. block: a 100.00 Rent refund lowers spending: posted', async () => {
    const res = await bulk(journal('rent', -10_000, '2026-10-26'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.budgetWarnings, undefined);
  });

  test('8. block: 30.00 of Rent in November (a new month): posted', async () => {
    const res = await bulk(journal('rent', 3_000, '2026-11-03'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('9. off: a 50.00 Rent journal over the budget: posted, no warnings', async () => {
    assert.equal((await setControl('off')).status, 200);
    const res = await bulk(journal('rent', 5_000, '2026-10-26'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.budgetWarnings, undefined);
  });
});
