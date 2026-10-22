/**
 * Approval events (S-09): an invoice that starts waiting for approval tells the owners and
 * accountants; approving or sending it back tells the people who keep the books (with the note),
 * once each and never the person who did it. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { approvalEvent } from '../server/services/approvalNotifications';

describe('Which approval event a save is', () => {
  const awaiting = { state: 'awaiting' as const, thresholdCents: 100, requestedAt: 't1' };
  test('newly waiting, approved or sent back; nothing when unchanged or without a record', () => {
    assert.equal(approvalEvent(undefined, awaiting), 'requested');
    assert.equal(approvalEvent(awaiting, awaiting), null);
    assert.equal(approvalEvent(awaiting, { state: 'approved', thresholdCents: 100, decidedAt: 't2' }), 'approved');
    assert.equal(approvalEvent(awaiting, { state: 'rejected', thresholdCents: 100, decidedAt: 't2', note: 'wrong price' }), 'rejected');
    assert.equal(approvalEvent({ state: 'approved', thresholdCents: 100, decidedAt: 't2' }, { state: 'approved', thresholdCents: 100, decidedAt: 't2' }), null);
    assert.equal(approvalEvent({ state: 'rejected', thresholdCents: 100, decidedAt: 't2' }, { ...awaiting, requestedAt: 't3' }), 'requested', 'asked again after being sent back');
    assert.equal(approvalEvent(awaiting, undefined), null);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Approval notifications (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_approve_${crypto.randomBytes(4).toString('hex')}`;
  const inv = `${ws}_inv`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const save = async (uid: string, data: Record<string, unknown>) => {
    // the invoice is saved as the screen saves it: the document alone, its entries built by the server (L94-STEP2B)
    const res = await fetch(`${base}/api/v1/documents/invoices/${inv}/post`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid },
      body: JSON.stringify({ workspaceId: ws, action: 'update', data }),
    });
    return res.status;
  };
  const told = async (kind: string) => (await db.pool.query(
    `select data->>'uid' as uid, data->>'title' as title, data->>'message' as message from public.notifications where workspace_id = $1 and data->>'kind' = $2 order by 1`, [ws, kind])).rows;

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Approve Co', currency: 'USD', members: ['owner-1', 'acct-1', 'book-1'],
      roles: { 'acct-1': 'accountant', 'book-1': 'bookkeeper' }, invoiceApproval: { enabled: true, thresholdCents: 100000 } });
    for (const [id, name, type, category] of [['ar', 'Accounts Receivable', 'asset', 'Receivables'], ['sales', 'Sales', 'income', 'Revenue'], ['bank', 'Bank', 'asset', 'Cash']]) {
      await db.collection('chartAccounts').doc(`${ws}_${id}`).set({ workspaceId: ws, name, type, category });
    }
    await db.collection('invoices').doc(inv).set({ workspaceId: ws, uid: 'book-1', number: 'INV-50', customerName: 'Acme', status: 'draft', date: '2026-10-01', dueDate: '2026-10-31', amountCents: 250000, currency: 'USD' });
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
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
    for (const table of ['invoices', 'transactions', 'chartAccounts', 'idempotencyKeys', 'notifications', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('a bookkeeper issues an invoice over the limit: the owner and the accountant are asked', async () => {
    assert.equal(await save('book-1', { status: 'pending' }), 200);
    assert.equal((await db.collection('invoices').doc(inv).get()).data()?.approval?.state, 'awaiting');
    assert.deepEqual((await told('approval.requested')).map(r => r.uid), ['acct-1', 'owner-1']);
    assert.equal((await told('approval.requested'))[0].message, 'Invoice INV-50 for Acme ($2,500.00) is over the approval limit and is not sent until an owner or accountant approves it.');
    assert.equal(await save('book-1', { notes: 'nothing about approval' }), 200);
    assert.equal((await told('approval.requested')).length, 2, 'not asked twice');
  });

  test('the accountant sends it back with a note: the owner and the bookkeeper are told', async () => {
    assert.equal(await save('acct-1', { approval: { state: 'rejected', thresholdCents: 100000, note: 'Wrong price on line 2' } }), 200);
    const rows = await told('approval.decided');
    assert.deepEqual(rows.map(r => r.uid), ['book-1', 'owner-1']);
    assert.equal(rows[0].title, 'Invoice INV-50 was sent back');
    assert.equal(rows[0].message, 'Invoice INV-50 for Acme ($2,500.00) needs changes before it can be sent: "Wrong price on line 2".');
  });
});
