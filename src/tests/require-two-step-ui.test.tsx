/**
 * Two-step login for everyone in a workspace (Y-30) on screen: the setup screen says which workspace
 * asks for it and offers the authenticator setup; owners switch the requirement in Settings → Security
 * (the server's refusal is shown); others do not see the switch.
 */
import './helpers/dom';
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TwoStepSetupScreen from '../core/auth/TwoStepSetupScreen';
import RequireTwoStepPanel from '../components/platform/settings/RequireTwoStepPanel';
import { getSupabase } from '../lib/db/client';
import { useAuthStore } from '../stores/useAuthStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';

const auth = getSupabase().auth;
afterEach(async () => { cleanup(); mock.restoreAll(); getSupabase().realtime.disconnect(); await auth.dispose(); });

test('the setup screen names the workspaces that ask for it and offers the authenticator setup', async () => {
  setComponentWorkspace('accountant');
  mock.method(auth, 'getUser', async () => ({ data: { user: { id: useAuthStore.getState().user?.uid } }, error: null }));
  mock.method(auth.mfa, 'listFactors', async () => ({ data: { all: [], totp: [], phone: [], webauthn: [], recovery_code: [] }, error: null }));
  let continued = 0;
  render(<TwoStepSetupScreen workspaces={[{ id: 'a', name: 'Acme Books' }, { id: 'b', name: 'Beta LLC' }]} onContinue={() => { continued++; }} onSignOut={() => {}} />);
  assert.ok(screen.getByRole('heading', { level: 1, name: /Set up two-step login/ }));
  assert.ok(screen.getByText(/Acme Books and Beta LLC require two-step login/));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Add authenticator' })));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  assert.equal(continued, 1);
});

test('an owner turns it on; the server\'s refusal is shown and nothing changes', async () => {
  setComponentWorkspace('owner');
  const refused = stubFetchWithBodies(409, { message: 'Turn on two-step login for your own account first (Settings → Security), then sign in again with a code' });
  render(<RequireTwoStepPanel />);
  const box = screen.getByRole('checkbox', { name: /must use two-step login/ }) as HTMLInputElement;
  await act(async () => { fireEvent.click(box); });
  await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /your own account first/));
  assert.equal(useAuthStore.getState().workspaces[0].requireTwoStep, undefined);
  assert.deepEqual([refused[0].method, refused[0].body], ['PUT', { required: true }]);
  assert.match(refused[0].url, /\/api\/v1\/workspaces\/component-workspace\/security\/two-step$/);

  stubFetchWithBodies(200, { status: 'success', required: true });
  await act(async () => { fireEvent.click(box); });
  await waitFor(() => assert.equal(useAuthStore.getState().workspaces[0].requireTwoStep, true));
  assert.equal((screen.getByRole('checkbox', { name: /must use two-step login/ }) as HTMLInputElement).checked, true);
});

test('only owners see the switch', () => {
  setComponentWorkspace('accountant');
  render(<RequireTwoStepPanel />);
  assert.equal(screen.queryByRole('checkbox', { name: /must use two-step login/ }), null);
});
