/**
 * W12-GOLD (RELEASE_GATE W12): a group with worked figures, on the real database — a parent in USD that owns all of
 * a subsidiary keeping its books in EUR, one intercompany sale and its elimination, the subsidiary translated at the
 * period's rates; the group P&L and balance sheet against figures by hand. Through the app's own code: the bulk
 * posting route, the intercompany posting route, the groups route and GET /reports/group-summary.
 *
 * Worked figures (cents; the subsidiary in euro cents), 2026:
 *   Parent (USD)   capital 100,000 · outside sales 60,000 · rent 20,000
 *   Daughter (EUR) capital €50,000 · outside sales €40,000 · rent €10,000
 *   04-15 the parent charges the daughter a fee: 11,000 to the parent's sales, €10,000 to the daughter's rent
 *         (both sides on their intercompany accounts: due from 11,000 / due to €10,000)
 *   Rates EUR→USD: closing 1.2 · average 1.1 · historical 1.0
 *
 *   Parent:   cash 140,000 + due from 11,000 = assets 151,000; capital 100,000; profit 60,000 + 11,000 − 20,000 = 51,000
 *   Daughter: cash €80,000; due to €10,000; capital €50,000; profit €40,000 − €20,000 = €20,000
 *     translated: assets 80,000 × 1.2 = 96,000; due to 10,000 × 1.2 = 12,000; capital 50,000 × 1.0 = 50,000;
 *     income 40,000 × 1.1 = 44,000; costs 20,000 × 1.1 = 22,000; profit 22,000;
 *     translation difference 96,000 − 12,000 − 50,000 − 22,000 = 12,000
 *   Eliminated: assets 11,000 (due from), liabilities 12,000 (due to at the closing rate) → difference −1,000, said
 *     and kept in equity; income 11,000 and costs 11,000 (€10,000 at the average) → no profit difference
 *   Group:  income 60,000 + 11,000 + 44,000 − 11,000 = 104,000; costs 20,000 + 22,000 − 11,000 = 31,000;
 *           net income 73,000 (51,000 + 22,000)
 *           assets 151,000 + 96,000 − 11,000 = 236,000; liabilities 12,000 − 12,000 = 0;
 *           equity 236,000 = capital 150,000 + net income 73,000 + translation 12,000 + the 1,000 difference
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

describe('W12 a group with worked figures', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const tag = crypto.randomBytes(4).toString('hex');
  const ann = `ann_w12_${tag}`;
  const [parent, daughter] = ['parent', 'daughter'].map(n => `ws_w12_${n}_${tag}`);
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  let groupId = '';
  const call = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const res = await fetch(`${base}${path}`, { method: init.method || 'GET', headers: { 'content-type': 'application/json', 'x-test-uid': ann }, ...(init.body ? { body: JSON.stringify(init.body) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const entry = (ws: string, currency: string, id: string, date: string, debit: string, credit: string, cents: number) => ({
    id: `${ws}_${id}`, workspaceId: ws, date, description: id, status: 'completed', type: 'actual', currency, totalAmountCents: cents,
    lines: [{ accountId: `${ws}_${debit}`, amountCents: cents }, { accountId: `${ws}_${credit}`, amountCents: -cents }],
  });
  const RATES = encodeURIComponent(JSON.stringify({ EUR: { closing: 1.2, average: 1.1, historical: 1 } }));
  const summary = () => call(`/api/v1/reports/group-summary?groupId=${groupId}&startDate=2026-01-01&endDate=2026-12-31&reportCurrency=USD&rates=${RATES}`);

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { reportRouter } = await import('../server/routes/reportRoutes');
    const { accountRouter } = await import('../server/routes/accountRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    for (const [ws, name, currency] of [[parent, 'Parent Co', 'USD'], [daughter, 'Daughter GmbH', 'EUR']]) {
      await db.collection('workspaces').doc(ws).set({ uid: ann, name, currency, members: [ann] });
      for (const [id, accName, type, category] of [['cash', 'Cash', 'asset', 'Cash'], ['sales', 'Sales', 'income', 'Revenue'], ['rent', 'Rent', 'expense', 'Operating'], ['capital', 'Capital', 'equity', 'Equity']]) {
        await db.collection('chartAccounts').doc(`${ws}_${id}`).set({ workspaceId: ws, name: accName, type, category, code: id });
      }
    }
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'ann@example.test' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    app.use('/api/v1/reports', reportRouter);
    app.use('/api/v1/account', accountRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    await db.pool.query(`delete from public."workspaceGroups" where data->>'ownerUid' = $1`, [ann]).catch(() => {});
    for (const ws of [parent, daughter]) {
      for (const table of ['transactions', 'chartAccounts', 'auditLogs']) await db.pool.query(`delete from public."${table}" where workspace_id = $1`, [ws]).catch(() => {});
      await db.pool.query('delete from public.workspaces where id = $1', [ws]).catch(() => {});
    }
    await db.terminate();
  });

  test('each company\'s own year, and the intercompany fee posted on both sides', async () => {
    for (const [ws, currency, capital, sale, rent] of [[parent, 'USD', 100_000, 60_000, 20_000], [daughter, 'EUR', 50_000, 40_000, 10_000]] as const) {
      const res = await call('/api/v1/transactions/bulk', { method: 'POST', body: { workspaceId: ws, transactions: [
        entry(ws, currency, 'capital', '2026-01-02', 'cash', 'capital', capital), entry(ws, currency, 'sale', '2026-03-01', 'cash', 'sales', sale), entry(ws, currency, 'rent', '2026-03-02', 'rent', 'cash', rent),
      ] } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
    }
    const fee = await call('/api/v1/transactions/intercompany/post', { method: 'POST', body: {
      sourceWorkspaceId: parent, targetWorkspaceId: daughter, amountCents: 11_000, targetAmountCents: 10_000, date: '2026-04-15', description: 'Management fee',
      sourceAccountId: `${parent}_sales`, targetAccountId: `${daughter}_rent`,
    } });
    assert.equal(fee.status, 200, JSON.stringify(fee.body));
    const made = await call('/api/v1/account/groups', { method: 'POST', body: { name: 'Parent group', workspaceIds: [parent, daughter], parentId: parent, ownership: { [daughter]: 100 } } });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    groupId = String((made.body.group as { id: string }).id);
  });

  test('each company as its own books say, the daughter translated: 96,000 = 12,000 + 50,000 + 22,000 + 12,000', async () => {
    const res = await summary();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [p, d] = res.body.members as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    assert.deepEqual([p.name, p.income, p.expense, p.netIncome, p.totalAssets, p.totalLiabilities], ['Parent Co', 71_000, 20_000, 51_000, 151_000, 0]);
    assert.deepEqual([d.name, d.currency, d.income, d.expense, d.netIncome, d.totalAssets, d.totalLiabilities], ['Daughter GmbH', 'EUR', 40_000, 20_000, 20_000, 80_000, 10_000], 'in its own euros');
    const t = d.translated;
    assert.deepEqual([t.income, t.expense, t.netIncome, t.totalAssets, t.totalLiabilities, t.cta], [44_000, 22_000, 22_000, 96_000, 12_000, 12_000]);
  });

  test('the group: income 104,000, costs 31,000, net income 73,000; assets 236,000 = liabilities 0 + equity 236,000', async () => {
    const res = await summary();
    const total = res.body.total as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    assert.equal(total.currency, 'USD');
    assert.deepEqual([total.income, total.expense, total.netIncome], [104_000, 31_000, 73_000], 'the group did not sell to itself');
    assert.deepEqual([total.totalAssets, total.totalLiabilities, total.totalEquity], [236_000, 0, 236_000]);
    assert.equal(total.cta, 12_000);
    assert.deepEqual(
      [total.eliminated.assets, total.eliminated.liabilities, total.eliminated.difference, total.eliminated.income, total.eliminated.expense, total.eliminated.profitDifference],
      [11_000, 12_000, -1_000, 11_000, 11_000, 0], 'the fee taken out on both sides; its balances differ by the rate, and it is said');
    assert.deepEqual(res.body.intercompany, { matched: 1, unmatched: [] });
  });
});
