/**
 * Sparse fieldsets (Z-04): `?fields=` returns only the fields asked for (and always the id), one level
 * into an object as well; a bad field name or too many fields is a 400; no `fields` returns whole records.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { FieldsError, parseFields, pickFields } from '../server/http/sparseFields';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

test('fields: a list, one level into an object, the id always; bad names refused', () => {
  assert.equal(parseFields(undefined), null);
  assert.deepEqual(parseFields('date, description,date'), ['date', 'description']);
  assert.throws(() => parseFields('date,lines[0]'), FieldsError);
  assert.throws(() => parseFields(Array.from({ length: 51 }, (_, i) => `f${i}`).join(',')), FieldsError);
  const rows = [{ id: 't1', date: '2026-10-01', description: 'Coffee', metadata: { invoiceId: 'i1', other: 1 }, lines: [] }];
  assert.deepEqual(pickFields(rows, ['date', 'metadata.invoiceId', 'missing']), [{ id: 't1', date: '2026-10-01', metadata: { invoiceId: 'i1' } }]);
  assert.equal(pickFields(rows, null), rows);
});

describe('Sparse fieldsets on the transaction list (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_fields_${crypto.randomBytes(4).toString('hex')}`;
  let db: Firestore;
  let server: Server;
  let base = '';

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Fields Co', currency: 'USD', members: ['owner-1'] });
    await db.collection('transactions').doc(`${ws}_t1`).set({
      workspaceId: ws, uid: 'owner-1', date: '2026-10-01', description: 'Coffee', status: 'completed', totalAmountCents: 500, currency: 'USD',
      lines: [{ accountId: 'a', amountCents: 500 }, { accountId: 'b', amountCents: -500 }],
    });
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
    for (const table of ['transactions', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('?fields=date,totalAmountCents returns only those and the id; a bad name is a 400', async () => {
    const res = await fetch(`${base}/api/v1/transactions?workspaceId=${ws}&fields=date,totalAmountCents`);
    assert.equal(res.status, 200);
    assert.deepEqual(((await res.json()) as { transactions: unknown[] }).transactions, [{ id: `${ws}_t1`, date: '2026-10-01', totalAmountCents: 500 }]);
    assert.equal((await fetch(`${base}/api/v1/transactions?workspaceId=${ws}&fields=date;drop`)).status, 400);
    const whole = (await (await fetch(`${base}/api/v1/transactions?workspaceId=${ws}`)).json()) as { transactions: Array<Record<string, unknown>> };
    assert.ok(Array.isArray(whole.transactions[0].lines), 'without fields, whole records');
  });
});
