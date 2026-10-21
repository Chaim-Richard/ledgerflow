import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDisposableDbUrl } from '../../scripts/restore-drill.mjs';

test('S-03 local test database URL is required (never select a default)', () => {
  assert.throws(() => validateDisposableDbUrl(''), /explicitly/);
  assert.throws(() => validateDisposableDbUrl('not a database url'), /Invalid/);
});

test('S-03 remote and production database URLs are refused', () => {
  assert.throws(() => validateDisposableDbUrl('postgresql://u:p@db.example.com:5432/lf_test'), /localhost/);
  assert.throws(() => validateDisposableDbUrl('postgresql://u:p@localhost:5432/ledgerflow'), /must be lf_test/);
  assert.throws(() => validateDisposableDbUrl('postgresql://u:p@localhost:5432/postgres'), /must be lf_test/);
});

test('S-03 accepts only appropriately named local disposable test database', () => {
  assert.equal(validateDisposableDbUrl('postgresql://localhost:5432/lf_test').database, 'lf_test');
  assert.equal(validateDisposableDbUrl('postgresql://localhost:5432/lf_test_synthetic').database, 'lf_test_synthetic');
  assert.equal(validateDisposableDbUrl('postgresql://127.0.0.1:5432/lf_test').database, 'lf_test');
});
