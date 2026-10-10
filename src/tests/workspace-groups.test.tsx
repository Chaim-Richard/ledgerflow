/**
 * Groups of books (DA-01): a person groups the workspaces they can open. Only workspaces they can
 * open are added or shown (one they lose access to stays invisible, and is kept unseen when the group
 * changes); nobody else reads or changes their groups; a group changes nothing in its workspaces;
 * their data export lists the groups. The database part runs when LF_TEST_DATABASE_URL is set.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { groupProblem, groupsOf, keptRatesProblem, shareOf, structureProblem } from '../lib/workspaceGroups';
import GroupsSettings from '../components/platform/settings/GroupsSettings';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

describe('The rules', () => {
  test('a group needs a name of 80 characters at most and each workspace once', () => {
    assert.equal(groupProblem({ name: 'Holding', workspaceIds: ['a', 'b'] }), null);
    assert.match(String(groupProblem({ name: '  ' })), /name/);
    assert.match(String(groupProblem({ name: 'x'.repeat(81) })), /80 characters/);
    assert.match(String(groupProblem({ workspaceIds: ['a', 'a'] })), /twice/);
    assert.match(String(groupProblem({ workspaceIds: 'a' })), /Choose the workspaces/);
    assert.deepEqual(groupsOf([{ id: 'g1', name: 'A', workspaceIds: ['a'] }, { id: 'g2', name: 'B', workspaceIds: ['b'] }], 'b').map(g => g.id), ['g2']);
  });

  test('the parent is a member; each other company is owned above 50% and at most 100% (Z-16)', () => {
    const workspaceIds = ['a', 'b', 'c'];
    assert.equal(structureProblem({ workspaceIds }), null);
    assert.equal(structureProblem({ workspaceIds, parentId: 'a', ownership: { b: 80, c: 100 } }), null);
    assert.equal(structureProblem({ workspaceIds, parentId: null, ownership: {} }), null);
    assert.match(String(structureProblem({ workspaceIds, parentId: 'z' })), /parent company must be one of/);
    assert.match(String(structureProblem({ workspaceIds, ownership: { b: 80 } })), /Choose the parent/);
    assert.match(String(structureProblem({ workspaceIds, parentId: 'a', ownership: { a: 80 } })), /no share of itself/);
    assert.match(String(structureProblem({ workspaceIds, parentId: 'a', ownership: { z: 80 } })), /outside the group/);
    assert.match(String(structureProblem({ workspaceIds, parentId: 'a', ownership: { b: 50 } })), /50% or less/);
    assert.match(String(structureProblem({ workspaceIds, parentId: 'a', ownership: { b: 101 } })), /up to 100/);
    assert.match(String(structureProblem({ workspaceIds, parentId: 'a', ownership: { b: NaN } })), /up to 100/);
    assert.match(String(structureProblem({ workspaceIds, parentId: 'a', ownership: { b: 75.555 } })), /two decimals/);
    const group = { parentId: 'a', ownership: { b: 80 } };
    assert.deepEqual(['a', 'b', 'c'].map(id => shareOf(group, id)), [100, 80, 100]);
    assert.equal(shareOf({ ownership: { b: 80 } }, 'b'), 100, 'no parent: no shares');
  });

  test('kept rates: a reporting currency, a period, and three rates above zero per other currency (Z-17)', () => {
    const ok = { reportCurrency: 'USD', startDate: '2026-01-01', endDate: '2026-12-31', rates: { EUR: { closing: 1.2, average: 1.1, historical: 1 } } };
    assert.equal(keptRatesProblem(ok), null);
    assert.match(String(keptRatesProblem({ ...ok, reportCurrency: 'usd' })), /reporting currency/);
    assert.match(String(keptRatesProblem({ ...ok, endDate: '2025-12-31' })), /period/);
    assert.match(String(keptRatesProblem({ ...ok, rates: {} })), /by currency/);
    assert.match(String(keptRatesProblem({ ...ok, rates: { EUR: { closing: 1, average: 1 } } })), /above zero/);
    assert.match(String(keptRatesProblem({ ...ok, rates: { EUR: { closing: 1, average: 1, historical: 1, extra: 2 } } })), /above zero/);
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const tag = crypto.randomBytes(4).toString('hex');
  const ann = `ann_${tag}`;
  const bob = `bob_${tag}`;
  const [ws1, ws2, ws3] = ['one', 'two', 'three'].map(n => `ws_grp_${n}_${tag}`);
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const call = async (path: string, method: string, uid: string, body?: unknown) => {
    const res = await fetch(`${base}/api/v1/account/groups${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const ids = (body: Record<string, unknown>) => (body.group as { workspaceIds: string[] }).workspaceIds;
  let groupId = '';

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { accountRouter } = await import('../server/routes/accountRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws1).set({ uid: ann, name: 'Holding', members: [ann] });
    await db.collection('workspaces').doc(ws2).set({ uid: bob, name: 'Daughter', members: [bob, ann], roles: { [ann]: 'accountant' } });
    await db.collection('workspaces').doc(ws3).set({ uid: bob, name: 'Bob only', members: [bob] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'x@example.test' }; next(); });
    app.use('/api/v1/account', accountRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    await db.pool.query(`delete from public."workspaceGroups" where data->>'ownerUid' in ($1, $2)`, [ann, bob]);
    for (const id of [ws1, ws2, ws3]) await db.pool.query('delete from public.workspaces where id = $1', [id]);
    await db.terminate();
  });

  test('a person groups workspaces they can open; one they cannot is refused like a missing one', async () => {
    const refused = await call('', 'POST', ann, { name: 'Group', workspaceIds: [ws1, ws3] });
    assert.equal(refused.status, 404, JSON.stringify(refused.body));
    assert.equal((await call('', 'POST', ann, { name: ' ', workspaceIds: [ws1] })).status, 400);
    assert.equal((await call('', 'POST', ann, { name: 'Group', workspaceIds: ws1 })).status, 400);
    const made = await call('', 'POST', ann, { name: ' Family ', workspaceIds: [ws1, ws2] });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    groupId = String((made.body.group as { id: string }).id);
    assert.match(groupId, /^grp_[0-9a-f]{20}$/);
    assert.deepEqual(ids(made.body), [ws1, ws2]);
    assert.equal((made.body.group as { name: string }).name, 'Family');
    // the workspaces themselves are untouched
    assert.deepEqual(Object.keys((await db.collection('workspaces').doc(ws2).get()).data()!).sort(), ['members', 'name', 'roles', 'uid']);
  });

  test('the parent and the shares it owns are kept; ones that break the rules are refused (Z-16)', async () => {
    assert.equal((await call(`/${groupId}`, 'PUT', ann, { parentId: ws3 })).status, 404, 'one the person can\'t open answers like a missing one');
    assert.equal((await call(`/${groupId}`, 'PUT', ann, { workspaceIds: [ws2], parentId: ws1 })).status, 400, 'not a member');
    assert.equal((await call(`/${groupId}`, 'PUT', ann, { parentId: ws1, ownership: { [ws2]: 40 } })).status, 400);
    assert.equal((await call(`/${groupId}`, 'PUT', ann, { ownership: { [ws2]: 80 } })).status, 400, 'shares need a parent');
    const set = await call(`/${groupId}`, 'PUT', ann, { parentId: ws1, ownership: { [ws2]: 80 } });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    assert.deepEqual([(set.body.group as { parentId: string }).parentId, (set.body.group as { ownership: unknown }).ownership], [ws1, { [ws2]: 80 }]);
    const renamed = await call(`/${groupId}`, 'PUT', ann, { name: 'Family' });
    assert.deepEqual((renamed.body.group as { ownership: unknown }).ownership, { [ws2]: 80 }, 'left out: kept');
  });

  test('the translation rates used for a period are kept on the group, the newest periods only (Z-17)', async () => {
    const rates = { EUR: { closing: 1.2, average: 1.1, historical: 1 } };
    const body = { reportCurrency: 'USD', startDate: '2026-01-01', endDate: '2026-12-31', rates };
    const kept = await call(`/${groupId}/rates`, 'PUT', ann, body);
    assert.equal(kept.status, 200, JSON.stringify(kept.body));
    assert.deepEqual((kept.body.group as { rates: unknown }).rates, { 'USD:2026-01-01:2026-12-31': rates });
    assert.equal((await call(`/${groupId}/rates`, 'PUT', bob, body)).status, 404, 'only on your own group');
    assert.equal((await call(`/${groupId}/rates`, 'PUT', ann, { ...body, rates: { EUR: { closing: 0, average: 1, historical: 1 } } })).status, 400);
    assert.equal((await call(`/${groupId}/rates`, 'PUT', ann, { ...body, rates: { USD: { closing: 1, average: 1, historical: 1 } } })).status, 400, 'not the reporting currency itself');
    assert.equal((await call(`/${groupId}/rates`, 'PUT', ann, { ...body, startDate: '2027-01-01' })).status, 400);
    const { MAX_KEPT_RATES } = await import('../lib/workspaceGroups');
    const many = Object.fromEntries(Array.from({ length: MAX_KEPT_RATES + 5 }, (_, i) => [`USD:2000-01-01:${2000 + i}-12-31`, rates]));
    await db.collection('workspaceGroups').doc(groupId).update({ rates: many });
    const trimmed = await call(`/${groupId}/rates`, 'PUT', ann, body);
    const keys = Object.keys((trimmed.body.group as { rates: Record<string, unknown> }).rates);
    assert.equal(keys.length, MAX_KEPT_RATES);
    assert.ok(keys.includes('USD:2026-01-01:2026-12-31') && !keys.includes('USD:2000-01-01:2000-12-31'), 'the oldest periods go');
    await db.collection('workspaceGroups').doc(groupId).update({ rates: {} });
  });

  test('shared by email: they read it under their own access, only the owner changes it, they can leave (DA-01)', async () => {
    const carol = crypto.randomUUID();
    const carolEmail = `carol_${tag}@example.test`;
    await db.pool.query('insert into auth.users (id, email) values ($1, $2)', [carol, carolEmail]);
    try {
      await db.collection('workspaces').doc(ws1).update({ members: [ann, carol] });
      assert.equal((await call(`/${groupId}/share`, 'POST', ann, { email: 'nobody@example.test' })).status, 404);
      assert.equal((await call(`/${groupId}/share`, 'POST', ann, { email: 'not an email' })).status, 400);
      assert.equal((await call(`/${groupId}/share`, 'POST', bob, { email: carolEmail })).status, 404, 'only the owner shares it');
      const shared = await call(`/${groupId}/share`, 'POST', ann, { email: carolEmail.toUpperCase() });
      assert.equal(shared.status, 200, JSON.stringify(shared.body));
      assert.deepEqual((shared.body.group as { sharedWith: unknown }).sharedWith, [{ uid: carol, email: carolEmail }]);
      const seen = (await call('', 'GET', carol)).body.groups as Array<{ id: string; mine: boolean; sharedBy: string; workspaceIds: string[]; sharedWith?: unknown }>;
      assert.deepEqual(seen.map(g => [g.id, g.mine, g.sharedBy, g.workspaceIds, g.sharedWith]), [[groupId, false, 'x@example.test', [ws1], undefined]], 'only the member she can open; not whom else it is shared with');
      assert.equal((await call(`/${groupId}`, 'PUT', carol, { name: 'Mine now' })).status, 404);
      assert.equal((await call(`/${groupId}`, 'DELETE', carol)).status, 404);
      assert.equal((await call(`/${groupId}/share/${ann}`, 'DELETE', carol)).status, 404, 'she can only take herself off');
      assert.equal((await call(`/${groupId}/share/${carol}`, 'DELETE', carol)).status, 200);
      assert.deepEqual((await call('', 'GET', carol)).body.groups, []);
      await call(`/${groupId}/share`, 'POST', ann, { email: carolEmail });
      assert.equal((await call(`/${groupId}/share/${carol}`, 'DELETE', ann)).status, 200, 'the owner stops sharing');
      assert.deepEqual((await call('', 'GET', carol)).body.groups, []);
      // deleting her account takes her name off groups shared with her
      await call(`/${groupId}/share`, 'POST', ann, { email: carolEmail });
      const { deleteAccount } = await import('../server/services/accountDeletionService');
      await deleteAccount(db, { uid: carol }, async () => {});
      const after = (await db.collection('workspaceGroups').doc(groupId).get()).data()!;
      assert.deepEqual([after.sharedWith, after.sharedEmails], [[], {}]);
    } finally {
      await db.collection('workspaces').doc(ws1).update({ members: [ann] });
      await db.pool.query('delete from auth.users where id = $1', [carol]);
    }
  });

  test('nobody else reads or changes the group', async () => {
    assert.deepEqual((await call('', 'GET', bob)).body.groups, []);
    assert.equal((await call(`/${groupId}`, 'PUT', bob, { name: 'Mine now' })).status, 404);
    assert.equal((await call(`/${groupId}`, 'DELETE', bob)).status, 404);
    assert.equal((await call('/not-a-group', 'PUT', ann, { name: 'x' })).status, 404);
  });

  test('a workspace the person can no longer open drops out of sight, and is kept unseen when the group changes', async () => {
    await db.collection('workspaces').doc(ws2).update({ members: [bob], roles: {} });
    const listed = await call('', 'GET', ann);
    assert.deepEqual((listed.body.groups as Array<{ workspaceIds: string[] }>)[0].workspaceIds, [ws1]);
    const renamed = await call(`/${groupId}`, 'PUT', ann, { name: 'Family companies', workspaceIds: [ws1] });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.deepEqual(ids(renamed.body), [ws1]);
    assert.deepEqual((await db.collection('workspaceGroups').doc(groupId).get()).data()?.workspaceIds, [ws1, ws2], 'kept, unseen');
    assert.equal((renamed.body.group as { ownership: Record<string, number> }).ownership[ws2], undefined, 'its share is not shown');
    assert.deepEqual((await db.collection('workspaceGroups').doc(groupId).get()).data()?.ownership, { [ws2]: 80 }, 'its share is kept, unseen');
    assert.equal((await call(`/${groupId}`, 'PUT', ann, { workspaceIds: [ws1, ws3] })).status, 404, 'still only openable ones are added');
  });

  test('the data export lists the groups; removing a group leaves its workspaces', async () => {
    const { collectPersonalData } = await import('../server/services/personalDataService');
    const exported = await collectPersonalData(db, { uid: ann });
    assert.deepEqual((exported.groups as Array<{ name: string }>).map(g => g.name), ['Family companies']);
    assert.equal((await call(`/${groupId}`, 'DELETE', ann)).status, 200);
    assert.deepEqual((await call('', 'GET', ann)).body.groups, []);
    assert.equal((await db.collection('workspaces').doc(ws1).get()).exists, true);
  });
});

describe('Settings → Groups of books', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('lists the groups by workspace name, and makes a new one from the workspaces you can open', async () => {
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [ws, { ...ws, id: 'ws-b', name: 'Branch B' }, { ...ws, id: 'ws-c', name: 'Branch C' }] });
    const calls = stubFetchWithBodies(200, { status: 'success', groups: [{ id: 'grp_aaaaaaaa', name: 'Holding', workspaceIds: ['component-workspace', 'ws-b'] }] });
    render(<GroupsSettings />);
    await waitFor(() => assert.ok(screen.getByText('Holding', { selector: 'bdi' })));
    assert.ok(screen.getByText('Test workspace, Branch B'));
    fireEvent.click(screen.getByRole('button', { name: 'New group' }));
    assert.match(screen.getByRole('status').textContent || '', /name/);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Branches' } });
    assert.match(screen.getByRole('status').textContent || '', /at least one workspace/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Branch B' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Branch C' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save group' })); });
    const post = calls.find(c => c.url === '/api/v1/account/groups' && c.method === 'POST')!;
    assert.deepEqual(post.body, { name: 'Branches', workspaceIds: ['ws-b', 'ws-c'], parentId: null, ownership: {}, investments: {}, acquired: {} });
  });

  test('changing a group sends its id; removing one says its workspaces are untouched', async () => {
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [ws, { ...ws, id: 'ws-b', name: 'Branch B' }] });
    const calls = stubFetchWithBodies(200, { status: 'success', groups: [{ id: 'grp_aaaaaaaa', name: 'Holding', workspaceIds: ['ws-b'] }] });
    render(<GroupsSettings />);
    await waitFor(() => assert.ok(screen.getByText('Holding', { selector: 'bdi' })));
    fireEvent.click(screen.getByRole('button', { name: 'Change Holding' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Test workspace' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save group' })); });
    const put = calls.find(c => c.method === 'PUT')!;
    assert.equal(put.url, '/api/v1/account/groups/grp_aaaaaaaa');
    assert.deepEqual(put.body, { name: 'Holding', workspaceIds: ['ws-b', 'component-workspace'], parentId: null, ownership: {}, investments: {}, acquired: {} });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove Holding' })); });
    assert.ok(calls.some(c => c.method === 'DELETE' && c.url === '/api/v1/account/groups/grp_aaaaaaaa'));
  });

  test('sharing a group by email, stopping it, and leaving one shared with you (DA-01)', async () => {
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [ws, { ...ws, id: 'ws-b', name: 'Branch B' }], user: { ...(useAuthStore.getState().user || {}), uid: 'me-1' } as never });
    const calls = stubFetchWithBodies(200, { status: 'success', groups: [
      { id: 'grp_aaaaaaaa', name: 'Holding', workspaceIds: ['ws-b'], mine: true, sharedWith: [{ uid: 'u-2', email: 'dana@example.test' }] },
      { id: 'grp_bbbbbbbb', name: 'Clients', workspaceIds: ['component-workspace'], mine: false, sharedBy: 'eli@example.test' },
    ] });
    render(<GroupsSettings />);
    await waitFor(() => assert.ok(screen.getByText('Clients', { selector: 'bdi' })));
    assert.ok(screen.getByText('eli@example.test'));
    assert.equal(screen.queryByRole('button', { name: 'Change Clients' }), null, 'only its owner changes it');
    fireEvent.change(screen.getByLabelText('Share Holding with (email)'), { target: { value: 'fay@example.test' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share Holding' })); });
    assert.deepEqual(calls.find(c => c.url === '/api/v1/account/groups/grp_aaaaaaaa/share')?.body, { email: 'fay@example.test' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop sharing Holding with dana@example.test' })); });
    assert.ok(calls.some(c => c.method === 'DELETE' && c.url === '/api/v1/account/groups/grp_aaaaaaaa/share/u-2'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Leave Clients' })); });
    assert.ok(calls.some(c => c.method === 'DELETE' && c.url === '/api/v1/account/groups/grp_bbbbbbbb/share/me-1'));
  });

  test('a parent and the share it owns of each other company (Z-16)', async () => {
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [ws, { ...ws, id: 'ws-b', name: 'Branch B' }, { ...ws, id: 'ws-c', name: 'Branch C' }] });
    const groupsBody = { status: 'success', groups: [{ id: 'grp_aaaaaaaa', name: 'Holding', workspaceIds: ['component-workspace', 'ws-b', 'ws-c'], parentId: 'component-workspace', ownership: { 'ws-b': 80 }, investments: { 'ws-b': 'acc-shares-b' }, acquired: { 'ws-b': '2024-06-30' } }] };
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      // the parent's asset accounts, read from its own chart
      const body = url.includes('/chartAccounts')
        ? ['acc-shares-b', 'acc-shares-c'].map(id => ({ id, data: { workspaceId: 'component-workspace', name: id === 'acc-shares-b' ? 'Shares in B' : 'Shares in C', type: 'asset' }, updated_at: '2026-01-01' }))
        : groupsBody;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<GroupsSettings />);
    await waitFor(() => assert.ok(screen.getByText('Parent: Test workspace; Branch B 80%; Branch C 100%')));
    fireEvent.click(screen.getByRole('button', { name: 'Change Holding' }));
    assert.equal((screen.getByLabelText('Share of Branch B owned, in percent') as HTMLInputElement).value, '80');
    fireEvent.change(screen.getByLabelText('Share of Branch C owned, in percent'), { target: { value: '40' } });
    assert.match(screen.getByRole('status').textContent || '', /50% or less/);
    fireEvent.change(screen.getByLabelText('Share of Branch C owned, in percent'), { target: { value: '60' } });
    await waitFor(() => assert.equal(screen.getAllByRole('option', { name: 'Shares in C' }).length, 2, 'one list per company'));
    assert.equal((screen.getByLabelText('Investment in Branch B') as HTMLSelectElement).value, 'acc-shares-b');
    assert.equal((screen.getByLabelText('Day Branch B was bought') as HTMLInputElement).value, '2024-06-30');
    assert.equal(screen.queryByLabelText('Day Branch C was bought'), null, 'asked once its investment account is chosen');
    fireEvent.change(screen.getByLabelText('Investment in Branch C'), { target: { value: 'acc-shares-c' } });
    fireEvent.change(screen.getByLabelText('Day Branch C was bought'), { target: { value: '2025-01-15' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save group' })); });
    assert.deepEqual(calls.find(c => c.method === 'PUT')!.body, {
      name: 'Holding', workspaceIds: ['component-workspace', 'ws-b', 'ws-c'], parentId: 'component-workspace', ownership: { 'ws-b': 80, 'ws-c': 60 },
      investments: { 'ws-b': 'acc-shares-b', 'ws-c': 'acc-shares-c' }, acquired: { 'ws-b': '2024-06-30', 'ws-c': '2025-01-15' },
    });
    // taking the parent out of the group clears it, and its shares go with it
    fireEvent.click(screen.getByRole('button', { name: 'Change Holding' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Test workspace' }));
    assert.equal((screen.getByLabelText('Parent company (optional)') as HTMLSelectElement).value, '');
    assert.equal(screen.queryByLabelText('Share of Branch B owned, in percent'), null);
  });
});
