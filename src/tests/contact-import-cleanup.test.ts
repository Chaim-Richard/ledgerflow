import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupContactImportRows } from '../lib/contactImportCleanup';

test('valid email and Israeli local phone suggestions leave source values unchanged until accepted', () => {
  const source = [{
    name: 'New contact', email: ' User@Example.com ', phone: '052-123-4567', address: 'רחוב הרצל 10, תל אביב',
  }];
  const result = cleanupContactImportRows('customers', source, 'IL');
  assert.deepEqual(result.rows, source, 'suggestions must not rewrite source rows by default');
  assert.equal(result.normalizedEmails, 0);
  assert.equal(result.normalizedPhones, 0);
  assert.deepEqual(result.warnings.map(warning => [warning.row, warning.field, warning.normalized]), [
    [2, 'Email', 'user@example.com'],
    [2, 'Phone', '+972521234567'],
  ]);
  assert.ok(result.warnings.some(warning => /ownership is not verified/.test(warning.message)));
  assert.ok(result.warnings.some(warning => /assigned or reachable/.test(warning.message)));

  const emailAccepted = cleanupContactImportRows('customers', source, 'IL', { acceptEmailSuggestions: true });
  assert.equal(emailAccepted.rows[0].email, 'user@example.com');
  assert.equal(emailAccepted.rows[0].phone, source[0].phone, 'email acceptance does not silently accept phone suggestions');
  assert.equal(emailAccepted.normalizedEmails, 1);
  assert.equal(emailAccepted.normalizedPhones, 0);

  const bothAccepted = cleanupContactImportRows('customers', source, 'IL', {
    acceptEmailSuggestions: true,
    acceptPhoneSuggestions: true,
  });
  assert.deepEqual(bothAccepted.rows[0], {
    name: 'New contact', email: 'user@example.com', phone: '+972521234567', address: 'רחוב הרצל 10, תל אביב',
  });
  assert.equal(bothAccepted.normalizedEmails, 1);
  assert.equal(bothAccepted.normalizedPhones, 1);
});

test('international E.164 phone suggestions require explicit acceptance but no country selection', () => {
  const source = [{ name: 'Vendor', phone: '+44 20 7031 3000' }];
  const suggestion = cleanupContactImportRows('vendors', source);
  assert.deepEqual(suggestion.rows, source);
  assert.equal(suggestion.normalizedPhones, 0);
  assert.equal(suggestion.warnings[0].normalized, '+442070313000');

  const accepted = cleanupContactImportRows('vendors', source, undefined, { acceptPhoneSuggestions: true });
  assert.equal(accepted.rows[0].phone, '+442070313000');
  assert.equal(accepted.normalizedPhones, 1);
});

test('a local number without a selected country is preserved and only warned about', () => {
  const source = [{ name: 'Contact', phone: '020 7031 3000' }];
  const result = cleanupContactImportRows('customers', source);
  assert.deepEqual(result.rows, source);
  assert.equal(result.normalizedPhones, 0);
  assert.match(result.warnings[0].message, /Choose a country/);
});

test('extensions and invalid phone values are kept instead of being truncated or rejected', () => {
  const withExtension = cleanupContactImportRows('customers', [{ name: 'Contact', phone: '+1 415 555 2671 ext. 42' }], 'US', { acceptPhoneSuggestions: true });
  assert.equal(withExtension.rows[0].phone, '+1 415 555 2671 ext. 42');
  assert.match(withExtension.warnings[0].message, /extension is present/);

  const invalid = cleanupContactImportRows('customers', [{ name: 'Contact', phone: '999' }], 'US', { acceptPhoneSuggestions: true });
  assert.equal(invalid.rows[0].phone, '999');
  assert.match(invalid.warnings[0].message, /kept as entered/);
});

test('malformed email cleanup is advisory while the existing import validator remains authoritative', () => {
  const result = cleanupContactImportRows('customers', [{ name: 'Contact', email: 'bad address' }]);
  assert.equal(result.rows[0].email, 'bad address');
  assert.match(result.warnings[0].message, /existing import validator/);
});

test('non-contact imports are copied without applying contact normalization', () => {
  const source = [{ name: 'Cash', email: ' USER@example.com ', phone: '052-123-4567' }];
  const result = cleanupContactImportRows('accounts', source, 'IL', { acceptEmailSuggestions: true, acceptPhoneSuggestions: true });
  assert.notEqual(result.rows, source);
  assert.deepEqual(result.rows, source);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.normalizedEmails, 0);
  assert.equal(result.normalizedPhones, 0);
});
