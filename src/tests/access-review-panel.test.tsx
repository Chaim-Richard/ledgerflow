/**
 * Settings → Security → Access review (BJ-03 / C-35) on screen: the owner's row first, every member
 * with role, last sign-in, two-step login and last role change, the limits written beside the table,
 * and owners and accountants only.
 */
import './helpers/dom';
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccessReviewPanel from '../components/platform/settings/AccessReviewPanel';
import { getSupabase } from '../lib/db/client';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';

const auth = getSupabase().auth;
afterEach(async () => { cleanup(); mock.restoreAll(); getSupabase().realtime.disconnect(); await auth.dispose(); });

const local = (day: number) => new Date(2026, 9, day, 12, 0, 0).toISOString();

function seedAuditLogs() {
  useLedgerStore.setState({
    auditLogs: [
      { id: 'a1', action: 'USER_LOGIN', uid: 'test-user', userEmail: 'test@example.test', entityType: 'auth', entityId: 'test-user', details: {}, timestamp: local(2) },
      { id: 'a2', action: 'ROLE_CHANGE', uid: 'test-user', userEmail: 'test@example.test', entityType: 'workspace', entityId: 'component-workspace', timestamp: local(3), details: { targetUid: 'member-1', beforeRole: 'viewer', afterRole: 'accountant' } },
      { id: 'a3', action: 'USER_LOGIN', uid: 'member-1', userEmail: 'member@example.test', entityType: 'auth', entityId: 'member-1', details: {}, timestamp: local(4) },
    ],
  });
}

function stubTeam(status = 200) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (status !== 200) return new Response(JSON.stringify({ message: 'Workspace not found' }), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/members')) return new Response(JSON.stringify({ status: 'success', ownerUid: 'test-user', members: ['member-1', 'member-2'] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/roles')) return new Response(JSON.stringify({ status: 'success', ownerUid: 'test-user', roles: { 'member-1': 'accountant', 'member-2': 'viewer' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ status: 'error' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

async function ready() {
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('auditLogs');
  seedAuditLogs();
  mock.method(auth, 'getUser', async () => ({ data: { user: { id: 'test-user' } }, error: null }));
  mock.method(auth.mfa, 'listFactors', async () => ({ data: { all: [{ id: 'f1', status: 'verified', factor_type: 'totp', friendly_name: 'Phone' }], totp: [], phone: [], webauthn: [], recovery_code: [] }, error: null }));
}

test('an owner sees every person, owner first, with role, sign-in, two-step and role change', async () => {
  await ready();
  stubTeam();
  render(<AccessReviewPanel />);
  await waitFor(() => assert.ok(screen.getByRole('columnheader', { name: 'Two-step login' })));
  const rows = document.querySelectorAll('tbody tr');
  assert.equal(rows.length, 3);
  const text = (index: number) => rows[index].textContent || '';
  assert.match(text(0), /test@example\.test/);
  assert.match(text(0), /Owner/);
  assert.match(text(0), /On \(your account\)/); // the reader's own authenticator, read from their account
  assert.match(text(1), /member@example\.test/);
  assert.match(text(1), /Accountant/);
  assert.match(text(1), /Only that person can see it/);
  assert.match(text(1), /Viewer → Accountant by test@example\.test/);
  assert.match(text(2), /member-2/);
  assert.match(text(2), /Not in the recent audit entries/);
  assert.match(screen.getByText(/newest 500 entries/).textContent || '', /does not mean the person never signed in/);
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
});

test('an accountant sees it too; a bookkeeper is told why not', async () => {
  await ready();
  setComponentWorkspace('accountant');
  stubTeam();
  const view = render(<AccessReviewPanel />);
  await waitFor(() => assert.ok(screen.getByRole('columnheader', { name: 'Role' })));
  assert.equal(document.querySelectorAll('tbody tr').length, 3);
  view.unmount();

  setComponentWorkspace('bookkeeper');
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => { urls.push(String(input)); return new Response('{}', { status: 200 }); }) as typeof fetch;
  render(<AccessReviewPanel />);
  assert.match(screen.getByText(/Only owners and accountants can see who has access/).textContent || '', /Ask an owner/);
  assert.equal(document.querySelector('table'), null);
  assert.equal(urls.length, 0); // a refused reader never asks the server for the names
});

test('a failed load says so, offers a retry, and succeeds on the retry', async () => {
  await ready();
  stubTeam(500);
  render(<AccessReviewPanel />);
  await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /could not be loaded/));
  stubTeam(200);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })); });
  await waitFor(() => assert.ok(screen.getByRole('columnheader', { name: 'Last sign-in' })));
  assert.equal(document.querySelectorAll('tbody tr').length, 3);
});
