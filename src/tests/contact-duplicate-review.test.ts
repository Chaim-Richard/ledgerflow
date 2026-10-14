import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateContactCsvRows, findDuplicateContactCandidates } from '../lib/contactDuplicateReview';

const contact = (id: string, kind: 'customer' | 'vendor', name: string, extra: Record<string, string> = {}) => ({ id, kind, name, ...extra });

test('A-135 pairs exact IDs, case-insensitive email and digits-only phone across customer/vendor records', () => {
  const result = findDuplicateContactCandidates([
    contact('c-1', 'customer', 'Acme LLC', { email: 'Accounts@acme.test', taxId: '12-3456' }),
    contact('v-1', 'vendor', 'Acme, L.L.C.', { email: 'accounts@ACME.test', taxId: '123456' }),
    contact('c-2', 'customer', 'City Taxi', { phone: '+1 (703) 555-0199' }),
    contact('v-2', 'vendor', 'Taxi City', { phone: '17035550199' }),
  ]);
  assert.equal(result.pairs.length, 2);
  const identifiers = result.pairs.find(pair => pair.left.id === 'c-1' || pair.right.id === 'c-1');
  assert.deepEqual(identifiers?.signals, ['tax-id', 'email', 'name']);
  assert.equal(identifiers?.strength, 'identifier-match');
  const phone = result.pairs.find(pair => pair.left.id === 'c-2' || pair.right.id === 'c-2');
  assert.deepEqual(phone?.signals, ['phone']);
});

test('identifier matches survive missing names without returning raw identifier values to screen or CSV', () => {
  const result = findDuplicateContactCandidates([
    contact('c-empty', 'customer', '', { taxId: 'US-123456789', email: 'secret@example.test' }),
    contact('v-empty', 'vendor', '', { taxId: 'US123456789', email: 'SECRET@example.test' }),
  ]);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].strength, 'identifier-match');
  assert.equal(result.pairs[0].left.name, '');
  assert.doesNotMatch(JSON.stringify(result.pairs), /123456789|secret@example/i);
  assert.doesNotMatch(JSON.stringify(duplicateContactCsvRows(result.pairs)), /123456789|secret@example/i);
});

test('Hebrew marks are comparison-only and same-name pairs are weak suggestions, never merge decisions', () => {
  const result = findDuplicateContactCandidates([
    contact('h1', 'customer', 'אָבִי כהן'),
    contact('h2', 'vendor', 'אבי כהן'),
    contact('n1', 'customer', 'North Shore'),
    contact('n2', 'customer', 'North-Shore'),
  ]);
  const hebrew = result.pairs.find(pair => pair.left.id === 'h1' || pair.right.id === 'h1');
  assert.deepEqual(hebrew?.signals, ['name']);
  assert.equal(hebrew?.strength, 'name-only');
  assert.equal(result.pairs.length, 2);
  assert.equal(duplicateContactCsvRows(result.pairs)[0].length, 8);
});

test('short tax IDs, short phone fragments, blank names and unrelated workspaces are not inferred by the matcher', () => {
  const result = findDuplicateContactCandidates([
    contact('a', 'customer', 'A', { taxId: '1234', phone: '123456' }),
    contact('b', 'vendor', 'B', { taxId: '1234', phone: '123456' }),
    contact('c', 'customer', 'Shared Name', { email: '' }),
  ]);
  assert.deepEqual(result.pairs, []);
});

test('a huge common-name bucket is surfaced as ambiguous instead of producing a quadratic pair explosion', () => {
  const result = findDuplicateContactCandidates(Array.from({ length: 41 }, (_, index) =>
    contact(`id-${index}`, index % 2 ? 'vendor' : 'customer', 'Shared Company')));
  assert.deepEqual(result.pairs, []);
  assert.equal(result.ambiguousBuckets, 1);
});
