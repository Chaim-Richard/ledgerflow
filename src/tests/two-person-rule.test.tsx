/**
 * The two-person rule (P-05): nobody approves what they prepared. An approver's own save that
 * issues an invoice over the limit leaves it waiting; approving an invoice you sent for approval is
 * refused by the server and has no button; the rule turns on only with two people who can approve.
 * (Pay runs under the rule: pay-run-posting.test.ts.)
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { cleanup, render, screen } from '@testing-library/react';
import { approverCount, mayApprove } from '../lib/twoPersonRule';
import { approvalForSave } from '../lib/invoiceApproval';
import { ApprovalRefused, serverApproval } from '../server/services/invoiceApprovalGuard';
import { InvoiceApprovalFlag } from '../components/sales/InvoiceApprovalFlag';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';
import type { Workspace } from '../types';

const settings = { enabled: true, thresholdCents: 100000 };
const workspace = { uid: 'owner', members: ['owner', 'acc', 'book'], roles: { acc: 'accountant', book: 'bookkeeper' }, invoiceApproval: settings, twoPersonRule: true };
const now = '2026-10-10T12:00:00.000Z';
const big = { amountCents: 150000, status: 'pending' };

describe('The rule', () => {
  test('who can approve, and whether this person may approve this', () => {
    assert.equal(approverCount(workspace), 2);
    assert.equal(approverCount({ uid: 'owner', members: ['owner', 'book'], roles: { book: 'bookkeeper' } }), 1);
    assert.equal(mayApprove(true, 'acc', 'owner'), true);
    assert.equal(mayApprove(true, 'owner', 'owner'), false);
    assert.equal(mayApprove(false, 'owner', 'owner'), true);
  });

  test('an owner\'s own save no longer signs it; without the rule it still does', () => {
    assert.equal(approvalForSave(big, settings, { role: 'owner', uid: 'owner', now, twoPerson: true })?.state, 'awaiting');
    assert.equal(approvalForSave(big, settings, { role: 'owner', uid: 'owner', now })?.state, 'approved');
  });

  test('on the server: a save that issues it and says "approved" waits; approving your own is refused; someone else may', () => {
    assert.deepEqual(serverApproval(undefined, { ...big, approval: { state: 'approved', thresholdCents: 100000 } }, workspace, 'owner', now),
      { approval: { state: 'awaiting', thresholdCents: 100000, requestedBy: 'owner', requestedAt: now } });
    assert.equal(serverApproval(undefined, big, workspace, 'acc', now).approval?.state, 'awaiting');
    const waiting = { ...big, uid: 'acc', approval: { state: 'awaiting' as const, thresholdCents: 100000, requestedBy: 'acc', requestedAt: now } };
    assert.throws(() => serverApproval(waiting, { approval: { state: 'approved', thresholdCents: 100000 } }, workspace, 'acc', now), ApprovalRefused);
    assert.equal(serverApproval(waiting, { approval: { state: 'approved', thresholdCents: 100000 } }, workspace, 'owner', now).approval?.decidedBy, 'owner');
    assert.equal(serverApproval(waiting, { approval: { state: 'rejected', thresholdCents: 100000 } }, workspace, 'acc', now).approval?.state, 'rejected', 'sending your own back is fine');
    assert.equal(serverApproval(waiting, { approval: { state: 'approved', thresholdCents: 100000 } }, { ...workspace, twoPersonRule: false }, 'acc', now).approval?.state, 'approved');
  });
});

describe('Turning it on (database)', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_twoperson_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const put = (uid: string, on: boolean) => fetch(`${base}/api/v1/workspaces/${ws}/security/two-person`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ on }) });
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Two', members: ['owner-1', 'book-1'], roles: { 'book-1': 'bookkeeper' } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('only with a second owner or accountant; only owners; audited', async () => {
    const alone = await put('owner-1', true);
    assert.equal(alone.status, 409);
    assert.match(String((await alone.json() as { message: string }).message), /second owner or accountant/);
    await db.collection('workspaces').doc(ws).update({ members: ['owner-1', 'book-1', 'acct-1'], roles: { 'book-1': 'bookkeeper', 'acct-1': 'accountant' } });
    assert.equal((await put('acct-1', true)).status, 403);
    assert.equal((await put('owner-1', true)).status, 200);
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.twoPersonRule, true);
    const audit = await db.pool.query(`select count(*)::int as n from public."auditLogs" where workspace_id = $1 and data->>'action' = 'TWO_PERSON_RULE_SET'`, [ws]);
    assert.equal(audit.rows[0].n, 1);
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('whoever sent an invoice for approval can send it back but sees no Approve; someone else sees both', () => {
    const invoice = { number: 'INV-9', ...big, uid: 'acc', approval: { state: 'awaiting' as const, thresholdCents: 100000, requestedBy: 'acc' } };
    useAuthStore.setState({ user: { uid: 'acc' } as never, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD', twoPersonRule: true } as Workspace] });
    render(<InvoiceApprovalFlag invoice={invoice} settings={settings} currency="USD" canDecide onDecide={() => {}} />);
    assert.equal(screen.queryByRole('button', { name: 'Approve' }), null);
    assert.ok(screen.getByText(/Someone else approves it/));
    assert.ok(screen.getByRole('button', { name: 'Send back' }));
    cleanup();
    useAuthStore.setState({ user: { uid: 'owner' } as never });
    render(<InvoiceApprovalFlag invoice={invoice} settings={settings} currency="USD" canDecide onDecide={() => {}} />);
    assert.ok(screen.getByRole('button', { name: 'Approve' }));
  });
});
