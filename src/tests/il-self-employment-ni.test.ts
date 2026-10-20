/**
 * A-102: the self-employed National Insurance table, its two calculations and its worked figures.
 *
 * Every expected number below is either the Authority's own published figure (its January 2026
 * example, its published advance floor and ceiling) or the arithmetic of its published rates on its
 * published amounts, spelled out in the test so a reviewer can check it by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IL_SELF_EMPLOYMENT_NI_ROWS,
  ilSelfEmploymentNiRowForYear,
  ilSelfEmploymentNiRowOn,
  ilSelfEmploymentNiMonthlyAdvanceCents,
  ilSelfEmploymentNiPeriodSettlementCents,
  ilSelfEmploymentNiRoundToShekelCents,
  ilSelfEmploymentNiProblems,
} from '../lib/tax/ilSelfEmploymentNationalInsurance';

test('the table is structurally sound and reproduces what the Authority published beside it', () => {
  assert.deepEqual(ilSelfEmploymentNiProblems(), []);
  assert.equal(IL_SELF_EMPLOYMENT_NI_ROWS.length, 2);
});

test('the bands are the amounts the Authority published, and a year it has not answered stays unknown', () => {
  const y2025 = ilSelfEmploymentNiRowForYear(2025)!;
  assert.equal(y2025.validFrom, '2025-02-01');
  assert.deepEqual(
    [y2025.minMonthlyIncomeCents, y2025.reducedBandCeilingCents, y2025.maxMonthlyIncomeCents],
    [313400, 752200, 5069500],
  );
  const y2026 = ilSelfEmploymentNiRowForYear(2026)!;
  assert.equal(y2026.validFrom, '2026-01-01');
  assert.deepEqual(
    [y2026.minMonthlyIncomeCents, y2026.reducedBandCeilingCents, y2026.maxMonthlyIncomeCents],
    [344200, 770300, 5191000],
  );
  // the two health rates and the two national-insurance rates, and the sums the Authority prints
  assert.deepEqual([y2026.niReducedBp, y2026.niFullBp, y2026.healthReducedBp, y2026.healthFullBp], [447, 1283, 323, 517]);
  assert.equal(y2026.niReducedBp + y2026.healthReducedBp, 770, 'the reduced band is 7.70% together');
  assert.equal(y2026.niFullBp + y2026.healthFullBp, 1800, 'the regular band is 18.00% together');
  // no row before 1 February 2025 and none in 2024: the missing figures are not guessed
  assert.equal(ilSelfEmploymentNiRowOn('2025-01-31'), undefined);
  assert.equal(ilSelfEmploymentNiRowOn('2024-06-15'), undefined);
  assert.equal(ilSelfEmploymentNiRowOn('2027-01-01'), y2026, 'the open row is in force until the Authority says otherwise');
});

test('the monthly advance is the rates on the income, split at the reduced grade', () => {
  // ₪12,000 a month in 2026: 7,703 at 7.70% and 4,297 at 18.00%
  const at = ilSelfEmploymentNiMonthlyAdvanceCents(1200000, '2026-06-15')!;
  assert.deepEqual(
    [at.baseCents, at.reducedBaseCents, at.fullBaseCents, at.niCents, at.healthCents, at.totalCents],
    [1200000, 770300, 429700, 89563, 47096, 136659],
  );
  // 7,703 * 0.077 = 593.131 and 4,297 * 0.18 = 773.46 — together 1,366.59
  assert.equal(ilSelfEmploymentNiRoundToShekelCents(at.totalCents), 136700);
  // exactly at the grade the regular band is empty
  const atGrade = ilSelfEmploymentNiMonthlyAdvanceCents(770300, '2026-06-15')!;
  assert.deepEqual([atGrade.fullBaseCents, atGrade.totalCents], [0, 59313]);
  // below the minimum assessable income the Authority charges on the minimum: its own floor
  const floor = ilSelfEmploymentNiMonthlyAdvanceCents(100000, '2026-06-15')!;
  assert.equal(floor.clampedToMinimum, true);
  assert.equal(floor.baseCents, 344200);
  assert.equal(ilSelfEmploymentNiRoundToShekelCents(floor.totalCents), 26500, 'the published 2026 minimum advance is ₪265');
  // and nothing at all above the maximum: its own ceiling
  const ceiling = ilSelfEmploymentNiMonthlyAdvanceCents(9000000, '2026-06-15')!;
  assert.equal(ceiling.clampedToMaximum, true);
  assert.equal(ceiling.baseCents, 5191000);
  assert.equal(ilSelfEmploymentNiRoundToShekelCents(ceiling.totalCents), 855000, 'the published 2026 maximum advance is ₪8,550');
  assert.equal(ilSelfEmploymentNiMonthlyAdvanceCents(-1, '2026-06-15'), undefined);
  assert.equal(ilSelfEmploymentNiMonthlyAdvanceCents(1200000, '2024-06-15'), undefined, 'no row, no figure');
});

test('the settlement cuts 52% of the national-insurance contribution out of the base, as section 345 says', () => {
  // The Authority's own example: ₪12,000 a month in January 2026, computed per quarter.
  const q = ilSelfEmploymentNiPeriodSettlementCents(3600000, '2026-01-15', 3)!;
  assert.equal(q.baseCents, 3469020, 'the Authority prints 34,690 as the quarterly base');
  assert.equal(q.reducedBaseCents, 2310900, '3 * 7,703 is the reduced-grade part');
  assert.equal(q.fullBaseCents, 1158120, 'and the Authority prints 11,581 for the rest');
  assert.equal(q.niCents, 251884, '1,032.97 at the reduced rate plus 1,485.87 at the regular one');
  assert.equal(q.healthCents, 134517, '746.42 plus 598.75');
  assert.equal(q.totalCents, 386401);
  assert.equal(ilSelfEmploymentNiRoundToShekelCents(q.totalCents), 386400, 'the Authority publishes ₪3,864 for the quarter');
  assert.equal(q.section345DeductionCents, 130980, 'the base fell by 52% of the national-insurance part');
});

test('the advance and the settlement are different answers and neither is the others', () => {
  const advanceForQuarter = ilSelfEmploymentNiMonthlyAdvanceCents(1200000, '2026-01-15')!.totalCents * 3;
  const settlement = ilSelfEmploymentNiPeriodSettlementCents(3600000, '2026-01-15', 3)!.totalCents;
  assert.equal(advanceForQuarter, 409977);
  assert.equal(settlement, 386401);
  assert.ok(advanceForQuarter > settlement, 'charging the advance as the liability overpays by about 6%');
  assert.ok(advanceForQuarter - settlement < 2500000, 'and by a small fraction of the quarter, not a band');
});

test('a month inside the reduced grade still gets the section-345 deduction, and 2025 answers from its own row', () => {
  const below = ilSelfEmploymentNiPeriodSettlementCents(1800000, '2026-01-15', 3)!;
  assert.equal(below.fullBaseCents, 0, '₪6,000 a month is under the grade');
  assert.equal(below.baseCents, 1759111, 'base = income ÷ (1 + 0.52 × 4.47%)');
  const in2025 = ilSelfEmploymentNiPeriodSettlementCents(3600000, '2025-06-15', 3)!;
  assert.equal(in2025.reducedBaseCents, 2256600, '3 * 7,522 is 2025’s grade, not 2026’s');
  assert.notEqual(in2025.totalCents, 386401, 'the same income in 2025 is a different figure');
});
