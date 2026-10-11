/**
 * Watching a record (BG-04): anyone in the workspace watches a record of it (once); the nightly job
 * tells the watcher when it changed since they were last told, opening the record, and when it was
 * deleted (the watch then ends); nothing when it did not change.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { recordFromNotice, watchNoticeRecordId, type Watch } from '../lib/watches';
import WatchingPanel from '../components/collaboration/WatchingPanel';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useUIStore } from '../stores/useUIStore';

describe('The notice link', () => {
  test('a change notice carries "<type>/<id>" and opens that record; other notices do not', () => {
    assert.equal(watchNoticeRecordId({ type: 'invoice', id: 'a/b' }), 'invoice/a/b');
    assert.deepEqual(recordFromNotice('record.changed', 'invoice/a/b'), { type: 'invoice', id: 'a/b' });
    assert.equal(recordFromNotice('invoice.viewed', 'invoice/x'), null);
    assert.equal(recordFromNotice('record.changed', 'payroll/x'), null);
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_watch_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  let runWatches: typeof import('../server/services/watchService').runWatches;
  const call = async (uid: string, method: string, path = '', body?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/tasks/watching${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const notices = async () => (await db.pool.query<{ uid: string; title: string; recordId: string; linkTab: string }>(
    `select data->>'uid' as uid, data->>'title' as title, data->>'recordId' as "recordId", data->>'linkTab' as "linkTab" from public.notifications where workspace_id = $1 and data->>'kind' = 'record.changed' order by data->>'createdAt'`, [ws])).rows;
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    ({ runWatches } = await import('../server/services/watchService'));
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Watch', currency: 'USD', members: ['owner-1', 'view-1'], roles: { 'view-1': 'viewer' } });
    await db.collection('invoices').doc(`${ws}_inv`).set({ workspaceId: ws, number: 'INV-7', amountCents: 1000, status: 'pending' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['documents', 'invoices', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('watch once; told after a change, opening the record; nothing when unchanged; told when deleted and the watch ends', async () => {
    const record = { type: 'invoice', id: `${ws}_inv`, label: 'Invoice INV-7' };
    assert.equal((await call('view-1', 'POST', '', { record: { ...record, id: 'nope' } })).status, 404);
    assert.equal((await call('view-1', 'POST', '', { record: { ...record, type: 'payroll' } })).status, 400);
    const first = await call('view-1', 'POST', '', { record });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(((await call('view-1', 'POST', '', { record })).body.watch as Watch).id, (first.body.watch as Watch).id, 'once');
    assert.equal(((await call('view-1', 'GET')).body.watches as Watch[]).length, 1);
    assert.equal(((await call('owner-1', 'GET')).body.watches as Watch[]).length, 0, 'each person their own');

    await runWatches(db);
    assert.equal((await notices()).length, 0, 'not changed: nothing');
    await new Promise(r => setTimeout(r, 20));
    await db.collection('invoices').doc(`${ws}_inv`).update({ status: 'paid' });
    await runWatches(db);
    assert.deepEqual((await notices()).map(n => [n.uid, n.title, n.recordId, n.linkTab]), [['view-1', 'Invoice INV-7 changed', `invoice/${ws}_inv`, 'sales']]);
    await runWatches(db);
    assert.equal((await notices()).length, 1, 'told once per change');

    await db.collection('invoices').doc(`${ws}_inv`).delete();
    await runWatches(db);
    assert.equal((await notices()).at(-1)?.title, 'Invoice INV-7 was deleted');
    assert.equal(((await call('view-1', 'GET')).body.watches as Watch[]).length, 0, 'the watch ended');
  });
});

describe('On screen', () => {
  afterEach(() => cleanup());

  test('the records I watch open from the list; stop watching one', async () => {
    setComponentWorkspace('viewer');
    const watch: Watch = { id: 'w1', kind: 'watch', workspaceId: 'w', watcher: 'me', record: { type: 'bill', id: 'b1', label: 'Bill B-9' }, createdAt: '2026-10-10T00:00:00Z', seenAt: '2026-10-10T00:00:00Z' };
    const deleted: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') { deleted.push(String(input)); return new Response('{"status":"success"}', { status: 200 }); }
      return new Response(JSON.stringify({ status: 'success', watches: [watch] }), { status: 200 });
    }) as typeof fetch;
    render(<WatchingPanel />);
    await waitFor(() => assert.ok(screen.getByText(/Records I watch \(1\)/)));
    fireEvent.click(screen.getByRole('button', { name: 'Bill B-9' }));
    assert.deepEqual(useUIStore.getState().focusRecord, { type: 'bill', id: 'b1' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop watching Bill B-9' })); });
    assert.match(deleted[0], /\/tasks\/watching\/w1$/);
    await waitFor(() => assert.ok(screen.getByText('You are not watching anything.')));
  });
});
