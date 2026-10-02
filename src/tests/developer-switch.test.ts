/**
 * FOR_YOU 11 / L-91: screens on made-up data only show with the developer switch on, and the
 * fake "success" API endpoints are gone.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { serverSource } from './helpers/serverSource';
import { isTabVisible } from '../config/tabVisibility';

describe('Developer switch', () => {
  test('the Admin Panel (simulated logs) is hidden unless the switch is on', () => {
    const registry = readFileSync('src/config/registry.tsx', 'utf8');
    assert.match(registry, /id: 'system-command-center'[^\n]*developerOnly: true/);
    const admin = { requiresOwner: true, developerOnly: true };
    assert.equal(isTabVisible(admin, { isOwner: true, isProMode: true, developerMode: false }), false);
    assert.equal(isTabVisible(admin, { isOwner: true, isProMode: false, developerMode: true }), true);
    assert.equal(isTabVisible({}, { isOwner: false, isProMode: false, developerMode: false }), true);
  });

  test('no fake success endpoints on the server', () => {
    const server = serverSource();
    for (const path of ['ecommerce', 'marketing', 'helpdesk', 'hr', 'manufacturing', 'universal-ops']) {
      const route = ['', 'api', 'v1', path].join('/');
      assert.ok(!server.includes(`"${route}"`), `${route} is still there`);
    }
  });
});
