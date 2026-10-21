import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import PlaidConnectButton from '../components/finance/PlaidConnectButton';
import { auth } from '../firebase';
import { getSupabase } from '../lib/db/client';
import { useAuthStore } from '../stores/useAuthStore';
import { setComponentWorkspace } from './helpers/componentFixtures';

const originalFetch = globalThis.fetch;
afterEach(async () => {
  cleanup(); globalThis.fetch = originalFetch;
  getSupabase().realtime.disconnect(); await getSupabase().auth.dispose();
});

test('an unmounted reconnect never requests a link token after delayed authentication', async () => {
  setComponentWorkspace('bookkeeper');
  const previousUser = auth.currentUser;
  let finish!: (value: string) => void;
  let tokenRequested = false;
  auth.currentUser = { ...useAuthStore.getState().user!, getIdToken: () => {
    tokenRequested = true;
    return new Promise<string>(resolve => { finish = resolve; });
  } };
  const calls: string[] = [];
  globalThis.fetch = async input => { calls.push(String(input)); return new Response('{}'); };
  try {
    const view = render(<PlaidConnectButton bankId="existing-bank" />);
    assert.equal(tokenRequested, false, 'nothing is requested before the button is pressed');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect bank' }));
    assert.equal(tokenRequested, true);
    view.unmount();
    await act(async () => { finish('delayed-token'); });
    assert.deepEqual(calls, [], 'obsolete authentication must not start a request');
  } finally { auth.currentUser = previousUser; }
});

test('changing workspace aborts an in-flight link request and requests only the new scope', async () => {
  setComponentWorkspace();
  const calls: { body: Record<string, unknown>; signal: AbortSignal }[] = [];
  globalThis.fetch = async (_input, init) => {
    calls.push({ body: JSON.parse(String(init?.body)), signal: init!.signal! });
    return new Promise<Response>(() => {});
  };
  const view = render(<PlaidConnectButton bankId="existing-bank" />);
  await act(async () => { await Promise.resolve(); });
  assert.equal(calls.length, 0, 'no link token (and no Plaid script) until the button is pressed');
  fireEvent.click(screen.getByRole('button', { name: 'Reconnect bank' }));
  await act(async () => { await Promise.resolve(); });
  assert.equal(calls.length, 1);
  await act(async () => { useAuthStore.setState({ currentWorkspaceId: 'next-workspace' }); });
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(calls[1].body, { workspaceId: 'next-workspace', bankId: 'existing-bank' });
  view.unmount();
  assert.equal(calls[1].signal.aborted, true);
});
