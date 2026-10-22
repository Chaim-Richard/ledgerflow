/**
 * What was deleted stays in the audit trail (CA-10): deleting an entry, or a draft document through
 * the posting route, leaves an audit line saying what it was ("Deleted the invoice INV-9 of …
 * (Acme, USD 50.00)") with a copy of its main fields and lines. The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { deletionSentence, deletionSnapshot } from '../server/services/deletionRecord';

describe('The record of a deletion', () => {
  test('a sentence and the main fields', () => {
    const invoice = { number: 'INV-9', date: '2026-10-01', customerName: 'Acme', amountCents: 5000, currency: 'usd', status: 'draft', paymentToken: 'secret', items: [{ description: 'Design', amountCents: 5000 }] };
    assert.equal(deletionSentence('invoices', 'i1', invoice), 'Deleted the invoice INV-9 of 2026-10-01 (Acme, USD 50.00)');
    assert.equal(deletionSentence('transactions', 't1', { description: 'Office rent', date: '2026-10-02', totalAmountCents: 120000 }), 'Deleted the entry Office rent of 2026-10-02 (1200.00)');
    const kept = deletionSnapshot(invoice);
    assert.deepEqual(Object.keys(kept).sort(), ['amountCents', 'currency', 'customerName', 'date', 'items', 'number', 'status']);
    assert.equal(deletionSnapshot({ lines: Array.from({ length: 150 }, (_, i) => i) }).lines && (deletionSnapshot({ lines: Array.from({ length: 150 }, (_, i) => i) }).lines as unknown[]).length, 100);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Deleting (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_del_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const audits = async () => (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data());

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Del', currency: 'USD', members: ['owner-1'] });
    await db.collection('transactions').doc(id('tx')).set({ workspaceId: ws, date: '2026-10-02', description: 'Office rent', totalAmountCents: 120000, status: 'draft', type: 'journal', lines: [{ accountId: 'rent', amountCents: 120000 }, { accountId: 'bank', amountCents: -120000 }] });
    await db.collection('invoices').doc(id('inv')).set({ workspaceId: ws, number: 'INV-9', date: '2026-10-01', customerName: 'Acme', amountCents: 5000, currency: 'USD', status: 'draft', items: [{ description: 'Design', amountCents: 5000 }] });
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
    for (const table of ['transactions', 'invoices', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('deleting a draft entry keeps what it was (posted ones can only be voided)', async () => {
    const res = await fetch(`${base}/api/v1/transactions/${id('tx')}?workspaceId=${ws}`, { method: 'DELETE', headers: { 'x-test-uid': 'owner-1' } });
    assert.equal(res.status, 200, await res.clone().text());
    const audit = (await audits()).find(a => a.action === 'TRANSACTION_DELETED')!;
    assert.equal((audit.details as { description: string }).description, 'Deleted the entry Office rent of 2026-10-02 (1200.00)');
    const kept = (audit.details as { deleted: { lines: unknown[]; totalAmountCents: number } }).deleted;
    assert.deepEqual([kept.lines.length, kept.totalAmountCents], [2, 120000]);
  });

  test('deleting a draft invoice through the posting route keeps what it was', async () => {
    // a document is deleted through the server's posting route (L94-STEP2B), which reverses its entries itself
    const res = await fetch(`${base}/api/v1/documents/invoices/${id('inv')}/post`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': 'owner-1' },
      body: JSON.stringify({ workspaceId: ws, action: 'delete' }),
    });
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal((await db.collection('invoices').doc(id('inv')).get()).exists, false);
    const audit = (await audits()).find(a => a.action === 'DOCUMENT_DELETED')!;
    assert.deepEqual([audit.entityType, audit.entityId, (audit.details as { description: string }).description], ['invoices', id('inv'), 'Deleted the invoice INV-9 of 2026-10-01 (Acme, USD 50.00)']);
  });
});
