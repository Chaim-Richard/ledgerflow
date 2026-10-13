import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scan, counts, type Kind } from '../../scripts/bug-patterns';
import { runOnce, workspaceScope, attempt, allSettledWrites } from '../lib/serverAction';

const found = scan();

test('bug-pattern counts never rise (fix one → lower bug-patterns-baseline.json with --write-baseline)', () => {
  const baseline = JSON.parse(fs.readFileSync('bug-patterns-baseline.json', 'utf8')) as Record<Kind, number>;
  const now = counts(found);
  for (const kind of Object.keys(now) as Kind[]) {
    assert.ok(now[kind] <= (baseline[kind] ?? 0),
      `${kind}: ${now[kind]} > baseline ${baseline[kind] ?? 0}. New places:\n` +
      found.filter(f => f.kind === kind).map(f => `  ${f.file}:${f.line} ${f.name}`).join('\n'));
  }
});

// The scanner must keep finding the code behind the public issues it was built from, until they are fixed.
const ISSUE_SITES: Array<[issue: number, file: string]> = [
  [97, 'src/components/collaboration/TimeView.tsx'],
  [99, 'src/components/collaboration/TimeTimer.tsx'],
  [100, 'src/hooks/useLedgerData.ts'],
  [102, 'src/components/ledger/StatementImporter.tsx'],
  [107, 'src/hooks/transactionActions/shared.ts'],
  [109, 'src/services/bulkDocumentActions.ts'],
  [110, 'src/hooks/transactionActions/importActions.ts'],
  [111, 'src/hooks/transactionActions/entryActions.ts'], // also #105, #108 (bulk update)
];
test('the scanner finds the code named in issues #97–#111', () => {
  const files = new Set(found.map(f => f.file));
  const missed = ISSUE_SITES.filter(([, file]) => fs.existsSync(file) && !files.has(file));
  assert.deepEqual(missed, [], 'scanner no longer flags these issue sites (fixed? remove them from ISSUE_SITES)');
});

test('runOnce: a second click while saving reuses the first request', async () => {
  let calls = 0;
  const slow = () => new Promise<number>(r => setTimeout(() => r(++calls), 10));
  const [a, b] = await Promise.all([runOnce('k', slow), runOnce('k', slow)]);
  assert.equal(calls, 1); assert.equal(a, b);
  await runOnce('k', slow); assert.equal(calls, 2);
});

test('workspaceScope: results after a book switch are recognised as stale', () => {
  let ws = 'A';
  const scope = workspaceScope(() => ws);
  assert.equal(scope.isCurrent(), true);
  ws = 'B';
  assert.equal(scope.isCurrent(), false);
});

test('attempt and allSettledWrites report failures instead of hiding them', async () => {
  assert.deepEqual(await attempt(async () => { throw new Error('refused'); }), { ok: false, error: 'refused' });
  const r = await allSettledWrites([1, 2, 3], async n => { if (n === 2) throw new Error('no'); return n; });
  assert.equal(r.allOk, false);
  assert.deepEqual(r.done.map(d => d.item), [1, 3]);
  assert.deepEqual(r.failures, [{ item: 2, error: 'no' }]);
});
