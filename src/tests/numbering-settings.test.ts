/**
 * Document numbering settings (BA-07): the series in effect with a preview, changing prefix,
 * next number and digits, never onto a number already used, owners/accountants only, audited.
 * Needs LF_TEST_DATABASE_URL for the database part.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { formatDocumentNumber, highestUsed, resolveSeries } from '../server/services/numberingService';

const url = process.env.LF_TEST_DATABASE_URL;

test('series in effect: stored, then the workspace field, then older fields, then the default', () => {
  assert.deepEqual(resolveSeries('invoice', { prefix: 'A-', nextNumber: 7, padding: 2 }, undefined, '2026-10-05'), { prefix: 'A-', nextNumber: 7, padding: 2 });
  assert.deepEqual(resolveSeries('bill', undefined, { numberingSeries: { bill: { prefix: 'B/', nextNumber: 3 } } }, '2026-10-05'), { prefix: 'B/', nextNumber: 3, padding: 4 });
  assert.deepEqual(resolveSeries('estimate', undefined, { numberingSeries: { estimatePrefix: 'Q', estimateNextNumber: 9 } }, '2026-10-05'), { prefix: 'Q', nextNumber: 9, padding: 4 });
  assert.deepEqual(resolveSeries('invoice', undefined, {}, '2026-10-05'), { prefix: 'INV-2026-', nextNumber: 1, padding: 4 });
  assert.deepEqual(['creditNote', 'vendorCredit'].map(t => resolveSeries(t as 'creditNote', undefined, {}, '2026-10-05').prefix), ['CN-2026-', 'VC-2026-']);
  assert.equal(formatDocumentNumber({ prefix: 'INV-', nextNumber: 42, padding: 5 }), 'INV-00042');
  assert.equal(highestUsed(['INV-0007', 'INV-0012', 'INV-12a', 'X-0099', 7, null, 'INV-'], 'INV-'), 12);
});

describe('Numbering settings (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_num_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = (uid: string, method: string, path: string, body?: unknown) => fetch(`${base}/api/v1/workspaces/${ws}/numbering${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}),
  });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { numberingRouter } = await import('../server/routes/numberingRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner', name: 'Numbers', members: ['owner', 'book'], roles: { book: 'bookkeeper' } });
    for (const [i, number] of ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0009'].entries()) {
      await db.collection('invoices').doc(`${ws}_i${i}`).set({ workspaceId: ws, number, amountCents: 100 });
    }
    await db.collection('numberingSeries').doc(`${ws}_invoice`).set({ workspaceId: ws, type: 'invoice', prefix: 'INV-2026-', nextNumber: 10, padding: 4 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces/:workspaceId/numbering', numberingRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['invoices', 'numberingSeries', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('lists each series with the next number and the highest used', async () => {
    const res = await call('owner', 'GET', '/');
    assert.equal(res.status, 200);
    const { series } = await res.json();
    const invoice = series.find((s: { type: string }) => s.type === 'invoice');
    assert.deepEqual([invoice.next, invoice.highestUsed], ['INV-2026-0010', 9]);
    assert.equal(series.find((s: { type: string }) => s.type === 'bill').next, 'BIL-2026-0001');
    assert.deepEqual(series.map((s: { type: string }) => s.type), ['invoice', 'bill', 'estimate', 'creditNote', 'vendorCredit']);
    assert.equal(series.find((s: { type: string }) => s.type === 'creditNote').next, 'CN-2026-0001');
  });

  test('a number already used is refused; a new prefix starts fresh; a bookkeeper cannot change it', async () => {
    const used = await call('owner', 'PUT', '/invoice', { prefix: 'INV-2026-', nextNumber: 9, padding: 4 });
    assert.equal(used.status, 400);
    assert.match((await used.json()).message, /INV-2026-0009 is already used: start at 10 or higher/);
    assert.equal((await call('book', 'PUT', '/invoice', { prefix: 'F', nextNumber: 1, padding: 3 })).status, 403);
    assert.equal((await call('owner', 'PUT', '/invoice', { prefix: 'F<script>', nextNumber: 1, padding: 3 })).status, 400);
    assert.equal((await call('owner', 'PUT', '/receipt', { prefix: 'R', nextNumber: 1, padding: 3 })).status, 400);
    const fresh = await call('owner', 'PUT', '/invoice', { prefix: 'F2027/', nextNumber: 1, padding: 3 });
    assert.equal(fresh.status, 200, await fresh.clone().text());
    assert.equal((await fresh.json()).series.next, 'F2027/001');
    const { allocateNextNumber } = await import('../server/services/numberingService');
    assert.equal(await allocateNextNumber(db as never, ws, 'invoice'), 'F2027/001');
    assert.equal(await allocateNextNumber(db as never, ws, 'invoice'), 'F2027/002');
    assert.equal(await allocateNextNumber(db as never, ws, 'vendorCredit', '2026-10-05'), 'VC-2026-0001');
    assert.equal(await allocateNextNumber(db as never, ws, 'vendorCredit', '2026-10-05'), 'VC-2026-0002');
    const audit = await db.collection('auditLogs').where('workspaceId', '==', ws).get();
    assert.ok(audit.docs.some(d => d.data().action === 'NUMBERING_CHANGED'));
  });
});
