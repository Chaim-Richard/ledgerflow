import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VAT_COUNTRIES,
  VAT_COUNTRY_FORMATS,
  checkVatNumber,
  maskVatNumber,
  vatFormatWarning,
  type VatCountry,
} from '../lib/tax/vatNumberFormat';

const fixtures: ReadonlyArray<[VatCountry, string]> = [
  ['AT', 'ATU12345678'],
  ['BE', 'BE0123456789'],
  ['BG', 'BG123456789'],
  ['HR', 'HR12345678901'],
  ['CY', 'CY12345678X'],
  ['CZ', 'CZ12345678'],
  ['DK', 'DK12345678'],
  ['EE', 'EE123456789'],
  ['FI', 'FI12345678'],
  ['FR', 'FRXX123456789'],
  ['DE', 'DE123456789'],
  ['EL', 'EL123456789'],
  ['HU', 'HU12345678'],
  ['IE', 'IE6388047V'],
  ['IT', 'IT12345678901'],
  ['LV', 'LV12345678901'],
  ['LT', 'LT123456789'],
  ['LU', 'LU12345678'],
  ['MT', 'MT12345678'],
  ['NL', 'NL123456789B01'],
  ['PL', 'PL1234567890'],
  ['PT', 'PT123456789'],
  ['RO', 'RO123456789'],
  ['SK', 'SK1234567890'],
  ['SI', 'SI12345678'],
  ['ES', 'ESA1234567B'],
  ['SE', 'SE123456789001'],
  ['GB', 'GB123456789'],
  ['XI', 'XI123456789'],
];

test('E-15: one structural fixture for each of the 27 EU members, GB and XI', () => {
  assert.equal(VAT_COUNTRIES.length, 29);
  assert.deepEqual([...VAT_COUNTRIES].sort(), fixtures.map(([country]) => country).sort());
  for (const [country, raw] of fixtures) {
    const check = checkVatNumber(raw, country);
    assert.equal(check.status, 'valid-format', country);
    assert.equal(check.problem, null, country);
    assert.ok(check.masked?.startsWith(country + '••••'), country);
    assert.equal(check.masked?.includes(raw), false, country);
    assert.equal(vatFormatWarning(check), null, country);
    assert.equal(VAT_COUNTRY_FORMATS[country].source.startsWith('https://'), true);
    assert.equal(VAT_COUNTRY_FORMATS[country].reviewedOn, '2026-10-11');
  }
});

test('E-15: supports documented valid structural alternatives', () => {
  for (const [country, local] of [
    ['BE', '1123456789'],
    ['BG', '1234567890'],
    ['CZ', '123456789'],
    ['CZ', '1234567890'],
    ['IE', '1234567VA'],
    ['IE', '1A23456V'],
    ['LT', '123456789012'],
    ['RO', '12'],
    ['FR', 'FR123456789'],
    ['ES', '12345678Z'],
    ['GB', 'GD123'],
  ] as const) {
    assert.equal(checkVatNumber(local, country).status, 'valid-format', country + ' ' + local);
  }
});

test('E-15: Greece uses EL VAT prefix even when the chosen ISO country is GR', () => {
  const valid = checkVatNumber('EL 123 456 789', 'GR');
  assert.equal(valid.status, 'valid-format');
  assert.equal(valid.country, 'EL');
  assert.equal(checkVatNumber('GR123456789', 'GR').status, 'warning');
  assert.equal(checkVatNumber('EL123456789', 'DE').problem, 'country-mismatch');
  assert.equal(checkVatNumber('123456789', 'GR').status, 'valid-format');
});

test('E-15: UK and Northern Ireland prefixes must not be conflated', () => {
  assert.equal(checkVatNumber('GB123456789', 'UK').status, 'valid-format');
  assert.equal(checkVatNumber('GB123456789', 'GB').status, 'valid-format');
  assert.equal(checkVatNumber('XI123456789', 'XI').status, 'valid-format');
  assert.equal(checkVatNumber('XI123456789', 'GB').problem, 'country-mismatch');
  assert.equal(checkVatNumber('GB123456789', 'XI').problem, 'country-mismatch');
  assert.equal(checkVatNumber('DE123456789', 'UK').problem, 'country-mismatch');
});

