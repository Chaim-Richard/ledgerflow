/**
 * L-94 (before enforcing): the browser sends the day it counted as today; the server's shadow rebuild uses it when it
 * is a real date within one day of the server's own (a browser in another time zone near midnight), else its own.
 * The day is not part of the idempotency hash: a retry after midnight is the same save.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { agreedPostingDay } from '../server/services/postingShadowCheck';

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

test('L-94 guard: the browser sends its day, and the bulk route leaves it out of the idempotency hash', () => {
  assert.match(fs.readFileSync('src/services/ledgerPost/postingKit.ts', 'utf8'), /postingDay: postingToday\(context\)/);
  const route = fs.readFileSync('src/server/routes/transactions/bulkRoutes.ts', 'utf8');
  assert.match(route, /postingDay: _day, \.\.\.hashed/);
  assert.match(route, /hashOf: hashed/);
  assert.match(route, /posted: transactions, postingDay \}/);
});
