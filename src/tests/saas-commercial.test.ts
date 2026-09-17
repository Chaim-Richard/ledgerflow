import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { isFeatureEnabled } from '../lib/featureFlags';
import { getTrialStatus } from '../lib/trialManager';
import { generateInviteToken } from '../lib/inviteManager';

describe('SaaS Commercial & Utilities Suite (Items 131 - 140)', () => {

  describe('1. Feature Flags Engine (Item 137)', () => {
    test('isFeatureEnabled enforces plan tier requirements', () => {
      assert.equal(isFeatureEnabled('multi_currency_revaluation', 'pro'), true);
      assert.equal(isFeatureEnabled('multi_currency_revaluation', 'starter'), false);
      assert.equal(isFeatureEnabled('forensic_hash_chaining', 'enterprise'), true);
      assert.equal(isFeatureEnabled('forensic_hash_chaining', 'pro'), false);
    });
  });

  describe('2. Trial Manager Lifecycle (Item 132)', () => {
    test('getTrialStatus accurately computes days remaining and expiration', () => {
      const activeSub = {
        planTier: 'free_trial' as const,
        trialEndsAt: '2026-10-01',
        status: 'active' as const
      };

      const statusActive = getTrialStatus(activeSub, '2026-09-17');
      assert.equal(statusActive.isTrial, true);
      assert.equal(statusActive.isExpired, false);
      assert.equal(statusActive.daysRemaining, 14);

      const statusExpired = getTrialStatus(activeSub, '2026-10-02');
      assert.equal(statusExpired.isTrial, true);
      assert.equal(statusExpired.isExpired, true);
      assert.equal(statusExpired.daysRemaining, 0);
    });
  });

  describe('3. Invite Token Manager (Item 140)', () => {
    test('generateInviteToken creates secure signed invite token', () => {
      const invite = generateInviteToken('ws_test', 'CPA@ACCOUNTING.COM');

      assert.equal(invite.workspaceId, 'ws_test');
      assert.equal(invite.email, 'cpa@accounting.com');
      assert.ok(invite.token.length > 20);
      assert.ok(new Date(invite.expiresAt).getTime() > Date.now());
    });
  });
});
