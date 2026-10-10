/**
 * Time (V-01, V-03..V-06): durations, the rate that applies (entry, project, customer, person), the
 * value in whole cents, invoice lines from approved billable time; on the server who logs, sees,
 * submits, approves, sends back, keeps rates and marks time invoiced; on screen, logging and
 * submitting, and approving.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { entryValueCents, invoiceLinesFromTime, parseDuration, rateFor, timeProblem, type TimeEntry } from '../lib/timeEntries';
import TimeView from '../components/collaboration/TimeView';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { makeCustomer } from './fixtures';

const entry = (fields: Partial<TimeEntry>): TimeEntry => ({ id: 'e', kind: 'timeEntry', workspaceId: 'w', person: 'p1', date: '2026-10-05', minutes: 90, description: 'Design', billable: true, customerId: 'c1', status: 'approved', createdAt: '2026-10-05T10:00:00Z', ...fields });

describe('The rules', () => {
  test('durations', () => {
    assert.deepEqual(['1:30', '1.5', '1,5', '90m', '2h', '0:00', '25', '1:75', 'x'].map(parseDuration), [90, 90, 90, 90, 120, null, null, null, null]);
  });

  test('the rate: the entry\'s own, else the project\'s, the customer\'s, the person\'s; the value in whole cents', () => {
    const rates = { projects: { pr1: 15000 }, customers: { c1: 12000 }, people: { p1: 9000 } };
    assert.equal(rateFor(entry({ rateCents: 20000, projectId: 'pr1' }), rates), 20000);
    assert.equal(rateFor(entry({ projectId: 'pr1' }), rates), 15000);
    assert.equal(rateFor(entry({}), rates), 12000);
    assert.equal(rateFor(entry({ customerId: 'c2' }), rates), 9000);
    assert.equal(rateFor(entry({ customerId: 'c2', person: 'p2' }), rates), 0);
    assert.equal(entryValueCents(entry({ minutes: 50, rateCents: 10001 }), {}), 8334, '50/60 × 100.01 = 83.3416…');
  });

  test('what an entry needs; invoice lines from approved billable time only, oldest first', () => {
    assert.equal(timeProblem({ date: '2026-10-05', minutes: 30, description: 'Call', billable: false }), null);
    assert.match(String(timeProblem({ date: '2026-10-05', minutes: 30, description: 'Call', billable: true })), /customer/);
    assert.match(String(timeProblem({ date: '2026-10-05', minutes: 0, description: 'Call' })), /How long/);
    const lines = invoiceLinesFromTime([
      entry({ id: 'b', date: '2026-10-06', minutes: 45 }), entry({ id: 'a', minutes: 90 }),
      entry({ id: 'c', status: 'submitted' }), entry({ id: 'd', billable: false }), entry({ id: 'e2', invoiceId: 'inv' }),
    ], { customers: { c1: 10000 } });
    assert.deepEqual(lines.map(l => [l.id, l.quantity, l.rateCents, l.amountCents]), [['time-a', 1.5, 10000, 15000], ['time-b', 0.75, 10000, 7500]]);
    assert.equal(lines[0].description, '2026-10-05 · Design (1:30 h)');
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_time_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const call = async (uid: string, method: string, path = '', body?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/time${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Time', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    await db.collection('invoices').doc(`${ws}_inv`).set({ workspaceId: ws, number: 'INV-1', status: 'draft', amountCents: 0 });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['documents', 'invoices', 'auditLogs', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('log, see, submit, send back, approve, lock, rates, invoiced', async () => {
    const work = { date: '2026-10-05', minutes: 90, description: 'Design', billable: true, customerId: 'c1' };
    const mine = await call('view-1', 'POST', '', work);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    const id = (mine.body.entry as TimeEntry).id;
    assert.equal((await call('book-1', 'POST', '', { ...work, person: 'view-1' })).status, 403, 'only approvers log for others');
    assert.equal((await call('owner-1', 'POST', '', { ...work, person: 'book-1', billable: false, customerId: undefined, description: 'Admin' })).status, 200);
    assert.equal(((await call('view-1', 'GET')).body.entries as TimeEntry[]).length, 1, 'each sees their own');
    const ownerView = (await call('owner-1', 'GET')).body;
    assert.equal((ownerView.entries as TimeEntry[]).length, 2);
    assert.equal((await call('view-1', 'GET')).body.rates, undefined, 'rates are for approvers');

    assert.equal((await call('book-1', 'POST', '/move', { entryIds: [id], to: 'submitted' })).status, 403, 'not theirs');
    assert.equal((await call('view-1', 'POST', '/move', { entryIds: [id], to: 'submitted' })).status, 200);
    assert.equal((await call('view-1', 'PATCH', `/${id}`, { minutes: 60 })).status, 403, 'submitted: no more changes by its person');
    assert.equal((await call('owner-1', 'POST', '/move', { entryIds: [id], to: 'open', note: 'Which project?' })).status, 200);
    const told = await db.pool.query(`select data->>'uid' as uid from public.notifications where workspace_id = $1 and data->>'kind' = 'time.decided'`, [ws]);
    assert.deepEqual(told.rows.map(r => r.uid), ['view-1']);
    assert.equal(((await call('view-1', 'PATCH', `/${id}`, { minutes: 60 })).body.entry as TimeEntry).minutes, 60);
    await call('view-1', 'POST', '/move', { entryIds: [id], to: 'submitted' });
    assert.equal((await call('view-1', 'POST', '/move', { entryIds: [id], to: 'approved' })).status, 409, 'not by its own person');
    assert.equal((await call('owner-1', 'POST', '/move', { entryIds: [id], to: 'approved' })).status, 200);

    assert.equal((await call('book-1', 'PUT', '/rates', { rates: { customers: { c1: 12000 } } })).status, 403);
    assert.equal((await call('owner-1', 'PUT', '/rates', { rates: { customers: { c1: -5 } } })).status, 400);
    assert.equal((await call('owner-1', 'PUT', '/rates', { rates: { customers: { c1: 12000 } } })).status, 200);
    assert.deepEqual((await call('owner-1', 'GET')).body.rates, { customers: { c1: 12000 } });

    assert.equal((await call('view-1', 'POST', '/invoiced', { entryIds: [id], invoiceId: `${ws}_inv` })).status, 403);
    assert.equal((await call('book-1', 'POST', '/invoiced', { entryIds: [id], invoiceId: 'nope' })).status, 404);
    assert.equal((await call('book-1', 'POST', '/invoiced', { entryIds: [id], invoiceId: `${ws}_inv` })).status, 200);
    assert.equal((await call('owner-1', 'DELETE', `/${id}`)).status, 403, 'invoiced time is locked');
    assert.equal((await call('book-1', 'POST', '/invoiced', { entryIds: [id], invoiceId: `${ws}_inv` })).status, 409, 'once');
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('log time and submit it; an owner approves what waits', async () => {
    setComponentWorkspace('owner');
    const me = useAuthStore.getState().user!.uid;
    useLedgerStore.setState({ customers: [makeCustomer({ id: 'c1', name: 'Acme Ltd' })], projects: [] });
    let entries: TimeEntry[] = [entry({ id: 'w1', person: 'someone', status: 'submitted', description: 'Fix the roof' })];
    const calls: Array<{ path: string; body: unknown }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (url.includes('/time')) {
        calls.push({ path: url.replace(/.*\/time/, ''), body });
        if (init?.method === 'POST' && url.endsWith('/time')) { const e = entry({ id: 'n1', person: me, status: 'open', ...body }); entries = [e, ...entries]; return new Response(JSON.stringify({ status: 'success', entry: e }), { status: 200 }); }
        if (url.endsWith('/move')) return new Response(JSON.stringify({ status: 'success', entries: entries.filter(e => body.entryIds.includes(e.id)).map(e => ({ ...e, status: body.to })) }), { status: 200 });
        return new Response(JSON.stringify({ status: 'success', entries, rates: {}, canApprove: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: 'success', tasks: [], people: [] }), { status: 200 });
    }) as typeof fetch;
    render(<TimeView />);
    await waitFor(() => assert.ok(screen.getByText('Waiting for approval (1)')));
    fireEvent.change(screen.getByLabelText('How long'), { target: { value: '1:15' } });
    fireEvent.change(screen.getByLabelText('What was done'), { target: { value: 'Call with Acme' } });
    assert.match(screen.getByRole('status').textContent || '', /customer/, 'billable needs a customer');
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'c1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Log it' })); });
    assert.deepEqual(calls.find(c => c.path === '' && c.body)?.body, { date: (calls.find(c => c.body)!.body as { date: string }).date, minutes: 75, description: 'Call with Acme', billable: true, customerId: 'c1' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit my time' })); });
    assert.deepEqual(calls.at(-1), { path: '/move', body: { entryIds: ['n1'], to: 'submitted' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Approve Fix the roof' })); });
    assert.deepEqual(calls.at(-1), { path: '/move', body: { entryIds: ['w1'], to: 'approved' } });
  });
});
