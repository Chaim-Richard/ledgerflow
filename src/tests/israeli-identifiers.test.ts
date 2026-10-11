import test from 'node:test';
import assert from 'node:assert/strict';
import { checkIsraeliIdentifier, israeliIdentifierWarning } from '../lib/tax/israeliIdentifiers';

test('E-13: independently documented company number passes format and check digit', () => {
  const valid = checkIsraeliIdentifier('516179157', 'company');
  assert.deepEqual(valid, { state: 'valid-format', isValid: true, reason: null, masked: '•••••9157' });
  assert.equal(israeliIdentifierWarning(valid), null);
  assert.equal(checkIsraeliIdentifier('516179150', 'company').reason, 'checksum');
  assert.equal(checkIsraeliIdentifier('416179157', 'company').reason, 'company-prefix');
  assert.equal(checkIsraeliIdentifier('51617915', 'company').reason, 'length');
});

test('E-13: Israeli ID checksum, short zero-padded forms and separators', () => {
  const valid = checkIsraeliIdentifier('123456782', 'identity');
  assert.equal(valid.state, 'valid-format');
  assert.equal(valid.masked, '•••••6782');
  assert.equal(checkIsraeliIdentifier('123-456 782', 'identity').state, 'valid-format');
  assert.equal(checkIsraeliIdentifier('18', 'identity').state, 'valid-format');
  assert.equal(checkIsraeliIdentifier('123456783', 'identity').reason, 'checksum');
  assert.equal(checkIsraeliIdentifier('1234567820', 'identity').reason, 'length');
});

test('E-13: type distinction does not guess company identity from personal ID or VAT field', () => {
  assert.equal(checkIsraeliIdentifier('123456782', 'company').reason, 'company-prefix');
  assert.equal(checkIsraeliIdentifier('516179157', 'identity').state, 'valid-format');
  // A valid checksum is not proof of any registry entry or entity category.
  assert.equal(checkIsraeliIdentifier('18', 'company').reason, 'length');
});

test('E-13: empty fields are optional and all-zero dummy values are rejected', () => {
  assert.equal(checkIsraeliIdentifier('', 'identity').state, 'empty');
  assert.equal(checkIsraeliIdentifier('   ', 'company').state, 'empty');
  assert.equal(checkIsraeliIdentifier(null, 'identity').state, 'empty');
  assert.equal(checkIsraeliIdentifier(undefined, 'company').state, 'empty');
  assert.equal(checkIsraeliIdentifier('000000000', 'identity').reason, 'zero-number');
  assert.equal(checkIsraeliIdentifier('000000000', 'company').reason, 'company-prefix');
  assert.equal(checkIsraeliIdentifier('0', 'identity').reason, 'zero-number');
});

test('E-13: refuse invalid nonnumeric characters rather than silently stripping them', () => {
  for (const entered of ['123x456782', 'IL123456782', '１２３４５６７８２', '+123456782', '123.456.782', '123\n456782', '1/23456782']) {
    const result = checkIsraeliIdentifier(entered, 'identity');
    assert.equal(result.reason, 'not-digits', 'Should reject nonstandard characters safely');
    assert.equal(result.masked, null);
  }
  assert.equal(checkIsraeliIdentifier(123456782, 'identity').reason, 'not-digits');
});

test('E-13: warning is descriptive, does not reveal input digits, and is never a save-blocking rule', () => {
  const invalid = checkIsraeliIdentifier('123456783', 'identity');
  const warning = israeliIdentifierWarning(invalid);
  assert.match(warning || '', /check digit/i);
  assert.equal(warning?.includes('123456783'), false);
  assert.equal(israeliIdentifierWarning(checkIsraeliIdentifier(' ', 'identity')), null);
  assert.equal(israeliIdentifierWarning(checkIsraeliIdentifier('516179157', 'company')), null);
});

test('E-13: same input always yields the same result with no mutations or persistence', () => {
  const entered = ' 5161-79157 ';
  const before = entered;
  assert.deepEqual(checkIsraeliIdentifier(entered, 'company'), checkIsraeliIdentifier(entered, 'company'));
  assert.equal(entered, before);
});
