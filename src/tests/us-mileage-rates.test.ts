import test from 'node:test';
import assert from 'node:assert/strict';
import { US_MILEAGE_RATES, mileageRateOn, usMileageRateProblems } from '../lib/tax/usMileageRates';

test('US mileage rates are dated, sourced and correctly answer known dates', () => {
  assert.deepEqual(usMileageRateProblems(), []);
  assert.equal(US_MILEAGE_RATES.length, 8, '8 rows: 2020,2021,2022x2,2023,2024,2025,2026 provisional');
  assert.equal(mileageRateOn('2020-06-15')?.rateCentsPerMile, 5750);
  assert.equal(mileageRateOn('2021-06-15')?.rateCentsPerMile, 5600);
  assert.equal(mileageRateOn('2022-03-01')?.rateCentsPerMile, 5850, '2022 H1');
  assert.equal(mileageRateOn('2022-09-01')?.rateCentsPerMile, 6250, '2022 H2');
  assert.equal(mileageRateOn('2023-06-15')?.rateCentsPerMile, 6550);
  assert.equal(mileageRateOn('2024-06-15')?.rateCentsPerMile, 6700);
  assert.equal(mileageRateOn('2025-06-15')?.rateCentsPerMile, 7000);
  assert.equal(mileageRateOn('2026-06-15')?.rateCentsPerMile, 7000, '2026 provisional');
  assert.equal(mileageRateOn('2019-12-31'), undefined);
  // each row source is https
  for (const row of US_MILEAGE_RATES) assert.match(row.source.url, /^https:\/\//);
  // 2022 split is exactly at July 1
  assert.equal(US_MILEAGE_RATES.find(r => r.validFrom === '2022-01-01')?.validTo, '2022-06-30');
  assert.equal(US_MILEAGE_RATES.find(r => r.validFrom === '2022-07-01')?.validTo, '2022-12-31');
});

test('mileage amount arithmetic stays whole cents', () => {
  const row = mileageRateOn('2024-06-15')!;
  // 42 miles × $0.67 = $28.14
  const miles = 42;
  const cents = Math.round(miles * row.rateCentsPerMile / 100);
  assert.equal(cents, 2814);
});
