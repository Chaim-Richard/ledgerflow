/**
 * requireWorkspaceRole checks one workspace (the address's, else the body's, else the query's). A request that names
 * two different workspaces is refused before any check, so a route can never read a workspace other than the one
 * checked (found in the stock-closing GET, #375: membership checked for the body's workspace, data read for the query's).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type express from 'express';
import { requireWorkspaceRole } from '../server/routes/workspaceRoutes';

function run(req: { params?: Record<string, string>; body?: unknown; query?: Record<string, string> }) {
  let status = 0;
  let body: unknown;
  let nextCalled = false;
  const res = { status(code: number) { status = code; return this; }, json(b: unknown) { body = b; return this; } } as unknown as express.Response;
  const request = { params: req.params || {}, body: req.body, query: req.query || {}, user: { uid: 'u1' } } as unknown as express.Request;
  return requireWorkspaceRole(['owner']).call(null, request, res, () => { nextCalled = true; })!.then(() => ({ status, body, nextCalled }));
}

test('two different workspaces in one request are refused (400) before the membership check', async () => {
  for (const req of [
    { body: { workspaceId: 'mine' }, query: { workspaceId: 'theirs' } },
    { params: { workspaceId: 'mine' }, query: { workspaceId: 'theirs' } },
    { params: { workspaceId: 'mine' }, body: { workspaceId: 'theirs' } },
  ]) {
    const r = await run(req);
    assert.equal(r.status, 400, JSON.stringify(req));
    assert.match(JSON.stringify(r.body), /two different workspaces/);
    assert.equal(r.nextCalled, false);
  }
});

test('the same workspace named twice, or only once, goes on to the membership check (not refused as two)', async () => {
  for (const req of [
    { body: { workspaceId: 'ws' }, query: { workspaceId: 'ws' } },
    { query: { workspaceId: 'ws' } },
    { params: { workspaceId: 'ws' }, body: {} },
  ]) {
    const r = await run(req);
    assert.doesNotMatch(JSON.stringify(r.body ?? ''), /two different workspaces/, JSON.stringify(req));
  }
});
