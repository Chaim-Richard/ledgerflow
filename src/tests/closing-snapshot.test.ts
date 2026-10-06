/**
 * Closing balance snapshots (CA-06): closing a month keeps every account's balance on its last day;
 * the balance check works them out again from the whole ledger and lists the accounts that moved
 * since (an entry dated in the closed month added later, for example during a partial unlock).
 * Closing again after a reopen replaces the snapshot whole. The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { balancesAsOf, snapshotChanges, takeClosingSnapshot } from '../lib/closingSnapshot';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Firestore } from '../server/db/pgFirestore';

const accounts = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', openingBalanceCents: 10000 }),
  makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income' }),
  makeChartAccount({ id: 'rent', code: '6000', name: 'Rent', type: 'expense' }),
];
const sale = (id: string, date: string, cents: number, status = 'completed') => makeTransaction({
  id, date, status: status as never, lines: [{ accountId: 'cash', accountName: 'Cash', amountCents: cents }, { accountId: 'sales', accountName: 'Sales', amountCents: -cents }],
});

describe('The snapshot rule', () => {
  test('opening balance plus every counted line up to the date; drafts, later dates and zeros left out', () => {
    const ledger = [sale('a', '2026-03-05', 5000), sale('b', '2026-03-31T18:00:00Z', 2500), sale('c', '2026-04-01', 999), sale('d', '2026-03-10', 700, 'draft')];
    const { balances, entries } = balancesAsOf(accounts, ledger, '2026-03-31');
    assert.deepEqual(balances, { cash: 17500, sales: -7500 }, 'rent is zero and left out; a time on the last day still counts');
    assert.equal(entries, 2);
    const snapshot = takeClosingSnapshot(accounts, ledger, '2026-03-31', '2026-04-02T09:00:00Z');
    assert.deepEqual(snapshot, { asOfDate: '2026-03-31', takenAt: '2026-04-02T09:00:00Z', entries: 2, accounts: [{ accountId: 'cash', cents: 17500 }, { accountId: 'sales', cents: -7500 }] });
  });

  test('changes: only the accounts that moved, with then, now and the difference; a removed account is named as such', () => {
    const snapshot = takeClosingSnapshot(accounts, [sale('a', '2026-03-05', 5000)], '2026-03-31');
    assert.deepEqual(snapshotChanges(snapshot, balancesAsOf(accounts, [sale('a', '2026-03-05', 5000)], '2026-03-31'), accounts), []);
    const later = [sale('a', '2026-03-05', 5000), makeTransaction({ id: 'r', date: '2026-03-20', lines: [{ accountId: 'rent', amountCents: 1200 }, { accountId: 'gone', amountCents: -1200 }] })];
    const changes = snapshotChanges(snapshot, balancesAsOf(accounts, later, '2026-03-31'), accounts);
    assert.deepEqual(changes.map(c => [c.code, c.name, c.atCloseCents, c.nowCents, c.differenceCents]), [
      ['', 'Removed account (gone)', 0, -1200, -1200],
      ['6000', 'Rent', 0, 1200, 1200],
    ]);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Closing a month keeps its balances (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_snap_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = async (uid: string, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/periods${path}`, {
      method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() as Record<string, unknown> & { changes?: Array<{ accountId: string; atCloseCents: number; nowCents: number; differenceCents: number }>; snapshot?: { asOfDate: string; entries: number; accounts: number } | null; entriesNow?: number } };
  };
  const entry = (name: string, date: string, lines: Array<[string, number]>) => db.collection('transactions').doc(id(name)).set({
    workspaceId: ws, date, description: name, status: 'completed', totalAmountCents: Math.abs(lines[0][1]),
    lines: lines.map(([account, cents]) => ({ accountId: id(account), accountName: account, amountCents: cents })),
  });
  const snapshotOf = async () => ((await db.collection('periods').doc(`${ws}_2026-03`).get()).data() || {}).closingSnapshot as { accounts: Array<{ accountId: string; cents: number }>; entries: number };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Snap', currency: 'USD', members: ['owner-1', 'book-1'], roles: { 'book-1': 'bookkeeper' } });
    for (const [name, type, code] of [['cash', 'asset', '1000'], ['sales', 'income', '4000'], ['rent', 'expense', '6000']]) {
      await db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, name, type, code });
    }
    await entry('s1', '2026-03-05', [['cash', 5000], ['sales', -5000]]);
    await entry('r1', '2026-03-20', [['rent', 1200], ['cash', -1200]]);
    await entry('s2', '2026-04-03', [['cash', 800], ['sales', -800]]);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'chartAccounts', 'periods', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('before any close there is nothing to compare', async () => {
    const check = await call('book-1', 'GET', '/2026-03/balance-check');
    assert.equal(check.status, 200, JSON.stringify(check.body));
    assert.equal(check.body.snapshot, null);
  });

  test('closing keeps the balances on the last day; nothing has moved since', async () => {
    const closed = await call('owner-1', 'POST', '/2026-03/close', { mode: 'soft' });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const snapshot = await snapshotOf();
    assert.deepEqual(snapshot.accounts, [{ accountId: id('cash'), cents: 3800 }, { accountId: id('rent'), cents: 1200 }, { accountId: id('sales'), cents: -5000 }].sort((a, b) => a.accountId.localeCompare(b.accountId)));
    assert.equal(snapshot.entries, 2, 'April is not in March\'s balances');
    const check = await call('book-1', 'GET', '/2026-03/balance-check');
    assert.deepEqual([check.body.snapshot?.asOfDate, check.body.snapshot?.accounts, check.body.changes], ['2026-03-31', 3, []]);
  });

  test('an entry dated in the closed month afterwards shows up, account by account', async () => {
    await entry('late', '2026-03-28', [['rent', 300], ['cash', -300]]);
    const check = await call('book-1', 'GET', '/2026-03/balance-check');
    assert.deepEqual(check.body.changes?.map(c => [c.accountId, c.atCloseCents, c.nowCents, c.differenceCents]).sort(), [
      [id('cash'), 3800, 3500, -300],
      [id('rent'), 1200, 1500, 300],
    ]);
    assert.deepEqual([check.body.snapshot?.entries, check.body.entriesNow], [2, 3]);
  });

  test('closing again after a reopen replaces the snapshot whole (an account back at zero is gone from it)', async () => {
    assert.equal((await call('owner-1', 'POST', '/2026-03/reopen', { reason: 'late rent entry' })).status, 200);
    await entry('rent-back', '2026-03-29', [['cash', 1500], ['rent', -1500]]);
    assert.equal((await call('owner-1', 'POST', '/2026-03/close', { mode: 'hard' })).status, 200);
    const snapshot = await snapshotOf();
    assert.deepEqual(snapshot.accounts.map(a => a.accountId).sort(), [id('cash'), id('sales')], 'rent is at zero: not kept from the first snapshot');
    assert.equal(snapshot.entries, 4);
    assert.deepEqual((await call('book-1', 'GET', '/2026-03/balance-check')).body.changes, []);
  });
});
