import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { generateInviteToken, verifyInviteTokenSignature } from '../lib/inviteManager.ts';
import { countWorkspaceOwners } from '../server/routes/workspaceRoutes.ts';
import { hasRoleAtLeast, WorkspaceRole } from '../hooks/useCurrentRole.ts';

describe('RBAC & Security Test Suite', () => {
  describe('Role Hierarchy Matrix', () => {
    test('Owner satisfies all role checks', () => {
      assert.equal(hasRoleAtLeast('owner', 'owner'), true);
      assert.equal(hasRoleAtLeast('owner', 'accountant'), true);
      assert.equal(hasRoleAtLeast('owner', 'bookkeeper'), true);
      assert.equal(hasRoleAtLeast('owner', 'viewer'), true);
    });

    test('Accountant satisfies accountant, bookkeeper, viewer; fails owner', () => {
      assert.equal(hasRoleAtLeast('accountant', 'owner'), false);
      assert.equal(hasRoleAtLeast('accountant', 'accountant'), true);
      assert.equal(hasRoleAtLeast('accountant', 'bookkeeper'), true);
      assert.equal(hasRoleAtLeast('accountant', 'viewer'), true);
    });

    test('Bookkeeper satisfies bookkeeper and viewer; fails accountant and owner', () => {
      assert.equal(hasRoleAtLeast('bookkeeper', 'owner'), false);
      assert.equal(hasRoleAtLeast('bookkeeper', 'accountant'), false);
      assert.equal(hasRoleAtLeast('bookkeeper', 'bookkeeper'), true);
      assert.equal(hasRoleAtLeast('bookkeeper', 'viewer'), true);
    });

    test('Viewer satisfies only viewer; fails all write roles', () => {
      assert.equal(hasRoleAtLeast('viewer', 'owner'), false);
      assert.equal(hasRoleAtLeast('viewer', 'accountant'), false);
      assert.equal(hasRoleAtLeast('viewer', 'bookkeeper'), false);
      assert.equal(hasRoleAtLeast('viewer', 'viewer'), true);
    });
  });

  describe('Cryptographic Invite Token Verification', () => {
    test('generates cryptographically signed invite tokens', () => {
      const invite = generateInviteToken('ws_test123', 'accountant@example.com', 'accountant');
      assert.ok(invite.id);
      assert.ok(invite.token);
      assert.ok(invite.signature);
      assert.equal(invite.workspaceId, 'ws_test123');
      assert.equal(invite.email, 'accountant@example.com');
      assert.equal(invite.role, 'accountant');
      assert.equal(invite.status, 'pending');
    });

    test('verifies valid invite token signature', () => {
      const invite = generateInviteToken('ws_test123', 'accountant@example.com', 'accountant');
      const isValid = verifyInviteTokenSignature(invite);
      assert.equal(isValid, true);
    });

    test('rejects tampered invite token payload or signature', () => {
      const invite = generateInviteToken('ws_test123', 'accountant@example.com', 'accountant');
      const tamperedInvite = { ...invite, role: 'owner' as WorkspaceRole };
      const isValid = verifyInviteTokenSignature(tamperedInvite);
      assert.equal(isValid, false);
    });

    test('rejects forged token signature', () => {
      const invite = generateInviteToken('ws_test123', 'accountant@example.com', 'accountant');
      const forgedInvite = { ...invite, token: '0000000000000000000000000000000000000000000000000000000000000000', signature: '0000000000000000000000000000000000000000' };
      const isValid = verifyInviteTokenSignature(forgedInvite);
      assert.equal(isValid, false);
    });
  });

  describe('Last Owner Demotion Protection', () => {
    test('detects single primary owner workspace', () => {
      const wsData = { uid: 'user_owner_1', roles: { user_owner_1: 'owner', user_acc: 'accountant' } };
      const { count, ownerUids } = countWorkspaceOwners(wsData);
      assert.equal(count, 1);
      assert.deepEqual(ownerUids, ['user_owner_1']);
    });

    test('detects multiple co-owners workspace', () => {
      const wsData = {
        uid: 'user_owner_1',
        roles: {
          user_owner_1: 'owner',
          user_owner_2: 'owner',
          user_bk: 'bookkeeper'
        }
      };
      const { count, ownerUids } = countWorkspaceOwners(wsData);
      assert.equal(count, 2);
      assert.equal(ownerUids.includes('user_owner_1'), true);
      assert.equal(ownerUids.includes('user_owner_2'), true);
    });
  });
});
