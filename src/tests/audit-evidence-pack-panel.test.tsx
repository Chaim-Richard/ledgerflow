/**
 * Settings → Security → Audit evidence pack (BJ-02 / C-36) on screen: choosing a period lists the
 * files the ZIP will hold with the rows each one has, refuses a period that runs backwards, and is
 * available to owners and accountants only.
 */
import './helpers/dom';
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuditEvidencePackPanel from '../components/platform/settings/AuditEvidencePackPanel';
import { getSupabase } from '../lib/db/client';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';

const auth = getSupabase().auth;
afterEach(async () => { cleanup(); mock.restoreAll(); getSupabase().realtime.disconnect(); await auth.dispose(); });

const local = (day: number, hour = 12) => new Date(2026, 9, day, hour, 0, 0).toISOString();

function seed() {
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('auditLogs', 'invoices', 'payRuns');
  useLedgerStore.setState({
    auditLogs: [
      { id: 'a1', action: 'USER_LOGIN', uid: 'test-user', userEmail: 'test@example.test', entityType: 'auth', entityId: 'test-user', details: {}, timestamp: local(2) },
      { id: 'a2', action: 'ROLE_CHANGE', uid: 'test-user', userEmail: 'test@example.test', entityType: 'workspace', entityId: 'component-workspace', timestamp: local(3), details: { targetUid: 'member-1', beforeRole: 'viewer', afterRole: 'accountant' } },
      { id: 'a3', action: 'USER_LOGIN', uid: 'test-user', userEmail: 'test@example.test', entityType: 'auth', entityId: 'test-user', details: {}, timestamp: '2026-08-02T12:00:00.000Z' },
    ],
    invoices: [{ id: 'inv-1', uid: 'test-user', workspaceId: 'component-workspace', customerId: 'c1', number: 'INV-1001', amountCents: 200000, dueDate: '2026-10-30', date: '2026-10-06', status: 'sent', approval: { state: 'approved', thresholdCents: 150000, requestedAt: local(6), decidedAt: local(7), decidedBy: 'test@example.test' } }],
    payRuns: [{ id: 'run-1', uid: 'test-user', workspaceId: 'component-workspace', date: '2026-10-25', totalAmountCents: 500000, employeeCount: 2, status: 'processed', createdAt: local(24), approvedAt: local(25), approvedByEmail: 'test@example.test' }],
  } as never);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/members')
      ? { status: 'success', ownerUid: 'test-user', members: ['member-1'] }
      : { status: 'success', ownerUid: 'test-user', roles: { 'member-1': 'accountant' } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  mock.method(auth, 'getUser', async () => ({ data: { user: { id: 'test-user' } }, error: null }));
  mock.method(auth.mfa, 'listFactors', async () => ({ data: { all: [], totp: [], phone: [], webauthn: [], recovery_code: [] }, error: null }));
}

test('the pack lists its files with the rows they will hold, for the chosen period', async () => {
  seed();
  render(<AuditEvidencePackPanel />);
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-31' } });
  await waitFor(() => assert.ok(screen.getByText('audit-log.csv')));
  const items = Array.from(document.querySelectorAll('li')).map(item => item.textContent || '');
  assert.match(items.find(item => item.includes('audit-log.csv')) || '', /2 rows · 7 columns/);
  assert.match(items.find(item => item.includes('period-locks.csv')) || '', /3 rows · 5 columns/);
  assert.match(items.find(item => item.includes('approvals.csv')) || '', /2 rows · 9 columns/);
  assert.match(items.find(item => item.includes('access-review.csv')) || '', /2 rows · 8 columns/);
  assert.ok(items.some(item => item.includes('README.txt') && item.includes('explains the pack')));
  assert.equal((screen.getByRole('button', { name: 'Download .zip' }) as HTMLButtonElement).disabled, false);
});

test('a period that runs backwards is refused before anything is built', async () => {
  seed();
  render(<AuditEvidencePackPanel />);
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-20' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
  await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /first date must not be after the last/));
  assert.equal((screen.getByRole('button', { name: 'Download .zip' }) as HTMLButtonElement).disabled, true);
  assert.equal(screen.queryByText('audit-log.csv'), null);
});

test('a bookkeeper is told why the pack is not theirs', async () => {
  seed();
  setComponentWorkspace('bookkeeper');
  render(<AuditEvidencePackPanel />);
  assert.match(screen.getByText(/Only owners and accountants can download/).textContent || '', /Ask an owner/);
  assert.equal(screen.queryByRole('button', { name: 'Download .zip' }), null);
});
