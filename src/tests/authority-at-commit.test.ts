/**
 * P0 authority at commit (owner's integrity follow-up, 18 Oct): the writer role is checked again inside
 * the posting transaction. A request that passed the first check, whose role is then taken away (or who
 * is removed from the books), cannot commit; ordinary concurrent writers are unaffected.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const url = process.env.LF_TEST_DATABASE_URL;
describe('authority is checked at commit (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_auth_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const entry = (id: string) => ({ id: `${ws}_${id}`, workspaceId: ws, date: '2026-05-02', description: id, status: 'completed', totalAmountCents: 500, currency: 'USD',
    lines: [{ accountId: `${ws}_bank`, amountCents: -500 }, { accountId: `${ws}_rent`, amountCents: 500 }] });
  const post = (uid: string, id: string) => fetch(`${base}/api/v1/transactions/bulk`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ workspaceId: ws, transactions: [entry(id)] }) })
    .then(async r => ({ status: r.status, body: await r.json() as Record<string, unknown> }));
  const exists = async (id: string) => (await db.collection('transactions').doc(`${ws}_${id}`).get()).exists;
  /** run `change` after the route's first checks, just before its transaction (a "paused" request) */
  const between = (change: () => Promise<void>) => {
    const original = db.runTransaction.bind(db);
    (db as unknown as { runTransaction: unknown }).runTransaction = (async (fn: never) => {
      (db as unknown as { runTransaction: unknown }).runTransaction = original;
      await change();
      return original(fn);
    });
    return () => { (db as unknown as { runTransaction: unknown }).runTransaction = original; };
  };
  const resetWs = () => db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'A', currency: 'USD', members: ['owner-1', 'book-1'], roles: { 'book-1': 'bookkeeper' } });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await resetWs();
    for (const [id, type] of [['bank', 'asset'], ['rent', 'expense']]) await db.collection('chartAccounts').doc(`${ws}_${id}`).set({ workspaceId: ws, name: id, code: id, type });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['transactions', 'chartAccounts', 'idempotencyKeys', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('a bookkeeper may post', async () => {
    assert.equal((await post('book-1', 'ok1')).status, 200);
    assert.ok(await exists('ok1'));
  });

  test('role downgraded to viewer after the first check: refused, nothing written', async () => {
    const undo = between(() => db.collection('workspaces').doc(ws).set({ roles: { 'book-1': 'viewer' } }, { merge: true }));
    try {
      const r = await post('book-1', 'downgraded');
      assert.equal(r.status, 403, JSON.stringify(r.body));
      assert.equal(await exists('downgraded'), false);
    } finally { undo(); await resetWs(); }
  });

  test('removed from the books after the first check: refused, nothing written', async () => {
    const undo = between(() => db.collection('workspaces').doc(ws).set({ members: ['owner-1'], roles: {} }, { merge: true }));
    try {
      const r = await post('book-1', 'removed');
      assert.equal(r.status, 403, JSON.stringify(r.body));
      assert.equal(await exists('removed'), false);
    } finally { undo(); await resetWs(); }
  });

  test('month closed after the first check: refused, nothing written', async () => {
    const undo = between(() => db.collection('workspaces').doc(ws).set({ lockDate: '2026-12-31' }, { merge: true }));
    try {
      const r = await post('book-1', 'closed');
      assert.notEqual(r.status, 200, JSON.stringify(r.body));
      assert.equal(await exists('closed'), false);
    } finally { undo(); await resetWs(); }
  });

  test('two writers at once both succeed (no needless refusals)', async () => {
    const [a, b] = await Promise.all([post('owner-1', 'c1'), post('book-1', 'c2')]);
    assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
    assert.ok(await exists('c1') && await exists('c2'));
  });
});
