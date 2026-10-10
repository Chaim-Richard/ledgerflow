/**
 * Tasks (BG-02 assign a record, BG-03 task list): what a task needs and the list's order; owners,
 * accountants and bookkeepers give tasks to anyone in the workspace; the person given it, whoever
 * made it and owners tick it done (whoever made it is told); whoever made it and owners remove it;
 * Tasks on screen; "N tasks for you" in Needs attention.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { isLate, sortTasks, taskProblem, type Task } from '../lib/tasks';
import { needsAttention } from '../lib/needsAttention';
import TasksView from '../components/collaboration/TasksView';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const task = (fields: Partial<Task>): Task => ({ id: 't', kind: 'task', workspaceId: 'w', title: 'Call Acme', assignee: 'u1', createdBy: 'u2', createdAt: '2026-10-01T00:00:00Z', status: 'open', ...fields });

describe('The rules', () => {
  test('what a task needs; open ones first by date asked, done ones after, newest first; late', () => {
    assert.equal(taskProblem({ title: 'Call Acme about INV-12', assignee: 'u1' }), null);
    assert.match(String(taskProblem({ title: 'x', assignee: 'u1' })), /Say what/);
    assert.match(String(taskProblem({ title: 'Call Acme' })), /who does it/);
    assert.match(String(taskProblem({ title: 'Call Acme', assignee: 'u1', due: '10/10/2026' })), /due date/);
    assert.match(String(taskProblem({ title: 'Call Acme', assignee: 'u1', record: { type: 'payroll', id: 'x', label: 'x' } })), /record/);
    assert.equal(taskProblem({ title: 'Call Acme', assignee: 'u1', record: { type: 'invoice', id: 'i1', label: 'Invoice INV-12' } }), null);
    const sorted = sortTasks([
      task({ id: 'done-old', status: 'done', doneAt: '2026-10-02' }), task({ id: 'no-date' }), task({ id: 'soon', due: '2026-10-05' }),
      task({ id: 'done-new', status: 'done', doneAt: '2026-10-09' }), task({ id: 'sooner', due: '2026-10-03' }),
    ]);
    assert.deepEqual(sorted.map(t => t.id), ['sooner', 'soon', 'no-date', 'done-new', 'done-old']);
    assert.equal(isLate(task({ due: '2026-10-09' }), '2026-10-10'), true);
    assert.equal(isLate(task({ due: '2026-10-09', status: 'done' }), '2026-10-10'), false);
  });

  test('Needs attention: the tasks for whoever is looking, with the late ones said', () => {
    const rows = needsAttention({ today: '2026-10-10', workspace: {}, myTasks: [{ status: 'open', due: '2026-10-01' }, { status: 'open' }] });
    const row = rows.find(r => r.id === 'tasks')!;
    assert.equal(row.text, '2 tasks for you');
    assert.match(row.why, /1 of them is past the date/);
    assert.deepEqual(row.page, { tab: 'tasks' });
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_tasks_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const call = async (uid: string, method: string, path = '', body?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/tasks${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const told = async (kind: string) => (await db.pool.query<{ uid: string }>(`select data->>'uid' as uid from public.notifications where workspace_id = $1 and data->>'kind' = $2`, [ws, kind])).rows.map(r => r.uid);
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Tasks', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    await db.collection('users').doc('book-1').set({ uid: 'book-1', email: 'book@example.test' }, { merge: true });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: `${req.header('x-test-uid')}@example.test` }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['documents', 'auditLogs', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.pool.query(`delete from public.users where id = 'book-1' and data->>'email' = 'book@example.test'`);
    await db.terminate();
  });

  test('give, tell, tick done, tell back, remove; each by the right people', async () => {
    const about = { type: 'invoice', id: 'inv-12', label: 'Invoice INV-12' };
    assert.equal((await call('view-1', 'POST', '', { title: 'Look at this', assignee: 'book-1' })).status, 403, 'viewers do not give tasks');
    assert.equal((await call('book-1', 'POST', '', { title: 'Call Acme', assignee: 'stranger' })).status, 400);
    const made = await call('book-1', 'POST', '', { title: 'Approve the Acme invoice', assignee: 'view-1', due: '2026-10-15', record: about });
    assert.equal(made.status, 200, JSON.stringify(made.body));
    const id = String((made.body.task as Task).id);
    const stored = (await db.collection('documents').doc(id).get()).data()!;
    assert.deepEqual([stored.kind, stored.assignee, stored.createdBy, stored.status, stored.uid, stored.record.label], ['task', 'view-1', 'book-1', 'open', undefined, 'Invoice INV-12']);
    assert.deepEqual(await told('task.assigned'), ['view-1'], 'only the person given it is told');

    const list = await call('view-1', 'GET');
    assert.equal((list.body.tasks as Task[]).length, 1);
    const people = list.body.people as Array<{ uid: string; role: string; email?: string }>;
    assert.deepEqual(people.map(p => p.uid).sort(), ['book-1', 'owner-1', 'view-1']);
    assert.equal(people.find(p => p.uid === 'book-1')?.email, 'book@example.test');

    const other = await call('owner-1', 'POST', '', { title: 'Check the VAT return', assignee: 'book-1' });
    const otherId = String((other.body.task as Task).id);
    assert.equal((await call('view-1', 'PATCH', `/${otherId}`, { status: 'done' })).status, 403, 'not theirs');
    assert.equal((await call('view-1', 'PATCH', `/${id}`, { status: 'finished' })).status, 400);
    const done = await call('view-1', 'PATCH', `/${id}`, { status: 'done' });
    assert.equal(done.status, 200);
    assert.deepEqual([(done.body.task as Task).status, (done.body.task as Task).doneBy], ['done', 'view-1']);
    assert.deepEqual(await told('task.done'), ['book-1'], 'whoever gave it is told');
    assert.equal(((await call('view-1', 'PATCH', `/${id}`, { status: 'open' })).body.task as Task).doneAt, undefined, 'open again');

    assert.equal((await call('view-1', 'DELETE', `/${id}`)).status, 403, 'only whoever made it, or an owner, removes it');
    assert.equal((await call('book-1', 'DELETE', `/${id}`)).status, 200);
    assert.equal((await call('owner-1', 'DELETE', `/${otherId}`)).status, 200);
    assert.equal(((await call('owner-1', 'GET')).body.tasks as Task[]).length, 0);
    const audit = await db.pool.query(`select data->>'action' as a from public."auditLogs" where workspace_id = $1 and data->>'action' like 'TASK_%' order by data->>'createdAt'`, [ws]);
    assert.deepEqual(audit.rows.map(r => r.a).sort(), ['TASK_CREATED', 'TASK_CREATED', 'TASK_DONE', 'TASK_REMOVED', 'TASK_REMOVED', 'TASK_REOPENED']);
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('my tasks, all open and done; give one about nothing in particular; tick mine done', async () => {
    const ws = setComponentWorkspace('bookkeeper');
    const me = useAuthStore.getState().user!.uid;
    let tasks: Task[] = [
      task({ id: 'a', title: 'Chase INV-12', assignee: me, createdBy: 'owner-x', createdByEmail: 'owner@example.test', due: '2020-01-01', record: { type: 'invoice', id: 'inv-12', label: 'Invoice INV-12' } }),
      task({ id: 'b', title: 'Owner signs the loan', assignee: 'owner-x', createdBy: me }),
    ];
    const posts: unknown[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes('/tasks')) return new Response('[]', { status: 200 });
      if (init?.method === 'POST') { posts.push(JSON.parse(String(init.body))); const t = task({ id: 'c', title: 'Ring the bank', assignee: me, createdBy: me }); tasks = [...tasks, t]; return new Response(JSON.stringify({ status: 'success', task: t }), { status: 200 }); }
      if (init?.method === 'PATCH') { const t = { ...tasks.find(x => url.endsWith(`/${x.id}`))!, status: 'done' as const, doneAt: '2026-10-10T10:00:00Z' }; return new Response(JSON.stringify({ status: 'success', task: t }), { status: 200 }); }
      return new Response(JSON.stringify({ status: 'success', tasks, people: [{ uid: me, role: 'bookkeeper' }, { uid: 'owner-x', role: 'owner', email: 'owner@example.test' }] }), { status: 200 });
    }) as typeof fetch;
    void ws;
    render(<TasksView />);
    await waitFor(() => assert.ok(screen.getByText('Chase INV-12', { selector: 'bdi' })));
    assert.equal(screen.queryByText('Owner signs the loan', { selector: 'bdi' }), null, 'For me shows only mine');
    assert.match(screen.getByText(/late, was due/).textContent || '', /late/);
    assert.ok(screen.getByRole('button', { name: 'Invoice INV-12' }));
    fireEvent.click(screen.getByRole('button', { name: /All open/ }));
    assert.ok(screen.getByText('Owner signs the loan', { selector: 'bdi' }));
    assert.match(screen.getByText('Owner signs the loan', { selector: 'bdi' }).closest('li')!.textContent || '', /For owner@example\.test · from you/);

    fireEvent.change(screen.getByLabelText('What is to be done'), { target: { value: 'Ring the bank' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Give the task' })); });
    assert.deepEqual(posts, [{ title: 'Ring the bank', assignee: me }]);
    fireEvent.click(screen.getByRole('button', { name: /For me/ }));
    const item = screen.getByText('Chase INV-12', { selector: 'bdi' }).closest('li')!;
    await act(async () => { fireEvent.click(within(item).getByRole('checkbox')); });
    await waitFor(() => assert.equal(screen.queryByText('Chase INV-12', { selector: 'bdi' }), null, 'done: off my list'));
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));
    assert.ok(screen.getByText('Chase INV-12', { selector: 'bdi' }));
  });
});
