/**
 * Document PDFs through the real router (GET /api/v1/documents/:type/:id/pdf) and database.
 * Express passes `next` as the handler's third argument; the handler took it for the database,
 * so every download failed with a 500 (only direct calls with a mock database were tested).
 * Runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

describe('Document PDF downloads', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const ws = `ws_pdf_${suffix}`;
  const other = `ws_pdf_other_${suffix}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;

  const download = (uid: string, type: string, docId: string, workspaceId = ws) =>
    fetch(`${base}/api/v1/documents/${type}/${docId}/pdf?workspaceId=${workspaceId}`, { headers: { 'x-test-uid': uid } });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { documentRouter } = await import('../server/routes/documentRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'PDF Books', currency: 'USD', members: ['owner-1', 'view-1'], roles: { 'view-1': 'viewer' } });
    await db.collection('workspaces').doc(other).set({ uid: 'owner-2', name: 'Other', currency: 'USD', members: ['owner-2'] });
    await db.collection('customers').doc(id('c1')).set({ workspaceId: ws, name: 'Acme Ltd' });
    await db.collection('invoices').doc(id('inv')).set({
      workspaceId: ws, customerId: id('c1'), customerName: 'Acme Ltd', number: 'INV-0007', date: '2026-06-01', status: 'sent',
      amountCents: 12500, items: [{ description: 'Consulting', quantity: 1, amountCents: 12500 }],
    });
    await db.collection('estimates').doc(id('est')).set({
      workspaceId: ws, customerId: id('c1'), number: 'EST-0003', date: '2026-06-02', status: 'sent', amountCents: 4000,
      lines: [{ description: 'Site survey', quantity: 2, unitPriceCents: 2000, amountCents: 4000 }],
    });
    await db.collection('invoices').doc(`${other}_inv`).set({ workspaceId: other, customerId: 'x', number: 'X-1', date: '2026-06-01', status: 'sent', amountCents: 100 });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/documents', documentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['invoices', 'estimates', 'customers', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]);
    }
    await db.terminate();
  });

  test('an invoice downloads as a PDF', async () => {
    const res = await download('owner-1', 'invoice', id('inv'));
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1');
    assert.ok(pdf.startsWith('%PDF-'));
    assert.match(pdf, /INV-0007/);
    assert.match(pdf, /Consulting/);
  });

  test("an estimate's PDF lists its lines (estimates keep `lines`, not `items`)", async () => {
    const res = await download('view-1', 'estimate', id('est'));
    assert.equal(res.status, 200);
    const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1');
    assert.match(pdf, /Site survey/);
    assert.doesNotMatch(pdf, /Standard Ledger Transaction/);
  });

  test('a customer statement downloads with its invoices', async () => {
    const res = await download('owner-1', 'statement', id('c1'));
    assert.equal(res.status, 200);
    const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1');
    assert.match(pdf, /2026-06-01 Invoice INV-0007/);
  });

  test("another workspace's document answers like a missing one; strangers are refused", async () => {
    assert.equal((await download('owner-1', 'invoice', `${other}_inv`)).status, 404);
    assert.equal((await download('owner-1', 'invoice', id('nope'))).status, 404);
    assert.equal((await download('stranger', 'invoice', id('inv'))).status, 403);
    assert.equal((await download('owner-1', 'bogus', id('inv'))).status, 400);
  });
});
