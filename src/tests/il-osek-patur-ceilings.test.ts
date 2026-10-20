/**
 * A-100: Israel's osek patur ceiling, one dated row per tax year, and the promise that the
 * Registration Threshold Watch and its rule pack read THESE rows instead of a second copy of the
 * figures. Every shekel amount below is the published figure for that year, written by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IL_OSEK_PATUR_CEILINGS, isWithinOsekPaturCeiling, osekPaturCeilingForYear, osekPaturCeilingOn, osekPaturCeilingProblems,
} from '../lib/tax/ilOsekPaturThresholds';
import { REGISTRATION_THRESHOLDS } from '../lib/tax/registrationThresholds';
import { registrationThresholdPack } from '../lib/rules/packs/registrationThresholdPack';

const ils = (shekels: number) => Math.round(shekels * 100);

test('A-100: one row per tax year, dated from 1 January, and the table keeps its own promises', () => {
  assert.deepEqual(osekPaturCeilingProblems(), [], 'the table lints clean — a year, a date, an amount and a source each');
  assert.deepEqual(IL_OSEK_PATUR_CEILINGS.map(row => row.year), [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  for (const row of IL_OSEK_PATUR_CEILINGS) {
    assert.equal(row.validFrom, `${row.year}-01-01`, `${row.year} starts on 1 January, the law's indexation day`);
    assert.equal(row.validTo, row.year === 2026 ? undefined : `${row.year}-12-31`, 'only the newest year stays open');
    assert.ok(Number.isSafeInteger(row.ceilingCents) && row.ceilingCents > 0, `${row.year} is whole agorot`);
    assert.match(row.source.url, /^https:\/\/\S+$/, `${row.year} cites one https page`);
    assert.ok(row.note.includes(`₪${(row.ceilingCents / 100).toLocaleString('en-US')}`), `${row.year} says its own figure in words`);
  }
});

test('the figures in force, each the published amount for its year (₪)', () => {
  const expected: Array<[number, number]> = [
    [2017, 98_707], [2018, 99_003], [2019, 100_187], [2020, 100_491], [2021, 99_893],
    [2022, 102_292], [2023, 107_692], [2024, 120_000], [2025, 120_000], [2026, 122_833],
  ];
  for (const [year, shekels] of expected) {
    assert.equal(osekPaturCeilingForYear(year)?.ceilingCents, ils(shekels), `${year} = ₪${shekels.toLocaleString('en-US')}`);
  }
  // 2021 is LOWER than 2020: indexation follows the consumer price index, which fell. A table that
  // assumed the ceiling never goes down would answer that year wrong, so the shape is asserted too.
  const ceiling2020 = osekPaturCeilingForYear(2020)!.ceilingCents;
  const ceiling2021 = osekPaturCeilingForYear(2021)!.ceilingCents;
  assert.ok(ceiling2021 < ceiling2020, 'the 2021 figure came down with the index, and the table says so');
  assert.equal(osekPaturCeilingForYear(2021)?.basis, 'indexed');
});

test('the ceiling itself is inside it, one agora over is not, and a year without a row answers unknown', () => {
  for (const year of [2019, 2024, 2026]) {
    const ceiling = osekPaturCeilingForYear(year)!.ceilingCents;
    // "אינו עולה על" — does not exceed: at the figure is still inside, one agora more is not.
    assert.equal(isWithinOsekPaturCeiling(ceiling, year), true, `${year}: exactly at the ceiling is inside it`);
    assert.equal(isWithinOsekPaturCeiling(ceiling + 1, year), false, `${year}: one agora over is outside it`);
  }
  // worked: ₪100,188 of posted sales in 2019 is over that year's ₪100,187 ceiling; ₪100,187 is not.
  assert.equal(isWithinOsekPaturCeiling(ils(100_188), '2019-08-15'), false);
  assert.equal(isWithinOsekPaturCeiling(ils(100_187), '2019-08-15'), true);
  // a year the table does not state is unknown, never zero and never the neighbouring year's figure
  assert.equal(osekPaturCeilingForYear(2016), undefined);
  assert.equal(osekPaturCeilingOn('2016-07-01'), undefined);
  assert.equal(isWithinOsekPaturCeiling(ils(50_000), 2016), undefined, 'unknown is not "no"');
  // the date form answers the year that owns the day, at both boundaries
  assert.equal(osekPaturCeilingOn('2026-01-01')?.ceilingCents, ils(122_833));
  assert.equal(osekPaturCeilingOn('2025-12-31')?.ceilingCents, ils(120_000));
  assert.equal(osekPaturCeilingOn('2024-01-01')?.ceilingCents, ils(120_000));
  assert.equal(osekPaturCeilingOn('2023-12-31')?.ceilingCents, ils(107_692));
});

test('the watch rows and the rule pack are built from these rows — one figure per year, not two', () => {
  const pack = registrationThresholdPack();
  const israelRows = REGISTRATION_THRESHOLDS.filter(row => row.scheme === 'il-osek-patur');
  assert.deepEqual(israelRows.map(row => row.validFrom.slice(0, 4)), ['2024', '2025', '2026'], 'the watch keeps the recent years');
  for (const row of israelRows) {
    const ceiling = osekPaturCeilingForYear(Number(row.validFrom.slice(0, 4)))!;
    assert.equal(row.thresholdCents, ceiling.ceilingCents, `${row.id}: the amount is the history's amount`);
    assert.equal(row.validFrom, ceiling.validFrom, `${row.id}: the dates are the history's dates`);
    assert.equal(row.validTo, ceiling.validTo, `${row.id}: the period ends where the history says`);
    assert.equal(row.source.url, ceiling.source.url, `${row.id}: the citation is the history's citation`);
    assert.equal(row.currency, 'ILS', `${row.id} is stated in new shekels`);
    const rule = pack.rules.find(candidate => candidate.id === row.id)!;
    assert.ok(rule.effect.kind === 'registration-threshold' && rule.effect.thresholdCents === ceiling.ceilingCents,
      `${row.id}: the rule carries the same figure`);
    assert.equal(rule.status, 'calculation', `${row.id} is calculation content, never a filing position`);
  }
  // the older years answer from the history; they are not pushed into the pack, so the watch's
  // current-year comparison cannot pick up a 2017 rule for a 2026 period.
  assert.equal(pack.rules.filter(rule => rule.id.startsWith('il-osek-patur')).length, israelRows.length);
  assert.equal(osekPaturCeilingOn('2017-06-30')?.ceilingCents, ils(98_707));
});
