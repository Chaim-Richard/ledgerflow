/**
 * The server connects to the database with a privileged login, so the database's row security
 * does not protect server routes: each write route must check the workspace role itself.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type express from 'express';
import { LEDGER_WRITER_ROLES, roleInWorkspace, targetWorkspaces } from '../server/middleware/requireLedgerWriter';

import { serverSource } from './helpers/serverSource';

// server.ts plus the helpers and route files it was split into (F-01)
const server = serverSource();

describe('Server write roles', () => {
  test('role from the workspace document', () => {
    const ws = { uid: 'owner-1', roles: { 'a-1': 'accountant', 'v-1': 'viewer', odd: 42 } };
    assert.equal(roleInWorkspace(ws, 'owner-1'), 'owner');
    assert.equal(roleInWorkspace(ws, 'a-1'), 'accountant');
    assert.equal(roleInWorkspace(ws, 'v-1'), 'viewer');
    assert.equal(roleInWorkspace(ws, 'odd'), 'viewer');
    assert.equal(roleInWorkspace(ws, 'stranger'), 'viewer');
    assert.equal(roleInWorkspace(undefined, 'owner-1'), 'viewer');
    assert.ok(!LEDGER_WRITER_ROLES.includes('viewer'));
  });

  test('every workspace a ledger write names is checked, not just the first', async () => {
    const req = {
      method: 'POST', path: '/bulk', query: { workspaceId: 'ws-q' },
      body: { workspaceId: 'ws-a', transaction: { workspaceId: 'ws-b' }, transactions: [{ workspaceId: 'ws-c' }, null] },
      user: { uid: 'u', developerWorkspaceId: 'ws-key' },
    } as unknown as express.Request;
    assert.deepEqual([...await targetWorkspaces(req)].sort(), ['ws-a', 'ws-b', 'ws-c', 'ws-key', 'ws-q']);
  });

  test('server.ts: writes through authorizeWorkspace need a writer role', () => {
    assert.match(server, /if \(isMutation && !LEDGER_WRITER_ROLES\.includes\(roleInWorkspace\(data, req\.user\.uid\)\)\)/);
  });

  test('server.ts: members and API keys are owner-only', () => {
    assert.match(server, /app\.post\("\/api\/v1\/workspaces\/:workspaceId\/members", apiAuthenticate, requireWorkspaceRole\(\['owner'\]\)/);
    assert.match(server, /app\.delete\("\/api\/v1\/workspaces\/:workspaceId\/members\/:memberUid", apiAuthenticate, requireWorkspaceRole\(\['owner'\]\)/);
    assert.match(server, /app\.post\("\/api\/v1\/keys\/provision", authenticate, requireWorkspaceRole\(\['owner'\]\)/);
  });

  test('server.ts: a permission error is never reported as success', () => {
    assert.doesNotMatch(server, /isIamConstraintError/);
    assert.doesNotMatch(server, /message: "Handled"/);
  });

  test("server.ts: labeling with a workspace's accounts and rules needs membership", () => {
    const start = server.search(/app\.post\("\/api\/v1\/label-transactions"/);
    assert.ok(start > 0);
    assert.match(server.slice(start, start + 1500), /await assertWorkspaceAccess\(db, finalWorkspaceId, /);
  });

  test('billing changes (checkout, portal, confirming a payment) are owner-only', () => {
    const billing = fs.readFileSync('src/server/routes/billingRoutes.ts', 'utf8');
    for (const route of ['/checkout', '/portal', '/verify-session']) {
      const start = billing.indexOf(`billingRouter.post("${route}"`);
      const next = billing.indexOf('billingRouter.', start + 10);
      assert.match(billing.slice(start, next), /await authorizeWorkspace\(requestUser\(req\), workspaceId, \['owner'\]\)/, route);
    }
  });

  test('transactions router checks roles before any handler', () => {
    const routes = fs.readFileSync('src/server/routes/transactionRoutes.ts', 'utf8');
    const use = routes.indexOf('transactionRouter.use(requireLedgerWriter);');
    const firstRoute = routes.search(/transactionRouter\.(get|post|put|patch|delete)\(/);
    assert.ok(use > 0 && use < firstRoute);
  });
});
