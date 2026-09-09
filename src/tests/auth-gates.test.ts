import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { isSystemJobAuthorized } from '../server/auth/systemJobAuth.ts';

describe('System Cron & System Job Auth Gates Test Suite', () => {
  test('rejects decoded token with only uid (non-admin regular user)', () => {
    const regularUserToken = { uid: 'user_abc123' };
    const authorized = isSystemJobAuthorized(regularUserToken, undefined, 'my_cron_secret');
    assert.equal(authorized, false);
  });

  test('rejects decoded token with only uid even if providedSecret is incorrect', () => {
    const regularUserToken = { uid: 'user_abc123' };
    const authorized = isSystemJobAuthorized(regularUserToken, 'wrong_secret', 'my_cron_secret');
    assert.equal(authorized, false);
  });

  test('accepts decoded token with admin custom claim (admin: true)', () => {
    const adminToken = { uid: 'admin_123', admin: true };
    const authorized = isSystemJobAuthorized(adminToken, undefined, 'my_cron_secret');
    assert.equal(authorized, true);
  });

  test('accepts decoded token with role: "admin"', () => {
    const adminToken = { uid: 'admin_123', role: 'admin' };
    const authorized = isSystemJobAuthorized(adminToken, undefined, 'my_cron_secret');
    assert.equal(authorized, true);
  });

  test('accepts matching x-cron-secret header', () => {
    const authorized = isSystemJobAuthorized(null, 'secret_xyz', 'secret_xyz');
    assert.equal(authorized, true);
  });

  test('rejects x-cron-secret header when CRON_SECRET is unset', () => {
    const authorized = isSystemJobAuthorized(null, 'secret_xyz', undefined);
    assert.equal(authorized, false);
  });

  test('rejects mismatched x-cron-secret header', () => {
    const authorized = isSystemJobAuthorized(null, 'attacker_secret', 'real_secret');
    assert.equal(authorized, false);
  });
});
