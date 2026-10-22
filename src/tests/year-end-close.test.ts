/**
 * Closing a year (CA-07): no closing entry is posted any more — the balance sheet carries every past
 * year's profit in retained earnings by itself, and the entry made the closed year's profit and loss
 * show zero. Closing records the year's profit in the audit trail and locks the year when asked; a
 * closing entry posted before this is ignored, so the old year's P&L reads right again and the
 * balance sheet still balances. The route part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { calculateNetIncome, isPostable } from '../lib/txFilters';
import { computeBalanceSheet, computeProfitAndLoss } from '../server/reports/computeReports';
import { fiscalYearStart } from '../server/routes/transactions/periodRoutes';
import { makeChartAccount, makeTransaction } from './fixtures';

const accounts = [
  makeChartAccount({ id: 'cash', name: 'Cash', type: 'asset' }),
  makeChartAccount({ id: 'sales', name: 'Sales', type: 'income' }),
  makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense' }),
  makeChartAccount({ id: 're', name: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings' } as never),
];
const year = [
  makeTransaction({ id: 's', date: '2026-03-01', lines: [{ accountId: 'cash', accountName: 'Cash', amountCents: 100000 }, { accountId: 'sales', accountName: 'Sales', amountCents: -100000 }] }),
  makeTransaction({ id: 'r', date: '2026-04-01', lines: [{ accountId: 'rent', accountName: 'Rent', amountCents: 30000 }, { accountId: 'cash', accountName: 'Cash', amountCents: -30000 }] }),
];
// what the old year-end close posted: revenue and expenses moved to retained earnings
const oldClose = makeTransaction({
  id: 'close', date: '2026-12-31', type: 'adjustment' as never, metadata: { isYearEndClose: true },
  lines: [{ accountId: 'sales', accountName: 'Sales', amountCents: 100000 }, { accountId: 'rent', accountName: 'Rent', amountCents: -30000 }, { accountId: 're', accountName: 'Retained Earnings', amountCents: -70000 }],
});

describe('Past closing entries', () => {
  test('are not counted: the closed year\'s profit and loss reads right', () => {
    assert.equal(isPostable(oldClose), false);
    assert.equal(calculateNetIncome([...year, oldClose], accounts, '2026-01-01', '2026-12-31').netIncome, 70000);
    assert.equal(computeProfitAndLoss(accounts, [...year, oldClose], '2026-01-01', '2026-12-31').netIncome, 70000);
  });

  test('the balance sheet is the same with or without one, and balances', () => {
    const without = computeBalanceSheet(accounts, year, '2026-12-31');
    const withOld = computeBalanceSheet(accounts, [...year, oldClose], '2026-12-31');
    assert.deepEqual([withOld.totalAssets, withOld.totalClaims, withOld.isBalanced], [without.totalAssets, without.totalClaims, true]);
    assert.equal(without.totalAssets, 70000);
  });

  test('the year a closing date ends', () => {
    assert.deepEqual(['2026-12-31', '2026-06-30', '2028-02-29', '2027-02-28'].map(fiscalYearStart), ['2026-01-01', '2025-07-01', '2027-03-01', '2026-03-01']);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Closing a year through the route (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_yec_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  const other = `${ws}x`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const close = async (uid: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/api/v1/transactions/close-year`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ workspaceId: ws, ...body }) });
    return { status: res.status, body: await res.json() as { message?: string; netIncomeCents?: number; error?: string } };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'YEC', currency: 'USD', members: ['owner-1', 'acc-1'], roles: { 'acc-1': 'accountant' } });
    for (const a of accounts) await db.collection('chartAccounts').doc(id(a.id)).set({ ...a, id: id(a.id), workspaceId: ws });
    for (const t of year) await db.collection('transactions').doc(id(t.id)).set({ ...t, id: id(t.id), workspaceId: ws, lines: t.lines.map(l => ({ ...l, accountId: id(l.accountId) })) });
    // another workspace's sale in the same year must not count in this one's profit
    await db.collection('chartAccounts').doc(`${other}_sales`).set({ ...accounts[1], id: `${other}_sales`, workspaceId: other });
    await db.collection('transactions').doc(`${other}_s`).set({ ...year[0], id: `${other}_s`, workspaceId: other, lines: [{ accountId: `${other}_sales`, accountName: 'Sales', amountCents: -999999 }, { accountId: `${other}_sales`, accountName: 'Sales', amountCents: 999999 }] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'chartAccounts', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]);
    await db.terminate();
  });

  test('records the year\'s profit (this workspace only) and locks it; posts no entry', async () => {
    assert.equal((await close('acc-1', { closingDate: '2026-06-30' })).status, 403, 'the owner closes a year');
    const res = await close('owner-1', { closingDate: '2026-06-30', lockPeriod: true });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.netIncomeCents, 70000);
    assert.match(res.body.message || '', /^Year 2025-07-01 – 2026-06-30 closed\. Its net profit of 700\.00 is carried in retained earnings/);
    const entries = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => d.id).sort();
    assert.deepEqual(entries, [id('r'), id('s')], 'no closing entry');
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.lockDate, '2026-06-30');
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data()).find(a => a.action === 'FISCAL_YEAR_CLOSE');
    assert.equal((audit?.details as { netIncomeCents: number }).netIncomeCents, 70000);
  });
});
