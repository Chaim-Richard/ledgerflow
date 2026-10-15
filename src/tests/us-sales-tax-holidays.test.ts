/**
 * A-58: US state sales tax holidays. Golden cases from the authorities' own figures: Texas counts
 * the sales price EXCLUSIVE ("less than $100" — an item at $100 is fully taxable) and Florida
 * INCLUSIVE ("$100 or less" — an item at exactly $100 is exempt). Texas' emergency ladder example
 * from the Comptroller's own page ($299 + $10 delivery = $309) is over the $300 cap. The windows
 * come from the 2026 publications (TX 7–9 Aug, TX 25–27 Apr, FL 20 Jul – 20 Aug).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  holidayItemAnswer, holidayRowsForYear, holidayRowsInForce, holidayStates,
  US_SALES_TAX_HOLIDAYS, holidayCsvRows, HOLIDAY_CSV_HEADERS,
} from '../lib/tax/usSalesTaxHolidays';
import { usSalesTaxHolidayPack } from '../lib/rules/packs/usSalesTaxHolidayPack';
import { allTaxRules } from '../lib/rules/packs/index';
import { lintRule } from '../lib/rules/lint';

describe('sales tax holidays: windows', () => {
  test('the Texas 2026 back-to-school window is 7–9 August, and stops at midnight on the 9th', () => {
    assert.equal(holidayRowsInForce('TX', '2026-08-06').length, 0);
    assert.equal(holidayRowsInForce('TX', '2026-08-07')[0]?.id, 'tx-back-to-school-2026');
    assert.equal(holidayRowsInForce('TX', '2026-08-09')[0]?.id, 'tx-back-to-school-2026');
    assert.equal(holidayRowsInForce('TX', '2026-08-10').length, 0);
  });

  test('the Florida 2026 back-to-school window runs 20 July – 20 August, both ends included', () => {
    assert.equal(holidayRowsInForce('FL', '2026-07-19').length, 0);
    assert.equal(holidayRowsInForce('FL', '2026-07-20')[0]?.id, 'fl-back-to-school-2026');
    assert.equal(holidayRowsInForce('FL', '2026-08-20')[0]?.id, 'fl-back-to-school-2026');
    assert.equal(holidayRowsInForce('FL', '2026-08-21').length, 0);
    assert.equal(holidayRowsInForce('FL', '2025-08-15')[0]?.id, 'fl-back-to-school-2025');
  });

  test('the Texas emergency window is 25–27 April 2026', () => {
    const rows = holidayRowsInForce('TX', '2026-04-26');
    assert.equal(rows[0]?.id, 'tx-emergency-prep-2026');
    assert.equal(holidayRowsInForce('TX', '2026-04-28').length, 0);
  });

  test('the states this table states are TX and FL, and each row carries its source', () => {
    assert.deepEqual(holidayStates().map(entry => entry.state), ['FL', 'TX']);
    for (const row of US_SALES_TAX_HOLIDAYS) {
      assert.match(row.source.url, /^https:\/\//, `${row.id} has an https source`);
      assert.ok(row.source.authority, `${row.id} names its authority`);
      assert.ok(row.from <= row.to, `${row.id} window is ordered`);
    }
    assert.equal(holidayRowsForYear('TX', 2026).length, 2);
  });
});

describe('sales tax holidays: the per-item cap (golden cases from the states’ own words)', () => {
  test('Texas counts the sales price exclusive: $99.99 is in, $100.00 is fully taxable', () => {
    const inCap = holidayItemAnswer('TX', '2026-08-08', 'clothing-footwear', 9_999);
    assert.equal(inCap.state, 'within-cap');
    const atCap = holidayItemAnswer('TX', '2026-08-08', 'clothing-footwear', 10_000);
    assert.equal(atCap.state, 'over-cap', 'Texas: “less than $100” — an item at exactly $100 is taxable');
    assert.match(atCap.because, /whole item is taxable/);
  });

  test('Florida counts it inclusive: $100.00 clothing is in, $100.01 is out', () => {
    assert.equal(holidayItemAnswer('FL', '2026-08-01', 'clothing-footwear', 10_000).state, 'within-cap');
    assert.equal(holidayItemAnswer('FL', '2026-08-01', 'clothing-footwear', 10_001).state, 'over-cap');
    assert.equal(holidayItemAnswer('FL', '2026-08-01', 'school-supplies', 5_000).state, 'within-cap');
    assert.equal(holidayItemAnswer('FL', '2026-08-01', 'school-supplies', 5_001).state, 'over-cap');
    assert.equal(holidayItemAnswer('FL', '2026-08-01', 'learning-aids', 3_000).state, 'within-cap');
    assert.equal(holidayItemAnswer('FL', '2026-08-01', 'computers-home-use', 150_000).state, 'within-cap');
    assert.equal(holidayItemAnswer('FL', '2026-08-01', 'computers-home-use', 150_001).state, 'over-cap');
  });

  test('the Comptroller’s own example: a $299 ladder with $10 delivery is over the $300 cap', () => {
    const answer = holidayItemAnswer('TX', '2026-04-26', 'shutters-ladders', 30_900);
    assert.equal(answer.state, 'over-cap');
    assert.match(answer.because, /309\.00/);
    assert.equal(holidayItemAnswer('TX', '2026-04-26', 'generators', 299_999).state, 'within-cap');
    assert.equal(holidayItemAnswer('TX', '2026-04-26', 'generators', 300_000).state, 'over-cap');
    assert.equal(holidayItemAnswer('TX', '2026-04-26', 'emergency-supplies', 7_499).state, 'within-cap');
    assert.equal(holidayItemAnswer('TX', '2026-04-26', 'emergency-supplies', 7_500).state, 'over-cap');
  });

  test('outside every window the answer is not-in-force, never “exempt”', () => {
    const answer = holidayItemAnswer('TX', '2026-12-01', 'clothing-footwear', 4_500);
    assert.equal(answer.state, 'not-in-force');
    assert.match(answer.because, /No sales tax holiday/);
    assert.equal(holidayItemAnswer('NY', '2026-08-08', 'clothing-footwear', 4_500).state, 'not-in-force');
    assert.equal(holidayItemAnswer('TX', '2026-08-08', 'no-such-band', 4_500).state, 'not-in-force');
  });
});

describe('sales tax holidays: the dated rules', () => {
  const pack = usSalesTaxHolidayPack();
  const ruleIds = new Set(allTaxRules().map(rule => rule.id));

  test('one rule per published window, in force exactly while the holiday runs', () => {
    assert.equal(pack.rules.length, US_SALES_TAX_HOLIDAYS.length);
    for (const [index, row] of US_SALES_TAX_HOLIDAYS.entries()) {
      const rule = pack.rules[index];
      assert.equal(rule.validFrom, row.from);
      assert.equal(rule.validTo, row.to);
      assert.equal(rule.status, 'calculation');
      assert.equal(rule.combine, 'override');
      assert.equal(rule.effect.kind, 'sales-tax-holiday');
      assert.equal(rule.source.url, row.source.url);
    }
  });

  test('the override names the state rate rules that exist, and the caps live in the effect', () => {
    const texas = pack.rules.find(rule => rule.id === 'us-holiday-tx-back-to-school-2026')!;
    assert.deepEqual(texas.targets, ['us-sales-tx-2000-01-01'], 'the Texas state rate rule, by id');
    for (const target of texas.targets || []) assert.ok(ruleIds.has(target), `${target} exists in the packs`);
    const effect = texas.effect as { kind: string; bands: Array<{ capCents: number; capInclusive: boolean }> };
    assert.equal(effect.kind, 'sales-tax-holiday');
    assert.equal(effect.bands.length, 2);
    assert.equal(effect.bands[0].capCents, 10_000);
    assert.equal(effect.bands[0].capInclusive, false, 'Texas: “less than $100”');
    const florida = pack.rules.find(rule => rule.id === 'us-holiday-fl-back-to-school-2026')!;
    const flEffect = florida.effect as { bands: Array<{ capCents: number; capInclusive: boolean }> };
    assert.equal(flEffect.bands[0].capInclusive, true, 'Florida: “$100 or less”');
  });

  test('every rule is lint-clean and the holidays not stated are named, never guessed', () => {
    for (const rule of pack.rules) assert.deepEqual(lintRule(rule, { pack: pack.id }), []);
    assert.ok(pack.unmapped.length >= 3);
    assert.ok(pack.unmapped.some(row => /water-efficient/.test(row.row)));
    assert.ok(pack.unmapped.some(row => /disaster preparedness/i.test(row.row)));
    assert.ok(pack.unmapped.every(row => row.reason.length > 10));
  });
});

describe('sales tax holidays: the CSV', () => {
  test('one line per row × band with its source', () => {
    const rows = holidayCsvRows(US_SALES_TAX_HOLIDAYS);
    const bts2026 = rows.filter(row => row[2] === '2026-08-07');
    assert.equal(bts2026.length, 2, 'two bands in the Texas 2026 window');
    assert.equal(bts2026[0][5], '100.00');
    assert.equal(bts2026[0][6], 'below the cap');
    assert.equal(rows[0].length, HOLIDAY_CSV_HEADERS.length);
  });
});
