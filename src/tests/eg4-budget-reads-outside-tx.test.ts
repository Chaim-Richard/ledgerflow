/**
 * EG-4 review (4366282441): the budget figures are read before the save's database transaction, never through the
 * pool while the transaction holds a connection. A whole save on a pool of one (PG_POOL_MAX=1) is not testable:
 * the save already hangs there with budgetControl 'off' (other reads inside the transaction, from before EG-4). So
 * this records, for every read of budgets and of balances (budgets, transactions by date, periodBalances), whether
 * a transaction was open, on both routes. Figures by hand: Rent budget 100.00 for Oct 2026, nothing posted.
 *   bulk journal Rent 80.00 → 200, no warning (80.00 ≤ 100.00)
 *   single entry Rent 50.00 → 200, a warning: 80.00 + 50.00 = 130.00, 30.00 over
 *   block: bulk Rent 10.00 → 409 (130.00 + 10.00 = 140.00); single Rent 10.00 → 409
 * Every such read happens with no transaction open (before the fix they ran inside it).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const url = process.env.LF_TEST_DATABASE_URL;

describe('EG-4: the budget figures are read outside the save\'s transaction', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg4p_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-eg4p';
  let db: import('../server/db/pgFirestore').Firestore;
  let server: Server;
  let base = '';
  const reads: Array<{ name: string; open: boolean }> = [];
  const id = (s: string) => `${ws}_${s}`;
  const journal = (cents: number) => ({
    id: crypto.randomUUID(), workspaceId: ws, date: '2026-10-15', description: 'EG-4 pool', totalAmountCents: cents, currency: 'USD', status: 'completed', type: 'actual',
    lines: [{ accountId: id('rent'), amountCents: cents, description: 'Rent' }, { accountId: id('bank'), amountCents: -cents, description: 'Rent' }],
  });
  const call = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': OWNER, 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as { budgetWarnings?: Array<{ overCents: number }>; message?: string; error?: string } };
  };
  const bulk = (cents: number) => call('/api/v1/transactions/bulk', { workspaceId: ws, transactions: [journal(cents)] });
  const single = (cents: number) => call('/api/v1/transactions', { workspaceId: ws, transaction: journal(cents) });

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    await db.collection('workspaces').doc(ws).set({ id: ws, uid: OWNER, name: 'EG-4 pool', currency: 'USD', timezone: 'UTC', members: [OWNER], roles: { [OWNER]: 'owner' } });
    for (const a of [{ id: id('bank'), name: 'Bank', type: 'asset', category: 'Cash', code: '1000' }, { id: id('rent'), name: 'Rent', type: 'expense', code: '6100' }]) {
      await db.collection('chartAccounts').doc(a.id).set({ ...a, workspaceId: ws });
    }
    await db.collection('budgets').doc(id('b')).set({ id: id('b'), workspaceId: ws, targetType: 'account', targetId: id('rent'), period: '2026-10', amountCents: 10_000, createdAt: '2026-10-01T00:00:00Z' });
    // every read of the budget figures, and whether a transaction was open then
    let open = 0;
    const realRun = db.runTransaction.bind(db);
    (db as unknown as { runTransaction: typeof db.runTransaction }).runTransaction = (async (fn: never) => { open++; try { return await realRun(fn); } finally { open--; } }) as never;
    const realCollection = db.collection.bind(db);
    (db as unknown as { collection: typeof db.collection }).collection = ((name: string) => { if (name === 'budgets' || name === 'periodBalances') reads.push({ name, open: open > 0 }); return realCollection(name); }) as never;
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', (await import('../server/routes/transactionRoutes')).transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'budgets', 'chartAccounts', 'idempotencyKeys', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.terminate();
  });

  test('warn: both routes answer on one connection, the second with a warning', async () => {
    const first = await bulk(8_000);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.budgetWarnings, undefined);
    const second = await single(5_000);
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(second.body.budgetWarnings?.[0].overCents, 3_000);
    assert.ok(reads.some(r => r.name === 'budgets'), 'the budgets were read');
    assert.deepEqual(reads.filter(r => r.open), [], 'no budget read inside a transaction');
  });

  test('block: both routes refuse on one connection', async () => {
    await db.collection('workspaces').doc(ws).update({ budgetControl: 'block' });
    const viaBulk = await bulk(1_000);
    assert.equal(viaBulk.status, 409, JSON.stringify(viaBulk.body));
    const viaSingle = await single(1_000);
    assert.equal(viaSingle.status, 409, JSON.stringify(viaSingle.body));
    assert.match(String(viaSingle.body.message), /Over the budget for Rent/);
    assert.deepEqual(reads.filter(r => r.open), [], 'no budget read inside a transaction');
  });
});
