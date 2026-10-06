import './helpers/dom';
import test, { afterEach, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TwoStepLoginSettings } from '../components/platform/settings/SecuritySettings';
import { multiFactor, TotpMultiFactorGenerator } from '../lib/db/auth';
import { getSupabase } from '../lib/db/client';
import { useAuthStore } from '../stores/useAuthStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetch } from './helpers/dom';

type Factor = Awaited<ReturnType<ReturnType<typeof multiFactor>['getFactors']>>[number];
const factor = (id = 'phone-1', status: 'verified' | 'unverified' = 'verified'): Factor => ({ id, status, factor_type: 'totp', friendly_name: 'My phone', created_at: '2026-10-06', updated_at: '2026-10-06' });
let factors: Factor[];
let failure: 'list' | 'verify' | 'remove' | null;
let calls: Array<{ action: string; factorId?: string; code?: string }>;
const auth = getSupabase().auth;

beforeEach(() => {
  setComponentWorkspace('viewer'); // Personal MFA belongs to the signed-in user, including viewers.
  stubFetch(); factors = []; failure = null; calls = [];
  mock.method(auth, 'getUser', async () => ({ data: { user: { id: useAuthStore.getState().user?.uid } }, error: null }));
  mock.method(auth.mfa, 'listFactors', async () => ({ data: failure === 'list' ? null : { all: factors, totp: factors.filter(f => f.status === 'verified'), phone: [], webauthn: [], recovery_code: [] }, error: failure === 'list' ? new Error('Status request failed') : null }));
  mock.method(auth.mfa, 'enroll', async () => { calls.push({ action: 'enroll' }); factors.push(factor('new-phone', 'unverified')); return { data: { id: 'new-phone', totp: { secret: 'TEST-SETUP-KEY', uri: 'otpauth://totp/test', qr_code: 'data:image/svg+xml,%3Csvg/%3E' } }, error: null }; });
  mock.method(auth.mfa, 'challenge', async ({ factorId }: { factorId: string }) => { calls.push({ action: 'challenge', factorId }); return { data: { id: 'challenge-id' }, error: null }; });
  mock.method(auth.mfa, 'verify', async ({ factorId, code }: { factorId: string; code: string }) => { calls.push({ action: 'verify', factorId, code }); if (failure !== 'verify') factors = factors.map(f => f.id === factorId ? { ...f, status: 'verified' } : f); return { data: {}, error: failure === 'verify' ? new Error('Wrong code') : null }; });
  mock.method(auth.mfa, 'challengeAndVerify', async ({ factorId, code }: { factorId: string; code: string }) => { calls.push({ action: 'verify-removal', factorId, code }); return { data: {}, error: failure === 'verify' ? new Error('Wrong code') : null }; });
  mock.method(auth.mfa, 'unenroll', async ({ factorId }: { factorId: string }) => { calls.push({ action: 'unenroll', factorId }); if (failure !== 'remove') factors = factors.filter(f => f.id !== factorId); return { data: { id: factorId }, error: failure === 'remove' ? new Error('Removal refused') : null }; });
});
afterEach(async () => { cleanup(); mock.restoreAll(); await auth.dispose(); });
const click = async (name: string) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
const enter = (value: string) => fireEvent.change(screen.getByLabelText('Current 6-digit authenticator code'), { target: { value } });
const loaded = async () => waitFor(() => assert.ok(screen.queryByText(/Two-step login is (on|off)/)));

test('status lists verified and unfinished authenticators, and list errors do not claim two-step is off', async () => {
  factors = [factor(), factor('pending', 'unverified')];
  render(<TwoStepLoginSettings />); await loaded();
  assert.ok(screen.getByText('Two-step login is on (1 authenticator).'));
  assert.ok(screen.getByText('My phone — unfinished setup'));
  failure = 'list'; await click('Reload status');
  assert.match(screen.getByRole('alert').textContent || '', /Status request failed/);
  cleanup(); render(<TwoStepLoginSettings />);
  await screen.findByRole('alert');
  assert.ok(screen.queryByText('Two-step login is off.') === null);
});

test('enrollment needs a six-digit code, retains setup on refusal, and reloads saved factors after verification', async () => {
  render(<TwoStepLoginSettings />); await loaded(); await click('Add authenticator');
  assert.ok(screen.getByText('TEST-SETUP-KEY'));
  assert.equal(document.activeElement, screen.getByLabelText('Current 6-digit authenticator code'));
  enter('abc123'); assert.equal((screen.getByRole('button', { name: 'Verify and add' }) as HTMLButtonElement).disabled, true);
  failure = 'verify'; enter('012345'); await click('Verify and add');
  assert.match(screen.getByRole('alert').textContent || '', /Wrong code/);
  assert.ok(screen.getByText('TEST-SETUP-KEY'));
  failure = null; await click('Verify and add');
  assert.ok(screen.queryByText('TEST-SETUP-KEY') === null);
  assert.ok(screen.getByText('Two-step login is on (1 authenticator).'));
  assert.ok(screen.getByText('Authenticator added. Two-step login is on.'));
  assert.deepEqual(calls.map(c => c.action), ['enroll', 'challenge', 'verify', 'challenge', 'verify']);
  assert.equal(calls.at(-1)?.code, '012345');
});

