/**
 * Approving in someone's place (BG-07): an owner or accountant hands their invoice approvals to a
 * bookkeeper, accountant or owner until a date; until then that person's approval counts (and the
 * Approve button shows for them); after it, it does not; taken back, it stops.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { cleanup, render, screen } from '@testing-library/react';
import { approvesInPlace, delegationProblem } from '../lib/approvalDelegation';
import { ApprovalRefused, serverApproval } from '../server/services/invoiceApprovalGuard';
import { InvoiceApprovalFlag } from '../components/sales/InvoiceApprovalFlag';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { getLocalDateISO } from '../lib/utils';
import { addDaysYMD } from '../lib/fiscalCalendar';

const ws = { uid: 'owner', members: ['owner', 'acc', 'book', 'view'], roles: { acc: 'accountant', book: 'bookkeeper', view: 'viewer' }, invoiceApproval: { enabled: true, thresholdCents: 100000 } };
const waiting = { amountCents: 150000, status: 'pending', approval: { state: 'awaiting' as const, thresholdCents: 100000, requestedBy: 'acc' } };

describe('The rules', () => {
  test('who may hand over to whom, and for how long', () => {
    assert.equal(delegationProblem(ws, 'owner', { to: 'book', until: '2026-10-20' }, '2026-10-10'), null);
    assert.match(String(delegationProblem(ws, 'book', { to: 'acc', until: '2026-10-20' }, '2026-10-10')), /Only owners and accountants/);
    assert.match(String(delegationProblem(ws, 'owner', { to: 'view', until: '2026-10-20' }, '2026-10-10')), /viewer/);
    assert.match(String(delegationProblem(ws, 'owner', { to: 'stranger', until: '2026-10-20' }, '2026-10-10')), /not in this workspace/);
    assert.match(String(delegationProblem(ws, 'owner', { to: 'owner', until: '2026-10-20' }, '2026-10-10')), /someone else/);
    assert.match(String(delegationProblem(ws, 'owner', { to: 'book', until: '2026-10-09' }, '2026-10-10')), /today or later/);
    assert.match(String(delegationProblem(ws, 'owner', { to: 'book', until: '2027-06-01' }, '2026-10-10')), /92 days/);
  });

  test('on the server: the bookkeeper approves while it lasts (the last day included), not after', () => {
    const handed = { ...ws, approvalDelegates: [{ from: 'owner', to: 'book', until: '2026-10-20' }] };
    assert.ok(approvesInPlace(handed, 'book', '2026-10-20'));
    assert.equal(approvesInPlace(handed, 'book', '2026-10-21'), undefined);
    const decision = { approval: { state: 'approved', thresholdCents: 100000 } };
    assert.equal(serverApproval(waiting, decision, handed, 'book', '2026-10-15T09:00:00.000Z').approval?.decidedBy, 'book');
    assert.throws(() => serverApproval(waiting, decision, handed, 'book', '2026-10-21T09:00:00.000Z'), ApprovalRefused);
    assert.throws(() => serverApproval(waiting, decision, ws, 'book', '2026-10-15T09:00:00.000Z'), ApprovalRefused);
  });
});

describe('Handing over (database)', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const id = `ws_deleg_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const put = async (uid: string, body: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${id}/approval-delegate`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(id).set({ ...ws, uid: 'owner', name: 'Deleg' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['auditLogs', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [id]);
    await db.terminate();
  });

  test('handed over, told, taken back; a bookkeeper cannot hand over', async () => {
    // a week ahead: the server counts days in the workspace's time zone, not the computer's
    const until = addDaysYMD(getLocalDateISO(), 7);
    assert.equal((await put('book', { to: 'acc', until })).status, 403);
    assert.equal((await put('owner', { to: 'view', until })).status, 400);
    const saved = await put('owner', { to: 'book', until });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual((await db.collection('workspaces').doc(id).get()).data()?.approvalDelegates, [{ from: 'owner', to: 'book', until }]);
    const told = await db.pool.query(`select data->>'uid' as uid from public.notifications where workspace_id = $1 and data->>'kind' = 'approval.delegated'`, [id]);
    assert.deepEqual(told.rows.map(r => r.uid), ['book']);
    assert.equal((await put('owner', { clear: true })).status, 200);
    assert.deepEqual((await db.collection('workspaces').doc(id).get()).data()?.approvalDelegates, []);
  });
});

describe('On screen', () => {
  afterEach(() => cleanup());

  test('a bookkeeper approving in the owner\'s place sees Approve', () => {
    const w = setComponentWorkspace('bookkeeper');
    const me = useAuthStore.getState().user!.uid;
    useAuthStore.setState({ workspaces: [{ ...w, approvalDelegates: [{ from: 'owner', to: me, until: '2999-01-01' }] }] });
    render(<InvoiceApprovalFlag invoice={{ ...waiting, number: 'INV-1' }} settings={ws.invoiceApproval} currency="USD" canDecide={false} onDecide={() => {}} />);
    assert.ok(screen.getByRole('button', { name: 'Approve' }));
  });
});
