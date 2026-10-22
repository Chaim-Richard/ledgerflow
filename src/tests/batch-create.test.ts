/**
 * Batch create (Z-03): several entries in one request, all or none. Each is checked as a single entry
 * is (balanced lines, the period lock, a unique id); one bad entry refuses the whole batch, named by
 * its index, and nothing is written; a batch counts in full against the plan's entry limit.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Batch create (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_batch_${crypto.randomBytes(4).toString('hex')}`;
  const acc = (n: string) => `${ws}_${n}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const entry = (date: string, cents: number, id?: string) => ({
    ...(id ? { id } : {}), date, description: `Sale ${cents}`, status: 'completed', currency: 'USD',
    lines: [{ accountId: acc('bank'), accountName: 'Bank', amountCents: cents }, { accountId: acc('sales'), accountName: 'Sales', amountCents: -cents }],
  });
  const send = async (transactions: unknown[]) => {
    const res = await fetch(`${base}/api/v1/transactions/batch-create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId: ws, transactions }) });
    return { status: res.status, body: await res.json() as { status: string; message?: string; data?: { created: number; ids: string[] } } };
  };
  const count = async () => (await db.collection('transactions').where('workspaceId', '==', ws).get()).size;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Batch Co', currency: 'USD', members: ['owner-1'], lockDate: '2026-06-30', plan: 'free' });
    const account = (n: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(acc(n)).set({ workspaceId: ws, uid: 'owner-1', balanceCents: 0, isActive: true, ...fields });
    await account('bank', { code: '1000', name: 'Bank', type: 'asset', category: 'Cash' });
    await account('sales', { code: '4000', name: 'Sales', type: 'income' });
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: 'owner-1' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('three entries are created together and their ids come back in order', async () => {
    const res = await send([entry('2026-10-01', 1_000, `${ws}_a`), entry('2026-10-02', 2_000, `${ws}_b`), entry('2026-10-03', 3_000)]);
    assert.equal(res.status, 200);
    assert.equal(res.body.data?.created, 3);
    assert.deepEqual(res.body.data?.ids.slice(0, 2), [`${ws}_a`, `${ws}_b`]);
    assert.equal(await count(), 3);
  });

  test('one bad entry refuses the whole batch, named by its index: unbalanced, in a closed month, an id used twice or already there', async () => {
    const unbalanced = { ...entry('2026-10-04', 500), lines: [{ accountId: acc('bank'), amountCents: 500 }, { accountId: acc('sales'), amountCents: -400 }] };
    const r1 = await send([entry('2026-10-04', 100), unbalanced]);
    assert.equal(r1.status, 400);
    assert.match(String(r1.body.message), /^Entry 1:/);
    const r2 = await send([entry('2026-10-04', 100), entry('2026-06-15', 100)]);
    assert.equal(r2.status, 409);
    assert.match(String(r2.body.message), /^Entry 1: Period Locked/);
    assert.match(String((await send([entry('2026-10-04', 100, `${ws}_z`), entry('2026-10-05', 100, `${ws}_z`)])).body.message), /used twice/);
    assert.equal((await send([entry('2026-10-04', 100, `${ws}_a`)])).status, 409);
    assert.equal(await count(), 3, 'nothing written by the refused batches');
  });

  test('a batch counts in full against the plan\'s entry limit', async () => {
    await db.collection('workspaces').doc(ws).update({ apiQuotaMonthlyLimitCents: 400 });
    const res = await send([entry('2026-10-06', 100), entry('2026-10-07', 100)]);
    assert.equal(res.status, 402, '3 + 2 is over a limit of 4');
    assert.equal((await send([entry('2026-10-06', 100)])).status, 200, '3 + 1 fits');
  });
});