test('removal verifies the selected current code before unenrolling, preserves errors, and shows off after the last factor', async () => {
  factors = [factor()]; render(<TwoStepLoginSettings />); await loaded(); await click('Remove My phone');
  assert.match(screen.getByText(/Removing your last/).textContent || '', /turns off/);
  enter('123456'); failure = 'verify'; await click('Verify and remove');
  assert.equal(calls.some(c => c.action === 'unenroll'), false);
  assert.match(screen.getByRole('alert').textContent || '', /Wrong code/);
  failure = 'remove'; await click('Verify and remove');
  assert.match(screen.getByRole('alert').textContent || '', /Removal refused/);
  assert.ok(screen.getByRole('button', { name: 'Verify and remove' }));
  failure = null; await click('Verify and remove');
  assert.ok(screen.getByText('Two-step login is off.'));
  assert.deepEqual(calls.slice(-2).map(c => c.action), ['verify-removal', 'unenroll']);
});

test('cancel removes only unverified setup, and verified factors cannot use the cancellation path', async () => {
  render(<TwoStepLoginSettings />); await loaded(); await click('Add authenticator'); await click('Cancel setup');
  assert.deepEqual(calls.map(c => c.action), ['enroll', 'unenroll']);
  assert.ok(screen.queryByText('TEST-SETUP-KEY') === null);
  factors = [factor()];
  await assert.rejects(multiFactor(useAuthStore.getState().user!).cancelEnrollment('phone-1'), /Only an unfinished/);
  assert.equal(calls.filter(c => c.action === 'unenroll').length, 1);
});

test('rapid enrollment clicks cannot create multiple factors', async () => {
  render(<TwoStepLoginSettings />); await loaded();
  await act(async () => { const button = screen.getByRole('button', { name: 'Add authenticator' }); fireEvent.click(button); fireEvent.click(button); });
  assert.equal(calls.filter(c => c.action === 'enroll').length, 1);
});

test('changing workspace or user clears setup secrets and ignores an old factor response', async () => {
  render(<TwoStepLoginSettings />); await loaded(); await click('Add authenticator');
  await act(async () => useAuthStore.setState({ currentWorkspaceId: 'other-workspace' }));
  assert.ok(screen.queryByText('TEST-SETUP-KEY') === null);
  const resolvers: Array<(value: unknown) => void> = [];
  mock.method(auth.mfa, 'listFactors', () => new Promise(r => { resolvers.push(r); }));
  await click('Reload status');
  await act(async () => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, uid: 'new-user' } }));
  await waitFor(() => assert.equal(resolvers.length, 2));
  await act(async () => { resolvers[0]({ data: { all: [factor('old-factor')], totp: [], phone: [] }, error: null }); });
  assert.equal(screen.queryByText(/My phone/), null, 'old account response does not populate new account');
  await act(async () => { resolvers[1]({ data: { all: [], totp: [], phone: [] }, error: null }); });
  assert.ok(screen.getByText('Two-step login is off.'));
  assert.ok(screen.queryByText('TEST-SETUP-KEY') === null);
});

test('auth helpers reject stale users, malformed codes and unknown factors without deleting anything', async () => {
  const oldUser = useAuthStore.getState().user!;
  factors = [factor()];
  await assert.rejects(multiFactor(oldUser).remove('phone-1', 'bad'), /6-digit/);
  await assert.rejects(multiFactor(oldUser).remove('other-factor', '123456'), /no longer enrolled/);
  useAuthStore.setState({ user: { ...oldUser, uid: 'new-user' } });
  await assert.rejects(multiFactor(oldUser).remove('phone-1', '123456'), /sign-in changed/);
  await assert.rejects(TotpMultiFactorGenerator.generateSecret({ userId: oldUser.uid }), /sign-in changed/);
  assert.equal(calls.length, 0);
});

test('guest or signed-out sessions do not expose MFA controls', () => {
  useAuthStore.setState({ isGuest: true }); render(<TwoStepLoginSettings />);
  assert.ok(screen.getByText('Sign in to manage your authenticators.'));
  assert.equal(screen.queryByRole('button', { name: 'Add authenticator' }), null);
});

test('a sign-in change during code verification prevents the subsequent deletion', async () => {
  const user = useAuthStore.getState().user!;
  factors = [factor()];
  mock.method(auth.mfa, 'challengeAndVerify', async () => {
    useAuthStore.setState({ user: { ...user, uid: 'new-user' } });
    return { data: {}, error: null };
  });
  await assert.rejects(multiFactor(user).remove('phone-1', '123456'), /sign-in changed/);
  assert.equal(calls.filter(c => c.action === 'unenroll').length, 0);
});
