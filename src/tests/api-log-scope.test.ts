import test from 'node:test';
import assert from 'node:assert/strict';
import { apiLogsForWorkspace } from '../server/http/apiRequestLog';
import type { ApiLog } from '../server/http/serverKit';

const log = (id: string, workspaceId?: string): ApiLog => ({
  id, workspaceId, timestamp: '2026-10-11T20:00:00.000Z',
  method: 'GET', path: '/api/v1/reports', statusCode: 200,
  latencyMs: 1, apiKeyUsed: 'Key: sample', ip: '127.0.0.1',
});

test('Developer Hub logs never include entries from a different workspace or unknown scope', () => {
  const logs = [
    log('own', 'ws_alpha'), log('other', 'ws_beta'),
    log('global'), log('prefix-lookalike', 'ws_alpha_other'),
  ];
  assert.deepEqual(apiLogsForWorkspace(logs, 'ws_alpha').map(l => l.id), ['own']);
  assert.deepEqual(apiLogsForWorkspace(logs, 'ws_beta').map(l => l.id), ['other']);
  assert.deepEqual(apiLogsForWorkspace(logs, 'no-such-workspace'), []);
});
