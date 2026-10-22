/**
 * Recategorize (D-3 / K-39 rule actions): the non-bank side of bank entries moves to another
 * account of the workspace; amounts and the bank lines stay; to a bank account makes a transfer,
 * away from one clears it; writers only; all entries or none; another workspace's account refused;
 * the period lock and expectedUpdatedAt apply. Also: /batch now refuses viewers. Database part runs
 * when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { recategorizedLines } from '../server/services/recategorizeService';
import type { Firestore } from '../server/db/pgFirestore';

describe('Moving the non-bank side', () => {
  test('only lines off the bank account move; the transfer mark follows the target', () => {
    const entry = { lines: [{ accountId: 'bank', accountName: 'Checking', amountCents: -500 }, { accountId: 'misc', accountName: 'Misc', amountCents: 500, isTransfer: true }] };
    assert.deepEqual(recategorizedLines(entry as never, 'bank', { id: 'rent', name: 'Rent' }, false), [
      { accountId: 'bank', accountName: 'Checking', amountCents: -500 },
      { accountId: 'rent', accountName: 'Rent', amountCents: 500 },
    ]);
    assert.equal((recategorizedLines(entry as never, 'bank', { id: 'sav', name: 'Savings' }, true)[1] as { isTransfer?: boolean }).isTransfer, true);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Recategorize through the server (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_recat_${crypto.randomBytes(4).toString('hex')}`;
  const other = `${ws}x`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = async (uid: string, path: string, body: unknown) => {
    const res = await fetch(`${base}/api/v1/transactions${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const entry = async (name: string) => (await db.collection('transactions').doc(id(name)).get()).data() as Record<string, unknown> & { lines: Array<{ accountId: string; amountCents: number; isTransfer?: boolean }> };
  const change = (name: string, to: string, extra: Record<string, unknown> = {}) => ({ id: id(name), bankAccountId: id('bank'), toAccountId: to.startsWith(ws) ? to : id(to), ...extra });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'R', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' }, lockDate: '2026-01-31' });
    const acct = (name: string, data: Record<string, unknown>, workspaceId = ws) => db.collection('chartAccounts').doc(workspaceId === ws ? id(name) : `${other}_${name}`).set({ workspaceId, name, code: name, ...data });
    await acct('bank', { type: 'asset', category: 'Cash' });
    await acct('savings', { type: 'asset', category: 'Bank' });
    await acct('misc', { type: 'expense' });
    await acct('rent', { type: 'expense' });
    await acct('old', { type: 'expense', isArchived: true });
    await acct('theirs', { type: 'expense' }, other);
    const tx = (name: string, date: string, extra: Record<string, unknown> = {}) => db.collection('transactions').doc(id(name)).set({
      workspaceId: ws, date, description: name, status: 'completed', totalAmountCents: 500, currency: 'USD', updatedAt: '2026-05-01T00:00:00.000Z',
      lines: [{ accountId: id('bank'), accountName: 'bank', amountCents: -500 }, { accountId: id('misc'), accountName: 'misc', amountCents: 500 }], ...extra,
    });
    await tx('a', '2026-05-02');
    await tx('b', '2026-05-03');
    await tx('closed', '2026-01-15');
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
    for (const table of ['transactions', 'chartAccounts', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]);
    await db.terminate();
  });

  test('writers only, here and on /batch', async () => {
    assert.equal((await call('view-1', '/recategorize', { workspaceId: ws, changes: [change('a', 'rent')] })).status, 403);
    assert.equal((await call('view-1', '/batch', { workspaceId: ws, updates: [{ id: id('a'), data: { description: 'x' } }] })).status, 403);
    assert.equal((await entry('a')).description, 'a');
  });

  test('refused, and nothing changes: another workspace\'s account, an archived one, a closed period, a stale copy', async () => {
    const theirs = await call('book-1', '/recategorize', { workspaceId: ws, changes: [change('a', 'rent'), { ...change('b', 'x'), toAccountId: `${other}_theirs` }] });
    assert.deepEqual([theirs.status, theirs.body.entryId], [400, id('b')]);
    assert.equal((await entry('a')).lines[1].accountId, id('misc'), 'all or none: a did not move either');
    assert.equal((await call('book-1', '/recategorize', { workspaceId: ws, changes: [change('a', 'old')] })).status, 400);
    assert.equal((await call('book-1', '/recategorize', { workspaceId: ws, changes: [change('closed', 'rent')] })).status, 409);
    assert.equal((await call('book-1', '/recategorize', { workspaceId: ws, changes: [change('a', 'rent', { expectedUpdatedAt: '2026-04-01T00:00:00.000Z' })] })).status, 409);
    assert.equal((await call('book-1', '/recategorize', { workspaceId: ws, changes: [{ ...change('a', 'rent'), bankAccountId: id('misc') }] })).status, 400, 'the bank side must be a bank account');
  });

  test('moves the non-bank side, amounts kept; to a bank account it becomes a transfer, and back again clears it', async () => {
    const ok = await call('book-1', '/recategorize', { workspaceId: ws, changes: [change('a', 'rent', { expectedUpdatedAt: '2026-05-01T00:00:00.000Z' }), change('b', 'savings')] });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.changed, 2);
    const a = await entry('a');
    assert.deepEqual(a.lines.map(l => [l.accountId, l.amountCents]), [[id('bank'), -500], [id('rent'), 500]]);
    assert.equal(a.isTransfer, undefined);
    const b = await entry('b');
    assert.equal(b.isTransfer, true);
    assert.deepEqual(b.transferDetails, { fromAccountId: id('bank'), toAccountId: id('savings') });
    assert.equal((await call('owner-1', '/recategorize', { workspaceId: ws, changes: [change('b', 'rent')] })).status, 200);
    const back = await entry('b');
    assert.deepEqual([back.isTransfer, back.transferDetails, back.lines[1].isTransfer], [undefined, undefined, undefined]);
    // an older entry marked as a transfer in its metadata: the marker goes too, the rest of its metadata stays
    await db.collection('transactions').doc(id('b')).update({ metadata: { isTransfer: true, source: 'bank-feed' } });
    assert.equal((await call('owner-1', '/recategorize', { workspaceId: ws, changes: [change('b', 'rent')] })).status, 200);
    assert.deepEqual((await entry('b')).metadata, { source: 'bank-feed' });
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data()).filter(l => l.action === 'TRANSACTIONS_RECATEGORIZED');
    assert.equal(audit.length, 3);
  });
});
