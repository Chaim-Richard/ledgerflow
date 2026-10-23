import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIsraeliAddress } from '../lib/israelAddressParser';

test('Israeli address parser suggests English street, city and a current seven-digit postal code', () => {
  const original = '10 Herzl St, Tel Aviv, postal code 6340001, Israel';
  const result = parseIsraeliAddress(original);
  assert.equal(result.source, original);
  assert.equal(result.street, '10 Herzl St');
  assert.equal(result.city, 'Tel Aviv');
  assert.equal(result.postalCode, '6340001');
  assert.ok(result.warnings.some(warning => /suggestion only/.test(warning)));
  assert.equal(original, '10 Herzl St, Tel Aviv, postal code 6340001, Israel', 'the source is never rewritten');
});

test('Israeli address parser handles Hebrew street labels and a labelled legacy five-digit postal code', () => {
  const result = parseIsraeliAddress('רחוב הרצל 10, תל אביב, מיקוד 61000, ישראל');
  assert.equal(result.street, 'רחוב הרצל 10');
  assert.equal(result.city, 'תל אביב');
  assert.equal(result.postalCode, '61000');
});

test('a single-line English address can split after the house number when the street is explicit', () => {
  const result = parseIsraeliAddress('Herzl Street 10 Tel Aviv 6340001');
  assert.equal(result.street, 'Herzl Street 10');
  assert.equal(result.city, 'Tel Aviv');
  assert.equal(result.postalCode, '6340001');
});

test('an unlabelled five-digit number is not treated as a postal code', () => {
  const result = parseIsraeliAddress('Herzl Street 10, Tel Aviv 61000');
  assert.equal(result.street, 'Herzl Street 10');
  assert.equal(result.city, 'Tel Aviv');
  assert.equal(result.postalCode, undefined);
  assert.ok(result.warnings.some(warning => /five-digit value was left unclassified/.test(warning)));
});

test('ambiguous multiple postal codes are reported rather than selected', () => {
  const result = parseIsraeliAddress('Herzl St 10, Tel Aviv 1234567, 7654321');
  assert.equal(result.postalCode, undefined);
  assert.ok(result.warnings.some(warning => /More than one possible postal code/.test(warning)));
});

test('unmarked multi-part addresses remain intact for human review', () => {
  const original = 'Building A, 10, Tel Aviv';
  const result = parseIsraeliAddress(original);
  assert.equal(result.source, original);
  assert.equal(result.street, undefined);
  assert.equal(result.city, undefined);
  assert.ok(result.warnings.some(warning => /not guessed/.test(warning)));
});

test('blank and city-only values are safe', () => {
  assert.deepEqual(parseIsraeliAddress('  '), { source: '  ', warnings: [] });
  const city = parseIsraeliAddress('ירושלים');
  assert.equal(city.city, 'ירושלים');
  assert.equal(city.street, undefined);
  assert.ok(city.warnings.some(warning => /Street suggested|street could not be identified/i.test(warning)));
});
