/**
 * The test files that need the test database skip themselves when LF_TEST_DATABASE_URL is not set, and a skipped
 * `describe` does not show in the final count — so a run without the database looked as complete as one with it
 * (audit 22 Oct, §7.6: 147 files then). This file makes that visible in the summary: without the database it is
 * one skipped test whose reason names how many files did not run; on CI (CI=true) a missing database fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dirs = ['src/tests', 'src/lib', 'src/server/utils'];
const needDatabase = dirs.flatMap(dir => fs.readdirSync(dir)
  .filter(f => /\.test\.tsx?$/.test(f))
  .map(f => path.join(dir, f))
  .filter(f => f !== path.join('src/tests', path.basename(import.meta.filename)) && fs.readFileSync(f, 'utf8').includes('LF_TEST_DATABASE_URL')));

const url = process.env.LF_TEST_DATABASE_URL;

test(`the ${needDatabase.length} database test files ran`, {
  skip: !url && !process.env.CI && `LF_TEST_DATABASE_URL not set: ${needDatabase.length} test files that need the database did NOT run (start it: top of docs/TRACKER.md)`,
}, () => {
  assert.ok(url, `LF_TEST_DATABASE_URL is not set on CI: ${needDatabase.length} database test files would be skipped`);
  assert.ok(needDatabase.length > 0, 'found the database test files');
});
