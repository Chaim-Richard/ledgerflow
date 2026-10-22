/**
 * AUD-13: an answer that arrives after the signed-in account changed is dropped. The admin's token check is still on its
 * way → the admin signs out → a viewer signs in → the old answer ("admin") arrives: the viewer is not shown as admin.
 * The same for the forced token refresh (checkTokenAdminClaim) and for a profile read for the previous account. A new
 * account starts without the previous one's admin flag, profile or workspaces. identityScope (serverAction.ts) is the
 * shared check for screens: the same account and the same workspace.
 */
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAuthStore } from '../stores/useAuthStore';
import { identityScope } from '../lib/serverAction';

/** A signed-in account whose token answer the test releases when it wants. */
function account(uid: string, admin: boolean) {
  let release: () => void = () => {};
  const answered = new Promise<void>(resolve => { release = resolve; });
  const user = {
    uid,
    getIdTokenResult: async () => { await answered; return { claims: admin ? { admin: true } : {} }; },
    getIdToken: async () => 'token',
  };
  return { user: user as never, release };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => useAuthStore.setState({ user: null, isAdmin: false, userProfile: null, workspaces: [] }));

test('the admin signs out and a viewer signs in before the admin\'s token answer arrives: the viewer is not admin', async () => {
  const admin = account('admin-1', true);
  useAuthStore.getState().setUser(admin.user);
  useAuthStore.getState().setUser(null);
  const viewer = account('viewer-1', false);
  useAuthStore.getState().setUser(viewer.user);
  admin.release();
  await tick();
  assert.equal(useAuthStore.getState().isAdmin, false);
  viewer.release();
  await tick();
  assert.equal(useAuthStore.getState().isAdmin, false);
  assert.equal(useAuthStore.getState().user?.uid, 'viewer-1');
});

test('the same account again (a token refresh) keeps what it has; its own answer still counts', async () => {
  const admin = account('admin-1', true);
  useAuthStore.getState().setUser(admin.user);
  admin.release();
  await tick();
  assert.equal(useAuthStore.getState().isAdmin, true);
  useAuthStore.setState({ workspaces: [{ id: 'w1' } as never] });
  useAuthStore.getState().setUser(admin.user);
  assert.equal(useAuthStore.getState().workspaces.length, 1, 'the same uid: nothing is cleared');
});

test('another account starts without the previous one\'s admin flag, profile or workspaces', () => {
  useAuthStore.setState({ user: account('admin-1', true).user, isAdmin: true, userProfile: { uid: 'admin-1', role: 'admin' } as never, workspaces: [{ id: 'w1' } as never] });
  useAuthStore.getState().setUser(account('viewer-1', false).user);
  const s = useAuthStore.getState();
  assert.deepEqual([s.isAdmin, s.userProfile, s.workspaces], [false, null, []]);
});

test('a forced token check that answers after another sign-in does not set admin', async () => {
  const admin = account('admin-1', true);
  useAuthStore.setState({ user: admin.user });
  const checking = useAuthStore.getState().checkTokenAdminClaim();
  const viewer = account('viewer-1', false);
  useAuthStore.getState().setUser(viewer.user);
  admin.release();
  assert.equal(await checking, false);
  assert.equal(useAuthStore.getState().isAdmin, false);
});

test('a profile read for the previous account is not used', () => {
  useAuthStore.getState().setUser(account('viewer-1', false).user);
  useAuthStore.getState().setUserProfile({ uid: 'admin-1', role: 'admin' } as never);
  assert.deepEqual([useAuthStore.getState().userProfile, useAuthStore.getState().isAdmin], [null, false]);
  useAuthStore.getState().setUserProfile({ uid: 'viewer-1', role: 'client' } as never);
  assert.equal(useAuthStore.getState().userProfile?.uid, 'viewer-1');
});

test('identityScope: the same account and workspace, or the answer is stale', () => {
  let uid: string | null = 'u1';
  let ws: string | null = 'w1';
  const scope = identityScope(() => uid, () => ws);
  assert.equal(scope.isCurrent(), true);
  ws = 'w2';
  assert.equal(scope.isCurrent(), false, 'another workspace');
  ws = 'w1'; uid = 'u2';
  assert.equal(scope.isCurrent(), false, 'another account');
  uid = null;
  assert.equal(scope.isCurrent(), false, 'signed out');
});
