/**
 * The Practice view (BD-01): every workspace the person can open, with what is waiting there, most
 * work first; counted by the server from each workspace's own rows, only for workspaces the person
 * belongs to. On screen a count opens that workspace on that screen; a name filter and the person's
 * groups narrow the list.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PracticeView from '../components/dashboard/PracticeView';
import { monthBefore, practiceWork, sortPractice, type PracticeRow } from '../lib/practice';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { getSupabase } from '../lib/db/client';

const row = (over: Partial<PracticeRow>): PracticeRow => ({
  workspaceId: 'w', name: 'W', role: 'owner', currency: 'USD', groups: [], bankLines: 0, bankLogins: 0, questions: 0, drafts: 0,
  lastMonth: '2026-09', lastMonthClosed: true, nextRecurring: null, health: null, ...over,
});

describe('The rules', () => {
  test('most work first; last month open counts as one; the month before', () => {
    assert.equal(practiceWork(row({ bankLines: 3, questions: 1, lastMonthClosed: false })), 5);
    assert.equal(practiceWork(row({ health: { serious: 2, warnings: 9, checkedAt: '2026-10-10T02:00:00Z' } })), 2, 'serious problems count; warnings do not');
    assert.deepEqual(sortPractice([row({ name: 'B' }), row({ name: 'A', drafts: 1 }), row({ name: 'C' })]).map(r => r.name), ['A', 'B', 'C']);
    assert.equal(monthBefore('2027-01-15'), '2026-12');
    assert.equal(monthBefore('2026-10-10'), '2026-09');
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const tag = crypto.randomBytes(4).toString('hex');
  const ann = `ann_pr_${tag}`;
  const [busy, calm, theirs] = ['busy', 'calm', 'theirs'].map(n => `ws_pr_${n}_${tag}`);
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { accountRouter } = await import('../server/routes/accountRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(busy).set({ uid: 'boss', name: 'Busy Ltd', currency: 'EUR', members: ['boss', ann], roles: { [ann]: 'accountant' } });
    await db.collection('workspaces').doc(calm).set({ uid: ann, name: 'Calm Co', currency: 'USD', members: [ann], lockDate: '2026-09-30', ledgerHealth: { checkedAt: '2026-10-10T02:00:00Z', counts: { high: 0, medium: 3, low: 1 }, highIds: [] } });
    await db.collection('workspaces').doc(theirs).set({ uid: 'other', name: 'Not mine', members: ['other'] });
    for (const [i, status] of ['pending', 'pending', 'matched'].entries()) await db.collection('bankLines').doc(`${busy}_bl${i}`).set({ workspaceId: busy, status, date: '2026-10-01', amountCents: 1 });
    await db.collection('bankLines').doc(`${theirs}_bl`).set({ workspaceId: theirs, status: 'pending', date: '2026-10-01', amountCents: 1 });
    await db.collection('clientQueries').doc(`${busy}_q`).set({ workspaceId: busy, status: 'open', question: '?' });
    await db.collection('transactions').doc(`${busy}_d`).set({ workspaceId: busy, status: 'draft', date: '2026-10-02', lines: [] });
    await db.collection('invoices').doc(`${busy}_i`).set({ workspaceId: busy, status: 'draft', amountCents: 1 });
    await db.collection('recurring').doc(`${calm}_r1`).set({ workspaceId: calm, description: 'Rent', nextOccurrence: '2026-11-01', isActive: true, status: 'active' });
    await db.collection('recurring').doc(`${calm}_r2`).set({ workspaceId: calm, description: 'Paused', nextOccurrence: '2026-10-15', isActive: true, status: 'paused' });
    await db.collection('workspaceGroups').doc(`grp_${tag}pr01`).set({ ownerUid: ann, name: 'Clients', workspaceIds: [busy] });
    const app = express();
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/account', accountRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    await db.pool.query(`delete from public."workspaceGroups" where data->>'ownerUid' = $1`, [ann]);
    for (const ws of [busy, calm, theirs]) {
      for (const table of ['bankLines', 'clientQueries', 'transactions', 'invoices', 'recurring']) await db.pool.query(`delete from public."${table}" where workspace_id = $1`, [ws]);
      await db.pool.query('delete from public.workspaces where id = $1', [ws]);
    }
    await db.terminate();
  });

  test('each workspace the person can open, its own counts, most work first; another\'s never', async () => {
    const res = await fetch(`${base}/api/v1/account/practice?today=2026-10-10`, { headers: { 'x-test-uid': ann } });
    const body = await res.json() as { rows: PracticeRow[] };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.deepEqual(body.rows.map(r => [r.name, r.role, r.currency, r.groups, r.bankLines, r.questions, r.drafts, r.lastMonthClosed, r.nextRecurring]), [
      ['Busy Ltd', 'accountant', 'EUR', ['Clients'], 2, 1, 2, false, null],
      ['Calm Co', 'owner', 'USD', [], 0, 0, 0, true, { date: '2026-11-01', description: 'Rent' }],
    ], 'Not mine is not listed; its bank line is not counted; a paused recurring item is not next');
    assert.equal(body.rows[0].lastMonth, '2026-09');
    assert.deepEqual(body.rows.map(r => r.health), [null, { serious: 0, warnings: 3, checkedAt: '2026-10-10T02:00:00Z' }], 'from the nightly check, when it ran');
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('a count opens that workspace on that screen; find and group narrow the list', async () => {
    setComponentWorkspace('owner');
    stubFetchWithBodies(200, { status: 'success', rows: [
      row({ workspaceId: 'w1', name: 'Busy Ltd', bankLines: 2, lastMonthClosed: false, groups: ['Clients'], health: { serious: 1, warnings: 0, checkedAt: '2026-10-10T02:00:00Z' } }),
      row({ workspaceId: 'w2', name: 'Calm Co', nextRecurring: { date: '2026-11-01', description: 'Rent' } }),
    ] });
    render(<PracticeView />);
    await waitFor(() => assert.ok(screen.getByText('Busy Ltd')));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /2 bank lines to review in Busy Ltd/ })); });
    assert.equal(useAuthStore.getState().currentWorkspaceId, 'w1');
    assert.equal(useUIStore.getState().activeTab, 'reconciliation');
    assert.ok(screen.getByRole('button', { name: /September 2026 open in Busy Ltd/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /1 serious problems in Busy Ltd/ })); });
    assert.equal(useUIStore.getState().activeTab, 'data-health');
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'Clients' } });
    assert.equal(screen.queryByText('Calm Co'), null);
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'calm' } });
    assert.equal(screen.queryByText('Busy Ltd'), null);
    assert.ok(screen.getByText(/nothing waiting/));
  });
});
