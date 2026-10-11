/**
 * Bank Connections lists the workspace's banks (Z-30): each with its state and last good sync,
 * Reconnect when the login expired, and Disconnect for owners and accountants, after a confirmation
 * that says the imported lines stay. Nothing is listed when there are no connections.
 */
import './helpers/dom';
import test, { afterEach, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ConnectedBanks from '../components/banking/ConnectedBanks';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { getSupabase } from '../lib/db/client';

const banks = { banks: [{ id: 'b1', institutionName: 'Leumi', status: 'login_required', lastSyncedAt: null }, { id: 'b2', institutionName: 'Chase', status: 'active', lastSyncedAt: '2026-10-01T10:00:00.000Z' }] };

describe('Connected banks', () => {
  afterEach(async () => { cleanup(); mock.restoreAll(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('an owner disconnects a bank after confirming; the list is read again', async () => {
    setComponentWorkspace('owner');
    const calls = stubFetchWithBodies(200, banks);
    const asked = mock.method(window, 'confirm', () => true);
    render(<ConnectedBanks />);
    await screen.findByText('Leumi', { selector: 'bdi' });
    assert.match(document.body.textContent || '', /Login expired: reconnect it · last good sync: never/);
    assert.ok(screen.getByRole('button', { name: /Reconnect/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Disconnect Chase' })); });
    assert.match(String(asked.mock.calls[0].arguments[0]), /the lines already imported stay/);
    const post = calls.find(c => c.url === '/api/v1/plaid/disconnect')!;
    assert.equal(post.method, 'POST');
    assert.deepEqual(post.body, { workspaceId: 'component-workspace', bankId: 'b2' });
    assert.equal(calls.filter(c => c.url.startsWith('/api/v1/plaid/banks')).length, 2, 'read again after');
  });

  test('each bank\'s health and its sync history, newest first (Z-28, Z-29)', async () => {
    setComponentWorkspace('viewer');
    const recent = new Date(Date.now() - 3_600_000).toISOString();
    stubFetchWithBodies(200, { banks: [
      { id: 'b3', institutionName: 'Discount', status: 'error', lastSyncedAt: '2026-01-01T10:00:00.000Z', syncLog: [{ at: recent, result: 'error', error: 'INSTITUTION_DOWN' }, { at: '2026-01-01T10:00:00.000Z', result: 'ok', lines: 1 }] },
      { id: 'b4', institutionName: 'Hapoalim', status: 'active', lastSyncedAt: '2026-01-01T10:00:00.000Z', syncLog: [{ at: '2026-01-01T10:00:00.000Z', result: 'ok', lines: 12 }] },
      { id: 'b5', institutionName: 'Mizrahi', status: 'active', lastSyncedAt: recent },
    ] });
    render(<ConnectedBanks />);
    await screen.findByText('Discount', { selector: 'bdi' });
    const text = document.body.textContent || '';
    assert.match(text, /The last sync failed \(INSTITUTION_DOWN\): try again, or reconnect it/);
    assert.match(text, /No sync for \d+ days/);
    assert.match(text, /Connected · last good sync/);
    const history = screen.getAllByText(/Sync history/, { selector: 'summary' })[0].parentElement!;
    assert.deepEqual([...history.querySelectorAll('li')].map(li => li.textContent?.replace(/^.*?: /, '')), ['Failed (INSTITUTION_DOWN)', 'Synced, 1 bank line']);
    assert.match(screen.getAllByText(/Sync history/, { selector: 'summary' })[1].parentElement!.textContent || '', /Synced, 12 bank lines/);
  });

  test('saying no sends nothing; a bookkeeper can reconnect but not disconnect; no banks shows nothing', async () => {
    setComponentWorkspace('owner');
    let calls = stubFetchWithBodies(200, banks);
    mock.method(window, 'confirm', () => false);
    render(<ConnectedBanks />);
    await screen.findByText('Leumi', { selector: 'bdi' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Disconnect Leumi' })); });
    assert.equal(calls.filter(c => c.url === '/api/v1/plaid/disconnect').length, 0);
    cleanup();
    setComponentWorkspace('bookkeeper');
    stubFetchWithBodies(200, banks);
    render(<ConnectedBanks />);
    await screen.findByText('Leumi', { selector: 'bdi' });
    assert.equal(screen.queryByRole('button', { name: /Disconnect/ }), null);
    cleanup();
    setComponentWorkspace('owner');
    calls = stubFetchWithBodies(200, { banks: [] });
    const view = render(<ConnectedBanks />);
    await act(async () => { await Promise.resolve(); });
    assert.equal(view.container.textContent, '');
    assert.equal(calls.length, 1);
  });
});
