import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scan, scanFinancialIntegrity, counts, type Kind } from '../../scripts/bug-patterns';
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

// An aggregate ratchet alone is insufficient: a newly introduced risk can replace an old
// finding with no rise in the total. Track the number of findings at EACH function and file.
test('no new client risk at an existing or previously clean function', () => {
  const siteBaseline = JSON.parse(fs.readFileSync('bug-patterns-sites.json', 'utf8')) as Record<string, number>;
  const current: Record<string, number> = {};
  for (const f of found) {
    const key = [f.kind, f.file, f.name].join('|');
    current[key] = (current[key] || 0) + 1;
  }
  const additions = Object.entries(current)
    .filter(([key, n]) => n > (siteBaseline[key] ?? 0))
    .map(([key, n]) => `${key}: ${n} > ${siteBaseline[key] ?? 0}`);
  assert.deepEqual(additions, [], 'New locations need a fix, not an increased baseline');
});

test('financial scanner detects each #112–#114 failure mechanism and SQL trust boundary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-scanner-'));
  try {
    const put = (file: string, text: string) => {
      const dest = path.join(root, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text);
    };
    put('src/server/routes/transactions/bulkRoutes.ts', `
      async function bulk(batch: any, ref: any, updates: any[]) {
        for (const updateData of updates) {
          batch.update(ref, { ...updateData, updatedAt: new Date() });
          await batch.commit();
        }
      }`);
    put('src/server/routes/paymentRoutes.ts', `
      async function payment(db: any, payload: any) { return createPaymentAtomic(db, payload); }`);
    put('supabase/migrations/2026_guard.sql', `
      create function public.lf_guard() returns trigger as $
      begin
        if not public.lf_is_client() then return coalesce(new,old); end if;
      end; $ language plpgsql;`);
    const risks = scanFinancialIntegrity(root);
    for (const kind of ['server-unrestricted-ledger-patch', 'server-partial-batch-commit',
      'server-unkeyed-payment-path', 'sql-trusted-server-exemption']) {
      assert.ok(risks.some(f => f.kind === kind), `Scanner missed ${kind}`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('financial scanner reads the real server and migration tree (not just screen code)', () => {
  const risks = scanFinancialIntegrity();
  assert.ok(risks.some(f => f.file.startsWith('src/server/')), 'Server was not scanned');
  assert.ok(risks.some(f => f.file.startsWith('supabase/migrations/')), 'SQL migrations were not scanned');
  // The three known high-risk endpoints must remain explicitly in view until their code is
  // made safe; after fixing each, move its scenario into a database integration test.
  assert.ok(risks.some(f => f.issue === 112), '#112 batch field validation not detected');
  assert.ok(risks.some(f => f.issue === 113), '#113 multi-chunk commits not detected');
  assert.ok(risks.some(f => f.issue === 114), '#114 backwards-compatible unkeyed payment path not detected');
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
