import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getIsoCurrency,
  ISO_CURRENCY_REFERENCE,
  ISO_CURRENCY_REFERENCE_AS_OF,
  searchIsoCurrencyReference,
} from './isoCurrencyReference';

test('the current SIX List One table is complete-shaped, sorted, unique, and preserves ISO numeric codes', () => {
  assert.equal(ISO_CURRENCY_REFERENCE_AS_OF, '2026-10-23');
  assert.equal(ISO_CURRENCY_REFERENCE.length, 179);
  assert.deepEqual(ISO_CURRENCY_REFERENCE.map(currency => currency.code), [...ISO_CURRENCY_REFERENCE.map(currency => currency.code)].sort());
  assert.equal(new Set(ISO_CURRENCY_REFERENCE.map(currency => currency.code)).size, ISO_CURRENCY_REFERENCE.length);
  assert.equal(new Set(ISO_CURRENCY_REFERENCE.map(currency => currency.numeric)).size, ISO_CURRENCY_REFERENCE.length);
  for (const currency of ISO_CURRENCY_REFERENCE) {
    assert.match(currency.code, /^[A-Z]{3}$/);
    assert.match(currency.numeric, /^\d{3}$/);
    assert.ok(currency.name.length > 0);
    assert.ok(currency.minorUnitDigits === null || (Number.isInteger(currency.minorUnitDigits) && currency.minorUnitDigits >= 0 && currency.minorUnitDigits <= 4));
  }
  assert.equal(getIsoCurrency('ALL')?.numeric, '008', 'the numeric code keeps its leading zero');
});

test('minor-unit digits distinguish zero-, two-, three- and four-decimal currencies from N.A.', () => {
  assert.equal(getIsoCurrency('JPY')?.minorUnitDigits, 0);
  assert.equal(getIsoCurrency('USD')?.minorUnitDigits, 2);
  assert.equal(getIsoCurrency('KWD')?.minorUnitDigits, 3);
  assert.equal(getIsoCurrency('IQD')?.minorUnitDigits, 3);
  assert.equal(getIsoCurrency('CLF')?.minorUnitDigits, 4);
  assert.equal(getIsoCurrency('UYW')?.minorUnitDigits, 4);
  assert.equal(getIsoCurrency('XDR')?.minorUnitDigits, null, 'N.A. is not reported as a zero-decimal currency');
  assert.equal(getIsoCurrency('XXX')?.minorUnitDigits, null);
});

test('the current list includes recent SIX additions and leaves retired codes out', () => {
  assert.deepEqual(getIsoCurrency('ZWG'), {
    code: 'ZWG', numeric: '924', name: 'Zimbabwe Gold', minorUnitDigits: 2, symbol: null,
  });
  assert.deepEqual(getIsoCurrency('xAD'), {
    code: 'XAD', numeric: '396', name: 'Arab Accounting Dinar', minorUnitDigits: 2, symbol: null,
  });
  assert.deepEqual(getIsoCurrency('XCG'), {
    code: 'XCG', numeric: '532', name: 'Caribbean Guilder', minorUnitDigits: 2, symbol: null,
  });
  assert.equal(getIsoCurrency('ANG'), null, 'Netherlands Antillean Guilder is historical');
  assert.equal(getIsoCurrency('BGN'), null, 'Bulgarian Lev is historical since 2026-01-01');
});

test('search filters by code, currency name and available symbol and falls back to the code when absent', () => {
  assert.deepEqual(searchIsoCurrencyReference('  usd ').map(currency => currency.code), ['USD']);
  assert.ok(searchIsoCurrencyReference('Euro').some(currency => currency.code === 'EUR'), 'name filtering finds the euro');
  assert.ok(!searchIsoCurrencyReference('Euro').some(currency => currency.code === 'JPY'), 'unrelated currencies are filtered out');
  assert.deepEqual(searchIsoCurrencyReference('₪').map(currency => currency.code), ['ILS']);
  assert.deepEqual(searchIsoCurrencyReference('Cg.'), [], 'a symbol not supplied in the static symbol data is not guessed');
  assert.equal(getIsoCurrency('XAD')?.symbol, null);
  assert.equal(getIsoCurrency('XDR')?.symbol, null);
  assert.equal(searchIsoCurrencyReference('').length, ISO_CURRENCY_REFERENCE.length);
  assert.equal(getIsoCurrency(' nope '), null);
});
