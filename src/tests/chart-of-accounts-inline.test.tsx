/** Chart of accounts, edit in place (I-22): name, code (unique; system accounts keep theirs), category. */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChartOfAccountsView from '../components/ledger/ChartOfAccountsView';
import { getSupabase } from '../lib/db/client';
import { makeChartAccount } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';

const accounts = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Current Assets', isSystem: true }),
  makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', category: 'Operating' }),
];
const view = () => render(<ChartOfAccountsView accounts={accounts} searchTerm="" formatCurrency={c => String(c)} onDrillDown={() => {}} onDeleteAccount={() => {}} />);

beforeEach(() => setComponentWorkspace('owner'));
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

test('rename an account in place', async () => {
  const calls = stubFetchWithBodies(200, null);
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Name of Rent' }));
  fireEvent.change(screen.getByLabelText('Name of Rent'), { target: { value: 'Office rent' } });
  await act(async () => { fireEvent.keyDown(screen.getByLabelText('Name of Rent'), { key: 'Enter' }); });
  await waitFor(() => assert.ok(calls.some(c => c.url.includes('/rpc/lf_update'))));
  const body = calls.find(c => c.url.includes('/rpc/lf_update'))!.body as { p_table: string; p_id: string; p_set: Record<string, unknown> };
  assert.deepEqual([body.p_table, body.p_id, body.p_set.name], ['chartAccounts', 'rent', 'Office rent']);
});

test('a code already used is refused; a system account keeps its code; viewers only read', async () => {
  const calls = stubFetchWithBodies(200, null);
  view();
  assert.equal(screen.queryByRole('button', { name: 'Edit Code of Cash' }), null, 'system account code is fixed');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Code of Rent' }));
  fireEvent.change(screen.getByLabelText('Code of Rent'), { target: { value: '1000' } });
  await act(async () => { fireEvent.keyDown(screen.getByLabelText('Code of Rent'), { key: 'Enter' }); });
  assert.match(screen.getByRole('alert').textContent || '', /1000 is already used/);
  assert.equal(calls.filter(c => c.url.includes('/rpc/')).length, 0);
  cleanup();
  setComponentWorkspace('viewer');
  view();
  assert.equal(screen.queryByRole('button', { name: /^Edit / }), null);
  assert.ok(screen.getByText('Rent'));
});