test('E-15: missing values do not produce warnings; unknown countries do', () => {
  for (const empty of ['', '   ', null, undefined]) {
    const v = checkVatNumber(empty, 'DE');
    assert.equal(v.status, 'empty');
    assert.equal(vatFormatWarning(v), null);
  }
  assert.equal(checkVatNumber('123456789', 'US').problem, 'unsupported-country');
  assert.equal(checkVatNumber('123456789', 'EU').problem, 'unsupported-country');
  assert.equal(checkVatNumber('123456789', '').problem, 'unsupported-country');
  assert.equal(checkVatNumber('123456789', null).problem, 'unsupported-country');
  assert.equal(checkVatNumber('123456789', 'NO').problem, 'unsupported-country');
});

test('E-15: cannot treat a wrong prefix as the selected country', () => {
  assert.equal(checkVatNumber('NL123456789B01', 'BE').problem, 'country-mismatch');
  assert.equal(checkVatNumber('BE0123456789', 'NL').problem, 'country-mismatch');
  assert.equal(checkVatNumber('BE0123456789', 'GB').problem, 'country-mismatch');
  assert.equal(checkVatNumber('XX123456789', 'DE').problem, 'format');
});

test('E-15: invalid national lengths or required letter positions fail', () => {
  for (const [country, number] of [
    ['AT', 'AT123456789'],
    ['BE', 'BE2123456789'],
    ['CY', 'CY123456789'],
    ['NL', 'NL123456789A01'],
    ['SE', 'SE123456789002'],
    ['DK', 'DK1234567'],
    ['LT', 'LT1234567890'],
    ['FR', 'FR123456789'],
    ['ES', 'ESA12345678Z'],
    ['GB', 'GB12345678'],
  ] as const) {
    assert.equal(checkVatNumber(number, country).status, 'warning', country + ' ' + number);
  }
});

test('E-15: human-entered spacing and case are normalized for validation only', () => {
  assert.equal(checkVatNumber(' nl 123 456 789 b01 ', 'nl').status, 'valid-format');
  assert.equal(checkVatNumber('de-123 456 789', 'DE').status, 'valid-format');
  assert.equal(checkVatNumber('BE 0123.456.789', 'BE').status, 'valid-format');
  assert.equal(checkVatNumber('AT U12345678', 'AT').status, 'valid-format');
});

test('E-15: non-ASCII and unsupported characters never get silently stripped', () => {
  for (const raw of ['ＤＥ１２３４５６７８９', 'DE123/456789', 'DE123@456789', 'DE123_456789', 'DE123\t456789']) {
    const result = checkVatNumber(raw, 'DE');
    assert.equal(result.problem, 'characters');
    assert.equal(result.masked, null);
  }
  assert.equal(checkVatNumber(123456789, 'DE').problem, 'characters');
  assert.equal(checkVatNumber('DE' + '1'.repeat(50), 'DE').problem, 'characters');
});

test('E-15: do not reveal entire short numbers in displayed mask or any warning', () => {
  const small = checkVatNumber('RO12', 'RO');
  assert.equal(small.status, 'valid-format');
  assert.equal(small.masked, 'RO••••');
  const normal = maskVatNumber('FRXX123456789', 'FR');
  assert.ok(normal);
  assert.equal(normal?.includes('XX123456789'), false);
  const warning = vatFormatWarning(checkVatNumber('FRXX12345678', 'FR'));
  assert.ok(warning);
  assert.equal(warning?.includes('FRXX12345678'), false);
});

test('E-15: reject all-zero dummy numbers and preserve read-only behavior', () => {
  assert.equal(checkVatNumber('DE000000000', 'DE').problem, 'placeholder');
  assert.equal(checkVatNumber('RO00', 'RO').problem, 'placeholder');
  const original = Object.freeze({ number: 'DE123456789' });
  const first = checkVatNumber(original.number, 'DE');
  assert.deepEqual(checkVatNumber(original.number, 'DE'), first);
  assert.equal(original.number, 'DE123456789');
  assert.equal(Object.hasOwn(first, 'normalized'), false);
});
