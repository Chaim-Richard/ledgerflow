import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrency,
  formatDollars,
  getCurrencyFractionDigits,
  getCurrencyDivisor,
  THREE_DECIMAL_CURRENCIES
} from '../lib/utils';

describe('BH-01: Multi-Currency Decimal Precision & Formatting Suite', () => {
  test('THREE_DECIMAL_CURRENCIES contains all 7 ISO-4217 3-decimal currencies', () => {
    const expected = ['BHD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND', 'IQD'];
    for (const curr of expected) {
      assert.ok(THREE_DECIMAL_CURRENCIES.has(curr), `Missing 3-decimal currency: ${curr}`);
    }
  });

  test('getCurrencyFractionDigits returns exact decimal counts', () => {
    // 2-decimal
    assert.equal(getCurrencyFractionDigits('USD'), 2);
    assert.equal(getCurrencyFractionDigits('EUR'), 2);
    assert.equal(getCurrencyFractionDigits('GBP'), 2);
    assert.equal(getCurrencyFractionDigits(undefined), 2);

    // 0-decimal
    assert.equal(getCurrencyFractionDigits('JPY'), 0);
    assert.equal(getCurrencyFractionDigits('KRW'), 0);

    // 3-decimal
    assert.equal(getCurrencyFractionDigits('KWD'), 3);
    assert.equal(getCurrencyFractionDigits('BHD'), 3);
    assert.equal(getCurrencyFractionDigits('OMR'), 3);
    assert.equal(getCurrencyFractionDigits('JOD'), 3);
    assert.equal(getCurrencyFractionDigits('TND'), 3);
    assert.equal(getCurrencyFractionDigits('LYD'), 3);
    assert.equal(getCurrencyFractionDigits('IQD'), 3);
  });

  test('getCurrencyDivisor returns exact powers of 10', () => {
    assert.equal(getCurrencyDivisor('USD'), 100);
    assert.equal(getCurrencyDivisor('JPY'), 1);
    assert.equal(getCurrencyDivisor('KWD'), 1000);
    assert.equal(getCurrencyDivisor('BHD'), 1000);
  });

  test('formatCurrency remedies 10x display error for 3-decimal currencies (BH-01)', () => {
    // 1 KWD = 1000 fils. In minor units, 1000 fils should format as 1.000, NOT 10.000
    const kwdFormatted = formatCurrency(1000, 'KWD');
    assert.match(kwdFormatted, /1\.000/);

    // 2500 fils = 2.500 KWD
    const kwdFraction = formatCurrency(2500, 'KWD');
    assert.match(kwdFraction, /2\.500/);

    // BHD: 5000 fils = 5.000 BHD
    const bhdFormatted = formatCurrency(5000, 'BHD');
    assert.match(bhdFormatted, /5\.000/);

    // OMR: 12345 baisa = 12.345 OMR
    const omrFormatted = formatCurrency(12345, 'OMR');
    assert.match(omrFormatted, /12\.345/);

    // JOD: 1000 fils = 1.000 JOD
    const jodFormatted = formatCurrency(1000, 'JOD');
    assert.match(jodFormatted, /1\.000/);

    // TND: 1000 millimes = 1.000 TND
    const tndFormatted = formatCurrency(1000, 'TND');
    assert.match(tndFormatted, /1\.000/);

    // LYD: 1000 dirhams = 1.000 LYD
    const lydFormatted = formatCurrency(1000, 'LYD');
    assert.match(lydFormatted, /1\.000/);

    // IQD: 1000 fils = 1.000 IQD
    const iqdFormatted = formatCurrency(1000, 'IQD');
    assert.match(iqdFormatted, /1\.000/);
  });

  test('formatCurrency formats 2-decimal and 0-decimal currencies correctly', () => {
    // USD: 1000 cents = $10.00
    const usdFormatted = formatCurrency(1000, 'USD');
    assert.match(usdFormatted, /10\.00/);

    // JPY: 1000 yen = ¥1,000 (no decimals)
    const jpyFormatted = formatCurrency(1000, 'JPY');
    assert.match(jpyFormatted, /1[,.]?000/);
    assert.doesNotMatch(jpyFormatted, /\./);
  });

  test('formatDollars works accurately across all currency exponents', () => {
    // 10 USD -> 1000 cents -> $10.00
    assert.match(formatDollars(10, 'USD'), /10\.00/);

    // 1 KWD -> 1000 fils -> KWD 1.000
    assert.match(formatDollars(1, 'KWD'), /1\.000/);

    // 500 JPY -> 500 yen
    assert.doesNotMatch(formatDollars(500, 'JPY'), /\./);
  });
});
