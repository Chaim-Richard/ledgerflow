import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileImportCounts } from '../lib/importCountReconciliation';
import { normalizeQuickBooksCsv } from '../lib/quickBooksCsvImport';
import { prepareImport, applyMapping, guessMapping } from '../lib/recordImport';

test('E-48: source rows equal created plus server-reported duplicates, not all created', () => {
  const source = Object.freeze({ sourceRows: 3, preparedRows: 3, created: 2, skipped: 1 });
  const result = reconcileImportCounts(source);
  assert.equal(result.accountedFor, 3);
  assert.equal(result.unexplained, 0);
  assert.equal(result.status, 'counts-explained');
  assert.deepEqual(source, { sourceRows: 3, preparedRows: 3, created: 2, skipped: 1 });
});

test('E-48: a missing or extra server row needs review even after a successful HTTP response', () => {
  assert.equal(reconcileImportCounts({ sourceRows: 4, preparedRows: 4, created: 2, skipped: 1 }).unexplained, 1);
  assert.equal(reconcileImportCounts({ sourceRows: 4, preparedRows: 4, created: 2, skipped: 1 }).status, 'review-required');
  assert.equal(reconcileImportCounts({ sourceRows: 4, preparedRows: 4, created: 5, skipped: 0 }).unexplained, -1);
  assert.equal(reconcileImportCounts({ sourceRows: 4, preparedRows: 4, created: 5, skipped: 0 }).status, 'review-required');
});

test('E-48: malformed counters cannot be presented as a match', () => {
  const cases = [
    { sourceRows: 0, preparedRows: 0, created: 0, skipped: 0 },
    { sourceRows: 2, preparedRows: 3, created: 3, skipped: 0 },
    { sourceRows: 2, preparedRows: 2, created: NaN, skipped: 0 },
    { sourceRows: 2, preparedRows: 2, created: -1, skipped: 3 },
    { sourceRows: 2, preparedRows: 2, created: Number.MAX_SAFE_INTEGER, skipped: 1 },
  ];
  for (const counters of cases) {
    assert.equal(reconcileImportCounts(counters).status, 'unavailable');
  }
});

test('E-48: QuickBooks customer-list sample counts are based on validated normalized rows', () => {
  const source = [
    ['Customer', 'Email'],
    ['Acme', 'acme@example.test'],
    ['Beta', 'beta@example.test'],
  ];
  const normalized = normalizeQuickBooksCsv('customers', source);
  const prepared = prepareImport(
    'customers',
    applyMapping('customers', normalized.slice(1), guessMapping('customers', normalized[0])),
  );
  assert.deepEqual(prepared.errors, []);
  const proof = reconcileImportCounts({
    sourceRows: normalized.length - 1,
    preparedRows: prepared.records.length,
    created: 2,
    skipped: 0,
  });
  assert.equal(proof.status, 'counts-explained');
  assert.equal(proof.sourceRows, 2);
  assert.equal(proof.preparedRows, 2);
});

test('E-48: filtered or invalid source records cannot silently pass the source-count check', () => {
  const proof = reconcileImportCounts({ sourceRows: 5, preparedRows: 4, created: 4, skipped: 0 });
  assert.equal(proof.excludedBeforeSubmit, 1);
  assert.equal(proof.status, 'review-required');
});
