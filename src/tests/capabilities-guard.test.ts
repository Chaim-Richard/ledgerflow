/**
 * The "what works today" table (DA-05, docs/CAPABILITIES.md) stays true: each row has exactly one of
 * the six labels, every file it names as evidence exists, and every "Available" row names a test.
 * A row that loses its evidence fails here instead of quietly over-claiming.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const LABELS = ['Available', 'Available with limits', 'Partial', 'Internal, test or demo only', 'Planned', 'Needs an owner decision'];
const root = process.cwd();
const table = fs.readFileSync(path.join(root, 'docs/CAPABILITIES.md'), 'utf8');
const rows = table.split('\n').filter(l => /^\| \d+ \|/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));

/** every file under these folders, by name (evidence may give a bare file name) */
function filesByName(): Set<string> {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full); else { names.add(e.name); names.add(path.relative(root, full)); }
    }
  };
  for (const dir of ['src', 'e2e', 'supabase', 'docs', 'scripts']) if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  names.add('server.ts');
  return names;
}

test('every row has one of the six labels', () => {
  assert.ok(rows.length >= 90, 'the table has its rows');
  for (const [n, cap, label] of rows) assert.ok(LABELS.includes(label), `row ${n} (${cap}): "${label}" is not a label`);
});

test('every file named as evidence exists', () => {
  const names = filesByName();
  const missing: string[] = [];
  for (const [n, , , evidence] of rows) {
    for (const m of evidence.matchAll(/`([^`]+)`/g)) {
      const ref = m[1];
      if (!/\.(tsx?|sql|md|mjs)$/.test(ref)) continue;
      if (!names.has(ref) && !names.has(path.basename(ref))) missing.push(`row ${n}: ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every Available row names a test', () => {
  for (const [n, cap, label, evidence] of rows) {
    if (label !== 'Available') continue;
    assert.match(evidence, /\.(test|spec)\.tsx?`|RLS suite|RLS tests/, `row ${n} (${cap}) is Available without a test`);
  }
});
