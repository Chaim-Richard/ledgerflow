/**
 * D-88: the Banking screen's three states, each with one action.
 *  - while the chart of accounts is on its way: LoadingState (its actions stay usable);
 *  - the chart could not be read: what failed and "Try again", which asks for it again;
 *  - nothing yet: EmptyState with the one control that fills the screen (connect a bank);
 *  - the connections list itself: loading, and a failed read with its own "Try again".
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Banking from '../components/banking/Banking';
import ConnectedBanks from '../components/banking/ConnectedBanks';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetch } from './helpers/dom';
import { makeChartAccount } from './fixtures';
import type { ChartAccount } from '../types';

const bankAccount = (overrides?: Partial<ChartAccount>) => makeChartAccount({ id: 'bank-1', name: 'Operating Checking', type: 'asset', subtype: 'bank', ...overrides });

beforeEach(() => {
  setComponentWorkspace();
  stubFetch(200, { banks: [] });
  useLedgerStore.setState({ accounts: [], transactions: [] });
  useDataNeedsStore.setState({ asked: [], loaded: {}, failed: {}, loadedWorkspaceId: null });
});
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

test('while the chart of accounts loads, the screen says so and its actions stay reachable', () => {
  render(<Banking />);
  assert.ok(screen.getAllByRole('status').some(el => /Loading bank accounts/.test(el.textContent || '')));
  assert.ok(screen.getByRole('button', { name: 'Import statement' }), 'the header actions are not blocked by the loading state');
});

test('a chart of accounts that could not be read says what failed and offers one action, "Try again"', async () => {
  useDataNeedsStore.setState({ failed: { accounts: 'network unreachable' } });
  render(<Banking />);
  const alert = screen.getByRole('alert');
  assert.match(alert.textContent || '', /couldn't load your bank accounts/);
  assert.equal(screen.queryByRole('button', { name: 'Sync Feed' }), null);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })); });
  assert.equal(useDataNeedsStore.getState().failed.accounts, undefined, 'the retry asks for the accounts again');
  assert.ok(screen.getAllByRole('status').some(el => /Loading bank accounts/.test(el.textContent || '')), 'and the screen goes back to loading');
});

test('a demo (no database) is never left waiting: it shows the empty state at once', () => {
  useAuthStore.setState({ isGuest: true, user: null, currentWorkspaceId: 'demo' });
  render(<Banking />);
  assert.equal(screen.queryAllByRole('status').length, 0, 'nothing is "loading" without a database');
  assert.ok(screen.getByText('No bank accounts yet'));
});

test('no bank accounts yet: one empty state and the one control that fills it', () => {
  useDataNeedsStore.setState({ loaded: { accounts: true } });
  render(<Banking />);
  assert.ok(screen.getByText('No bank accounts yet'));
  assert.match(screen.getByText(/Connect a bank to bring its transactions in/).textContent || '', /import a statement/);
  const actions = screen.getAllByRole('button').filter(b => !['Import statement', 'Money in', 'Money out', 'Transfer Funds', 'Make deposit'].includes(b.textContent?.trim() || ''));
  assert.deepEqual(actions.map(b => b.textContent?.trim()), ['Connect Bank'], 'exactly one action in the empty state');
});

test('with a bank account, the card shows its ledger code and the sync action', () => {
  useDataNeedsStore.setState({ loaded: { accounts: true } });
  useLedgerStore.setState({ accounts: [bankAccount({ code: '1010' })] });
  render(<Banking />);
  assert.ok(screen.getByText('Operating Checking'));
  assert.ok(screen.getByText('Acct 1010'));
  assert.ok(screen.getByRole('button', { name: /Sync Feed/ }));
  assert.equal(screen.queryByText('No bank accounts yet'), null);
});

test('the connections list shows a loading state, and a failed read offers "Try again" that reads again', async () => {
  let finish: ((value: Response) => void) | undefined;
  const asked: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL) => {
    asked.push(String(input));
    return new Promise<Response>(resolve => { finish = resolve; });
  }) as typeof fetch;
  render(<ConnectedBanks />);
  await act(async () => {}); // the request starts after the signed-in token resolves
  assert.match(screen.getByRole('status').textContent || '', /Loading bank connections/);
  await act(async () => { finish?.(new Response(JSON.stringify({ banks: [] }), { status: 500 })); });
  const alert = screen.getByRole('alert');
  assert.match(alert.textContent || '', /couldn't check your bank connections/);
  assert.match(alert.textContent || '', /could not list your bank connections/);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })); });
  assert.equal(asked.length, 2, 'Try again asks the server once more');
  assert.match(screen.getByRole('status').textContent || '', /Loading bank connections/);
});

test('the connections list renders nothing when the workspace has no connections', async () => {
  render(<ConnectedBanks />);
  await act(async () => {});
  assert.equal(document.querySelector('[aria-labelledby="connected-banks-title"]'), null);
  assert.equal(screen.queryByRole('alert'), null);
});
