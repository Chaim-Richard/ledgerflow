/**
 * ETags on the API (Z-05): a list read carries an ETag and the same read with If-None-Match is a 304
 * (nothing sent again); an update sent with If-Match (an entry's ETag is its updatedAt in quotes) is
 * refused with 412 when the entry changed since, and goes through when it did not.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import type { Server } from 'node:http';
import { ifMatchVersion } from '../server/routes/transactions/helpers';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

test('If-Match: quotes and a weak prefix are taken off; "*" checks nothing', () => {
  assert.equal(ifMatchVersion('"2026-10-07T10:00:00.000Z"'), '2026-10-07T10:00:00.000Z');
  assert.equal(ifMatchVersion('W/"2026-10-07T10:00:00.000Z"'), '2026-10-07T10:00:00.000Z');
  assert.equal(ifMatchVersion('*'), undefined);
  assert.equal(ifMatchVersion(undefined), undefined);
});

describe('ETags on transactions (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_etag_${crypto.randomBytes(4).toString('hex')}`;
  const txId = `${ws}_t1`;
  let db: Firestore;
  let server: Server;
  let base = '';

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'ETag Co', currency: 'USD', members: ['owner-1'] });
    await db.collection('transactions').doc(txId).set({
      workspaceId: ws, uid: 'owner-1', date: '2026-10-01', description: 'Coffee', status: 'completed', totalAmountCents: 500, currency: 'USD',
      lines: [{ accountId: 'a', amountCents: 500 }, { accountId: 'b', amountCents: -500 }], updatedAt: '2026-10-07T10:00:00.000Z',
    });
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: 'owner-1' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('a list read has an ETag; asking again with it is a 304', async () => {
    const first = await fetch(`${base}/api/v1/transactions?workspaceId=${ws}`);
    assert.equal(first.status, 200);
    const etag = first.headers.get('etag');
    assert.ok(etag);
    // plain http: fetch adds "Cache-Control: no-cache" to conditional requests, which always asks for a fresh copy
    const status = await new Promise<number>((resolve, reject) => {
      http.get(`${base}/api/v1/transactions?workspaceId=${ws}`, { headers: { 'If-None-Match': String(etag) } }, res => { res.resume(); resolve(res.statusCode || 0); }).on('error', reject);
    });
    assert.equal(status, 304);
  });

  test('an update with a stale If-Match is refused with 412; with the current one it goes through', async () => {
    const put = (ifMatch: string) => fetch(`${base}/api/v1/transactions/${txId}`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'If-Match': ifMatch }, body: JSON.stringify({ partialUpdate: { memo: 'Team coffee' } }),
    });
    const stale = await put('"2026-10-06T09:00:00.000Z"');
    assert.equal(stale.status, 412);
    assert.equal(((await stale.json()) as { error: string }).error, 'version_conflict');
    assert.equal((await db.collection('transactions').doc(txId).get()).data()?.memo, undefined);
    assert.equal((await put('"2026-10-07T10:00:00.000Z"')).status, 200);
    assert.equal((await db.collection('transactions').doc(txId).get()).data()?.memo, 'Team coffee');
  });
});
