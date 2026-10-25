/**
 * Independent audit Pass A, slice 3 — multi-currency minor units (BM-04) and report period
 * validation. Worked figures hand-derived; complements bm04-currency-minor-units.test.ts without
 * repeating it. Evidence: audit/function-audit/AF-010-money-microfunctions.md (slice 3 addendum).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currencyDigits, minorUnitRate, convertMinorUnits, amountStep } from '../lib/currencyMinorUnits';
import { validCustomReportPeriod } from '../lib/reportCustomPeriod';

test('AF-010 BM-04: ISO 4217 exponents and the documented JPY/KWD worked figures', () => {
  assert.equal(currencyDigits('USD'), 2);
  assert.equal(currencyDigits('JPY'), 0);
  assert.equal(currencyDigits('KWD'), 3);
  for (const c of ['BHD', 'IQD', 'JOD', 'LYD', 'OMR', 'TND']) assert.equal(currencyDigits(c), 3);
  assert.equal(currencyDigits('XYZ'), 2, 'unknown currency safely defaults to cents');
  // ¥10,000 at 0.0067 in USD books = $67.00 = 6,700 cents (design doc worked figure)
  assert.equal(convertMinorUnits(10000, 0.0067, 'JPY', 'USD'), 6700);
  // 12,345 fils at 3.25 -> 12345 * 3.25 / 10 = 4012.125 -> half away from zero -> 4012
  assert.equal(convertMinorUnits(12345, 3.25, 'KWD', 'USD'), 4012);
  assert.equal(amountStep('JPY'), '1');
  assert.equal(amountStep('KWD'), '0.001');
  assert.equal(amountStep('USD'), '0.01');
  // rate scaling: JPY->USD adds two decimal orders, KWD->USD removes one
  assert.ok(Math.abs(minorUnitRate(0.0067, 'JPY', 'USD') - 0.67) < 1e-12);
  assert.ok(Math.abs(minorUnitRate(3.25, 'KWD', 'USD') - 0.325) < 1e-12);
});

test('AF-010 BM-04: reciprocal conversion round-trips the documented JPY amount', () => {
  const back = convertMinorUnits(6700, 1 / 0.0067, 'USD', 'JPY');
  assert.equal(back, 10000);
});

test('AF-010 BM-04: a non-positive rate falls back to 1 (documented silent-fallback family)', () => {
  // same observation as calculateFXCents: callers in posting validate rates before reaching here
  assert.equal(convertMinorUnits(500, 0, 'USD', 'EUR'), 500);
  assert.equal(convertMinorUnits(500, NaN, 'USD', 'EUR'), 500);
});

test('AF-010 report period: only real ISO calendar days, ordered, with a try/catch floor', () => {
  assert.equal(validCustomReportPeriod({ startDate: '2026-01-01', endDate: '2026-01-31' }), true);
  assert.equal(validCustomReportPeriod({ startDate: '2026-02-01', endDate: '2026-01-01' }), false, 'reversed range');
  assert.equal(validCustomReportPeriod({ startDate: '2026-02-30', endDate: '2026-03-01' }), false, 'impossible calendar day');
  assert.equal(validCustomReportPeriod({ startDate: '1/1/26', endDate: '2026-03-01' }), false, 'non-ISO format');
  assert.equal(validCustomReportPeriod({ startDate: '1899-12-31', endDate: '1900-01-01' }), false, 'year floor');
  assert.equal(validCustomReportPeriod({ startDate: '2026-01-01', endDate: '2026-01-01' }), true, 'single-day period allowed');
  assert.equal(validCustomReportPeriod(undefined as never), false);
});
