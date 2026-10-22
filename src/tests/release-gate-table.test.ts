/**
 * The workflow table in docs/RELEASE_GATE.md is the one source of truth for stage A (audit 22 Oct, §7.8): each
 * workflow W1…W14 has exactly one row (a merge once left a stale second copy, and the two disagreed), and
 * CURRENT_WORK.md never lists a workflow both as open and as done.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const gate = fs.readFileSync('docs/RELEASE_GATE.md', 'utf8');
const work = fs.readFileSync('CURRENT_WORK.md', 'utf8');

test('RELEASE_GATE: every workflow W1…W14 has exactly one row', () => {
  const rows = [...gate.matchAll(/^\| (W\d+) \|/gm)].map(m => m[1]);
  const counts = new Map<string, number>();
  for (const id of rows) counts.set(id, (counts.get(id) || 0) + 1);
  const expected = Array.from({ length: 14 }, (_, i) => `W${i + 1}`);
  assert.deepEqual([...counts.keys()].sort(), [...expected].sort(), 'W1…W14, none missing, none extra');
  assert.deepEqual([...counts].filter(([, n]) => n > 1), [], 'no workflow twice');
});

test('CURRENT_WORK: a workflow is either still open or done for A, never both', () => {
  const doneRow = /^\| Done for A \| (.*?) \|/m.exec(work)?.[1] || '';
  const done = new Set([...doneRow.matchAll(/\bW\d+\b/g)].map(m => m[0]));
  const open = [...work.matchAll(/^\| (W\d+) [^|]*\|/gm)].map(m => m[1]);
  assert.ok(done.size > 0, 'the "Done for A" row is there');
  assert.deepEqual(open.filter(id => done.has(id)), []);
});
