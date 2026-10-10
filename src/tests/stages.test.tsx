/**
 * Custom status workflows (BG-06): the workspace's own stages for invoices and bills; owners and
 * accountants define them; owners, accountants and bookkeepers move a record between them; viewers
 * only read; a stage changes nothing else. On screen, the chip on a row and Settings → Stages.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { stagesProblem } from '../lib/stages';
import { StageChip } from '../components/collaboration/StageChip';
import { resetStages } from '../components/collaboration/stageStore';
import StagesSettings from '../components/platform/settings/StagesSettings';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';

test('what the stages need', () => {
  assert.equal(stagesProblem({ bill: ['Received', 'Checked', 'Ready to pay'], invoice: [] }), null);
  assert.match(String(stagesProblem({ bill: ['Checked', ' checked '] })), /twice/);
  assert.match(String(stagesProblem({ estimate: ['x'] })), /invoices and bills/);
  assert.match(String(stagesProblem({ bill: ['  '] })), /name/);
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_stage_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const call = async (uid: string, method: string, path = '', body?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/stages${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Stages', members: ['owner-1', 'acct-1', 'book-1', 'view-1'], roles: { 'acct-1': 'accountant', 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    await db.collection('bills').doc(`${ws}_b1`).set({ workspaceId: ws, number: 'B-1', status: 'open', amountCents: 1000 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['documents', 'bills', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('define, move, read, clear; each by the right people; the bill itself is untouched', async () => {
    assert.equal((await call('book-1', 'PUT', '/sets', { sets: { bill: ['Received', 'Checked'] } })).status, 403);
    assert.equal((await call('acct-1', 'PUT', '/sets', { sets: { bill: [' Received ', 'Checked'] } })).status, 200);
    assert.equal((await call('view-1', 'PUT', '', { kind: 'bill', id: `${ws}_b1`, stage: 'Checked' })).status, 403);
    assert.equal((await call('book-1', 'PUT', '', { kind: 'bill', id: `${ws}_b1`, stage: 'Paid?' })).status, 400);
    assert.equal((await call('book-1', 'PUT', '', { kind: 'bill', id: 'nope', stage: 'Checked' })).status, 404);
    assert.equal((await call('book-1', 'PUT', '', { kind: 'bill', id: `${ws}_b1`, stage: 'Checked' })).status, 200);
    const read = (await call('view-1', 'GET', '?kind=bill')).body;
    assert.deepEqual([read.stages, read.current], [['Received', 'Checked'], { [`${ws}_b1`]: 'Checked' }]);
    assert.equal((await db.collection('bills').doc(`${ws}_b1`).get()).data()?.status, 'open', 'the bill is untouched');
    assert.equal((await call('book-1', 'PUT', '', { kind: 'bill', id: `${ws}_b1`, stage: '' })).status, 200);
    assert.deepEqual((await call('view-1', 'GET', '?kind=bill')).body.current, {});
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); resetStages(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('a bookkeeper moves a bill to a stage from its row; a viewer sees the stage\'s name', async () => {
    setComponentWorkspace('bookkeeper');
    const puts: unknown[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') { puts.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ status: 'success', stage: 'Checked' }), { status: 200 }); }
      return new Response(JSON.stringify({ status: 'success', stages: ['Received', 'Checked'], current: { b2: 'Received' } }), { status: 200 });
    }) as typeof fetch;
    render(<><StageChip kind="bill" id="b1" label="bill B-1" /><StageChip kind="bill" id="b2" label="bill B-2" /></>);
    const chip = await screen.findByLabelText('Stage of bill B-1') as HTMLSelectElement;
    assert.equal(chip.value, '');
    assert.equal((screen.getByLabelText('Stage of bill B-2') as HTMLSelectElement).value, 'Received');
    await act(async () => { fireEvent.change(chip, { target: { value: 'Checked' } }); });
    assert.deepEqual(puts, [{ kind: 'bill', id: 'b1', stage: 'Checked' }]);
    await waitFor(() => assert.equal((screen.getByLabelText('Stage of bill B-1') as HTMLSelectElement).value, 'Checked'));
    cleanup(); resetStages();
    setComponentWorkspace('viewer');
    render(<StageChip kind="bill" id="b2" label="bill B-2" />);
    await waitFor(() => assert.ok(screen.getByText('Received')));
    assert.equal(screen.queryByRole('combobox'), null);
  });

  test('Settings → Stages: an accountant names the bill stages, one a line', async () => {
    setComponentWorkspace('accountant');
    const puts: unknown[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') { puts.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ status: 'success' }), { status: 200 }); }
      return new Response(JSON.stringify({ status: 'success', sets: {} }), { status: 200 });
    }) as typeof fetch;
    render(<StagesSettings />);
    const bills = await screen.findByLabelText(/^Bills/);
    fireEvent.change(bills, { target: { value: 'Received\n\nChecked\nReady to pay' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save stages' })); });
    assert.deepEqual(puts, [{ sets: { invoice: [], bill: ['Received', 'Checked', 'Ready to pay'] } }]);
  });
});
