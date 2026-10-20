import test from 'node:test';
import assert from 'node:assert/strict';
import { IBAN_COUNTRY_SPECS, ibanCountrySpecProblems, ibanLengthFor, ibanProblem, ibanValidCountry } from '../lib/banking/ibanCountrySpecs';
import { validRouting } from '../lib/nacha';
import { ibanValid } from '../lib/paymentRun';

test('IBAN country specs are sourced, unique and spot-check known lengths', () => {
  assert.deepEqual(ibanCountrySpecProblems(), []);
  assert.ok(IBAN_COUNTRY_SPECS.length >= 71, '71 IBAN countries in table');
  assert.equal(ibanLengthFor('IL'), 23);
  assert.equal(ibanLengthFor('DE'), 22);
  assert.equal(ibanLengthFor('GB'), 22);
  assert.equal(ibanLengthFor('FR'), 27);
  assert.equal(ibanLengthFor('SA'), 24);
  assert.equal(ibanLengthFor('US'), undefined, 'US does not use IBAN');
  for (const row of IBAN_COUNTRY_SPECS) assert.match(row.source.url, /^https:\/\//);
});

test('IBAN validation: country length + mod97', () => {
  // valid IBANs (well-known examples, not real accounts)
  assert.equal(ibanValidCountry('DE89 3704 0044 0532 0130 00'), true);
  assert.equal(ibanValidCountry('GB82 WEST 1234 5698 7654 32'), true);
  assert.equal(ibanValidCountry('IL07 0108 0000 0001 2345 678'), true);
  assert.equal(ibanValidCountry('FR14 2004 1010 0505 0001 3M02 606'), true);
  assert.equal(ibanValidCountry('SA03 8000 0000 6080 1016 7519'), true);
  assert.equal(ibanProblem('DE89 3704 0044 0532 0130 00'), null);
  // wrong check digit
  assert.equal(ibanValidCountry('GB82 WEST 1234 5698 7654 33'), false);
  assert.match(ibanProblem('GB82 WEST 1234 5698 7654 33') || '', /check digits/);
  // wrong length for country
  assert.equal(ibanValidCountry('DE89 3704 0044 0532 0130 0'), false, 'DE is 22, this is 21');
  assert.match(ibanProblem('DE89 3704 0044 0532 0130 0') || '', /22 characters/);
  // unknown country
  assert.match(ibanProblem('US64 SVBK 0000 0000 0000 0000') || '', /does not use IBAN/);
  // non-IBAN still fails generic mod97 check in older helper, but country table says unknown
  assert.equal(ibanValid('GB82 WEST 1234 5698 7654 32'), true, 'generic check still passes for known good');
});

test('US routing checksum', () => {
  assert.equal(validRouting('021000021'), true, 'Chase');
  assert.equal(validRouting('011000015'), true, 'Fed');
  assert.equal(validRouting('021000022'), false, 'bad checksum');
  assert.equal(validRouting('12345678'), false, 'too short');
  assert.equal(validRouting('02100002a'), false, 'non-digit');
});
