import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import BankFeedHealth from '../components/dashboard/BankFeedHealth';
import { readBankStatuses } from '../lib/bankFeedStatus';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

test('bank timestamps preserve omitted, null and canonical server timestamps; malformed dates refuse', () => {
  const base = { id: 'bank-1', institutionName: 'בנק Ledger', status: 'active' };
  assert.deepEqual(readBankStatuses({ banks: [base] }), [base]);
  assert.deepEqual(readBankStatuses({ banks: [{ ...base, lastSyncedAt: null }] }), [{ ...base, lastSyncedAt: null }]);
  const stamp = '2026-02-28T23:59:59.000Z';
  assert.equal(readBankStatuses({ banks: [{ ...base, lastSyncedAt: stamp }] })[0].lastSyncedAt, stamp);
  for (const invalid of ['2026-02-30T00:00:00.000Z', 'yesterday', 0, '', undefined, '2026-02-28']) {
    assert.throws(() => readBankStatuses({ banks: [{ ...base, lastSyncedAt: invalid }] }), /Invalid bank last successful sync timestamp/);
  }
});

test('expired connections show the actual last successful sync, never synced and legacy unknown separately', async () => {
  setComponentWorkspace('viewer');
  globalThis.fetch = async () => new Response(JSON.stringify({ banks: [
    { id: 'expired', institutionName: 'בנק expired', status: 'login_required', lastSyncedAt: '2026-02-28T23:59:59.000Z' },
    { id: 'new', institutionName: 'New bank', status: 'active', lastSyncedAt: null },
    { id: 'legacy', institutionName: 'Legacy bank', status: 'active' },
  ] }), { status: 200 });
  render(<BankFeedHealth />);
  await waitFor(() => assert.ok(screen.getByText('בנק expired')));
  const times = document.querySelectorAll('time');
  assert.equal(times.length, 1); assert.equal(times[0].dateTime, '2026-02-28T23:59:59.000Z');
  assert.ok(screen.getByText('Login expired'));
  assert.match(document.body.textContent || '', /Last successful sync: Never successfully synced/);
  assert.match(document.body.textContent || '', /Last successful sync: not provided by the current server/);
  assert.match(document.body.textContent || '', /Connection status alone does not prove a fresh feed/);
  assert.equal(screen.queryByRole('button', { name: 'Reconnect' }), null);
});
