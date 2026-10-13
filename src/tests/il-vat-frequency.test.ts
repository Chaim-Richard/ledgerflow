/**
 * A-57: the Israeli periodic-VAT reporting frequency. Hand-checked from the authority's assignment:
 * annual turnover of ₪1,500,000 or less (excluding VAT) files bimonthly, above it monthly — the
 * boundary itself stays on the lower frequency. The check compares the registration's recorded
 * frequency with what the turnover assigns and reports a disagreement for a person; a missing side
 * is unknown, never a match. The two bands are entity-period rules with the band in the effect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IL_VAT_REPORT_FREQUENCY, IL_BIMONTHLY_TURNOVER_CEILING_CENTS,
  assignedFrequency, frequencyCheck, ilVatFrequencyPack, ilVatFrequencyProblems,
} from '../lib/tax/ilVatFilingFrequency';
import { taxRulePackProblems } from '../lib/rules/packs/index';

const DATE = '2026-10-13';

test('the table: two dated bands, ITA-sourced, no structural problems', () => {
  assert.deepEqual(ilVatFrequencyProblems(), []);
  assert.equal(IL_VAT_REPORT_FREQUENCY.length, 2);
  assert.equal(IL_BIMONTHLY_TURNOVER_CEILING_CENTS, 150_000_000, '₪1,500,000 in agorot');
  for (const row of IL_VAT_REPORT_FREQUENCY) {
    assert.match(row.source, /^https:\/\/www\.gov\.il\//, row.frequency);
    assert.match(row.due, /15th/, `${row.frequency} says when the report is due`);
  }
});

test('the assignment: the boundary stays bimonthly, above it monthly, junk is refused', () => {
  assert.equal(assignedFrequency(0, DATE), 'bimonthly');
  assert.equal(assignedFrequency(150_000_000, DATE), 'bimonthly', 'exactly ₪1,500,000 is still bimonthly');
  assert.equal(assignedFrequency(150_000_001, DATE), 'monthly');
  assert.equal(assignedFrequency(900_000_000, DATE), 'monthly');
  assert.equal(assignedFrequency(-1, DATE), undefined, 'a negative turnover is refused, not banded');
  assert.equal(assignedFrequency(Number.NaN, DATE), undefined);
});

test('the check: a match, a disagreement for a person, and never a guessed answer', () => {
  const matching = frequencyCheck({ recordedFrequency: 'bimonthly', annualTurnoverCents: 100_000_000, date: DATE });
  assert.equal(matching.assigned, 'bimonthly');
  assert.equal(matching.matches, true);

  const disagreeing = frequencyCheck({ recordedFrequency: 'monthly', annualTurnoverCents: 100_000_000, date: DATE });
  assert.equal(disagreeing.matches, false);
  assert.match(disagreeing.note, /authority's own letter governs/, 'a disagreement is for a person, with the authority named');

  const overTurnover = frequencyCheck({ recordedFrequency: 'bimonthly', annualTurnoverCents: 200_000_000, date: DATE });
  assert.equal(overTurnover.assigned, 'monthly');
  assert.equal(overTurnover.matches, false);

  const noTurnover = frequencyCheck({ recordedFrequency: 'bimonthly', annualTurnoverCents: null, date: DATE });
  assert.equal(noTurnover.assigned, undefined);
  assert.equal(noTurnover.matches, undefined, 'without a turnover nothing is concluded');
  assert.match(noTurnover.note, /stands unchallenged/);

  const noRecorded = frequencyCheck({ recordedFrequency: null, annualTurnoverCents: 200_000_000, date: DATE });
  assert.equal(noRecorded.matches, undefined);
  assert.match(noRecorded.note, /records no frequency/);

  const oddRecorded = frequencyCheck({ recordedFrequency: 'yearly', annualTurnoverCents: 100_000_000, date: DATE });
  assert.equal(oddRecorded.matches, undefined, 'a recorded frequency that is not monthly/bimonthly is reported, never matched');
  assert.match(oddRecorded.note, /not a periodic-report frequency/);

  const nothing = frequencyCheck({ date: DATE });
  assert.equal(nothing.matches, undefined);
  assert.match(nothing.note, /nothing is concluded/);
});

test('the pack: two entity-period filing rules with the band in the effect', () => {
  const pack = ilVatFrequencyPack();
  assert.equal(pack.id, 'il-vat-frequency');
  assert.equal(pack.rules.length, 2);
  assert.deepEqual(taxRulePackProblems().filter(p => p.pack === 'il-vat-frequency'), []);
  for (const rule of pack.rules) {
    assert.equal(rule.scope, 'entity-period', rule.id);
    assert.ok(rule.effect.kind === 'filing', rule.id);
    assert.equal(rule.effect.tax, 'VAT');
    assert.ok(rule.effect.revenueBand, `${rule.id} carries its band`);
    assert.equal(rule.effect.revenueBand?.currency, 'ILS');
    assert.ok(rule.when.some(c => c.attribute === 'taxTreatment'), rule.id);
  }
  const bimonthly = pack.rules.find(r => r.id === 'il-vat-frequency-bimonthly')!;
  assert.ok(bimonthly.effect.kind === 'filing');
  assert.equal(bimonthly.effect.frequency, 'bimonthly');
  assert.deepEqual(bimonthly.effect.revenueBand, { minCents: null, maxCents: 150_000_000, currency: 'ILS' });
  const monthly = pack.rules.find(r => r.id === 'il-vat-frequency-monthly')!;
  assert.ok(monthly.effect.kind === 'filing' && monthly.effect.frequency === 'monthly');
});
