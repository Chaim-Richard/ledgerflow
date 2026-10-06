/**
 * Attachments (K-07): files kept with an invoice, a bill or a contact. The rules (size, the record
 * they belong to, who may remove) and, with the database, removing through the server: owners,
 * accountants and bookkeepers any file of the workspace, others only their own, never another
 * workspace's, with an audit line naming the file and the record. The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { MAX_ATTACHMENT_BYTES, attachmentProblem, attachmentRecord, attachmentsOf, formatBytes, mayRemoveAttachment } from '../lib/attachments';
import { attachSummary } from '../services/attachmentActions';

describe('The rules', () => {
  test('empty and too big files are refused, saying why', () => {
    assert.equal(attachmentProblem({ name: 'a.pdf', size: 0 }), 'a.pdf is empty');
    assert.match(attachmentProblem({ name: 'scan.jpg', size: MAX_ATTACHMENT_BYTES + 1 }) || '', /^scan\.jpg is 700 KB; the most is 700 KB/);
    assert.equal(attachmentProblem({ name: 'ok.pdf', size: MAX_ATTACHMENT_BYTES }), null);
    assert.deepEqual([formatBytes(512), formatBytes(48_000), formatBytes(1_250_000)], ['512 B', '48 KB', '1.3 MB']);
  });

  test('a file is saved with the record it belongs to, and listed only there, newest first', () => {
    const target = { collection: 'invoices' as const, id: 'inv1', label: 'Invoice INV-1' };
    const rec = attachmentRecord({ name: 'contract.pdf', size: 1200, type: 'application/pdf' }, 'data:application/pdf;base64,AA', target, { uid: 'u1', workspaceId: 'w1' }, '2026-10-06T10:00:00Z');
    assert.deepEqual([rec.linkedCollection, rec.linkedId, rec.linkedLabel, rec.uid, rec.workspaceId, rec.mimeType, rec.tags], ['invoices', 'inv1', 'Invoice INV-1', 'u1', 'w1', 'application/pdf', ['Attachment']]);
    const files = [
      { ...rec, id: 'a', createdAt: '2026-10-01' },
      { ...rec, id: 'b', createdAt: '2026-10-05' },
      { ...rec, id: 'c', linkedCollection: 'bills' as const },
      { ...rec, id: 'd', linkedId: 'inv2' },
    ];
    assert.deepEqual(attachmentsOf(files, target).map(f => f.id), ['b', 'a']);
  });

  test('who may remove: writers any file, others only their own', () => {
    assert.deepEqual(['owner', 'accountant', 'bookkeeper', 'viewer'].map(r => mayRemoveAttachment(r, 'me', { uid: 'someone' })), [true, true, true, false]);
    assert.equal(mayRemoveAttachment('viewer', 'me', { uid: 'me' }), true);
    assert.equal(mayRemoveAttachment(undefined, undefined, { uid: '' }), false);
  });

  test('the message says what was kept and what was not', () => {
    const saved = [{ id: 'a' }] as never[];
    assert.deepEqual(attachSummary({ saved, refused: [] }), { ok: true, message: '1 file attached' });
    assert.deepEqual(attachSummary({ saved, refused: [{ name: 'big.tif', reason: 'too big' }] }), { ok: false, message: '1 attached; not attached: big.tif: too big' });
    assert.deepEqual(attachSummary({ saved: [], refused: [{ name: 'x', reason: 'r' }] }), { ok: false, message: 'Not attached: x: r' });
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Removing a file (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_att_${crypto.randomBytes(4).toString('hex')}`;
  const other = `${ws}_other`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const remove = async (uid: string, fileId: string, workspace = ws) => {
    const res = await fetch(`${base}/api/v1/workspaces/${workspace}/attachments/${fileId}`, { method: 'DELETE', headers: { 'x-test-uid': uid } });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const exists = async (fileId: string) => (await db.collection('documents').doc(fileId).get()).exists;
  const file = (name: string, uid: string, workspaceId = ws) => db.collection('documents').doc(id(name)).set({
    workspaceId, uid, name: `${name}.pdf`, fileUrl: 'data:application/pdf;base64,AA', sizeBytes: 2, createdAt: '2026-10-06T00:00:00Z',
    linkedCollection: 'invoices', linkedId: 'inv-7', linkedLabel: 'Invoice INV-7',
  });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Files', currency: 'USD', members: ['owner-1', 'view-1', 'book-1'], roles: { 'view-1': 'viewer', 'book-1': 'bookkeeper' } });
    await db.collection('workspaces').doc(other).set({ uid: 'owner-2', name: 'Other', currency: 'USD', members: ['owner-2', 'view-1'], roles: { 'view-1': 'viewer' } });
    await file('by-owner', 'owner-1');
    await file('by-viewer', 'view-1');
    await file('by-owner-2', 'owner-1');
    await file('elsewhere', 'owner-2', other);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['documents', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]);
    }
    await db.terminate();
  });

  test('a viewer may remove their own file, not someone else\'s', async () => {
    const refused = await remove('view-1', id('by-owner'));
    assert.deepEqual([refused.status, refused.body.message], [403, 'Only the person who added it, or an owner, accountant or bookkeeper, can remove it']);
    assert.equal(await exists(id('by-owner')), true);
    assert.equal((await remove('view-1', id('by-viewer'))).status, 200);
    assert.equal(await exists(id('by-viewer')), false);
  });

  test('a bookkeeper removes any file of the workspace, with an audit line', async () => {
    assert.equal((await remove('book-1', id('by-owner'))).status, 200);
    assert.equal(await exists(id('by-owner')), false);
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data())
      .find(a => a.action === 'attachment.removed' && a.uid === 'book-1');
    assert.ok(audit, 'audited');
    assert.deepEqual([audit!.entityType, audit!.entityId, (audit!.details as { description: string }).description], ['invoices', 'inv-7', 'Removed the file "by-owner.pdf" from Invoice INV-7']);
  });

  test('another workspace\'s file is not found from here; a non-member is refused; twice is "not found"', async () => {
    assert.equal((await remove('owner-1', id('elsewhere'))).status, 404);
    assert.equal(await exists(id('elsewhere')), true);
    assert.equal((await remove('stranger', id('by-owner-2'))).status, 403);
    assert.equal((await remove('owner-1', id('by-owner-2'))).status, 200);
    assert.equal((await remove('owner-1', id('by-owner-2'))).status, 404);
  });
});
