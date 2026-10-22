/**
 * L-94: the browser sends the day it counted as today; the server (which builds document entries itself since
 * L94-STEP2B) uses it when it is a real date within one day of the server's own (a browser in another time zone near
 * midnight), else its own. The day is not part of the idempotency hash: a retry after midnight is the same save.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { agreedPostingDay } from '../server/services/postingContextLoader';

test('L-94: the browser\'s day is used within one day of the server\'s, never further', () => {
  assert.equal(agreedPostingDay('2026-10-22', '2026-10-21'), '2026-10-21', 'Los Angeles, before midnight');
  assert.equal(agreedPostingDay('2026-10-22', '2026-10-23'), '2026-10-23', 'Auckland, after midnight');
  assert.equal(agreedPostingDay('2026-12-31', '2027-01-01'), '2027-01-01', 'across the year end');
  assert.equal(agreedPostingDay('2026-10-22', '2026-10-20'), '2026-10-22', 'two days apart: the server\'s');
  assert.equal(agreedPostingDay('2026-10-22', undefined), '2026-10-22', 'an older browser sends none');
  assert.equal(agreedPostingDay('2026-10-22', '2026-13-01'), '2026-10-22', 'not a date');
  assert.equal(agreedPostingDay('2026-10-22', '22/10/2026'), '2026-10-22', 'not the ISO form');
  assert.equal(agreedPostingDay('2026-10-22', 20261022), '2026-10-22', 'not a string');
});

test('L-94 guard: the browser sends its day; the server builds with it; neither route hashes it', () => {
  const kit = fs.readFileSync('src/services/ledgerPost/postingKit.ts', 'utf8');
  assert.equal((kit.match(/postingDay: postingToday\(context\)/g) || []).length, 2, 'to /transactions/bulk and to /documents/:type/:id/post');
  const route = fs.readFileSync('src/server/routes/transactions/bulkRoutes.ts', 'utf8');
  assert.match(route, /postingDay: _day, \.\.\.hashed/);
  assert.match(route, /hashOf: hashed/);
  const service = fs.readFileSync('src/server/services/documentPostService.ts', 'utf8');
  assert.match(service, /context\.today = agreedPostingDay\(/);
  assert.match(service, /const hashOf = \{ collection, docId, workspaceId, action, data: input\.data \}/, 'the day is not hashed');
});
