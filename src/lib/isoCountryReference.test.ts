import test from 'node:test';
import assert from 'node:assert/strict';
import { getIsoCountry, getIsoCountryName, ISO_COUNTRIES, isoCountryOptionLabel } from './isoCountryReference';

test('the static ISO 3166-1 table has all assigned entries, unique codes and padded numeric values', () => {
  assert.equal(ISO_COUNTRIES.length, 249, 'the source package includes 250 rows, including user-assigned XK which is excluded');
  assert.equal(new Set(ISO_COUNTRIES.map(country => country.alpha2)).size, ISO_COUNTRIES.length);
  assert.equal(new Set(ISO_COUNTRIES.map(country => country.alpha3)).size, ISO_COUNTRIES.length);
  assert.equal(new Set(ISO_COUNTRIES.map(country => country.numeric)).size, ISO_COUNTRIES.length);
  assert.deepEqual(ISO_COUNTRIES.map(country => country.alpha2), [...ISO_COUNTRIES.map(country => country.alpha2)].sort());
  for (const country of ISO_COUNTRIES) {
    assert.match(country.alpha2, /^[A-Z]{2}$/);
    assert.match(country.alpha3, /^[A-Z]{3}$/);
    assert.match(country.numeric, /^\d{3}$/);
    assert.equal(typeof country.nameEn, 'string', 'locale aliases are reduced to the primary display label');
    assert.equal(typeof country.nameHe, 'string', 'Hebrew locale aliases are reduced to the primary display label');
    assert.ok(country.nameEn.length > 0);
    assert.ok(country.nameHe.length > 0);
  }
  assert.equal(getIsoCountry('AF')?.numeric, '004', 'numeric codes remain strings with leading zeroes');
});

test('country lookup provides English and Hebrew labels without treating XK as an ISO-assigned code', () => {
  const israel = getIsoCountry(' il ');
  assert.equal(israel?.alpha3, 'ISR');
  assert.equal(israel?.nameEn, 'Israel');
  assert.equal(israel?.nameHe, 'ישראל');
  assert.equal(getIsoCountryName('IL', 'en'), 'Israel');
  assert.equal(getIsoCountryName('IL', 'he'), 'ישראל');
  assert.equal(getIsoCountryName('XK', 'en'), null);
  assert.equal(getIsoCountry('unknown'), null);
});

test('country labels use the selected language first and keep both languages visible', () => {
  const israel = getIsoCountry('IL')!;
  assert.equal(isoCountryOptionLabel(israel, 'en'), 'IL — Israel / ישראל');
  assert.equal(isoCountryOptionLabel(israel, 'he'), 'IL — ישראל / Israel');
});
