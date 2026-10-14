/**
 * A-111: rule pack coverage. What the test holds: a rule's kind and place are read from the rule
 * itself (a rate that accumulates is a rate, an override is a taxability answer, a state rule is a
 * place inside its country), the packs' real coverage comes out with the four kinds the queue asks
 * about, a rule that has not started yet on the chosen date is not counted, and the gaps name the
 * places that have rules but none of a kind — never a place the packs are silent about.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coverageKindOf, coveragePlacesOf, ruleCoverage, CORE_COVERAGE_KINDS, COVERAGE_KINDS, COVERAGE_KIND_LABELS,
  RULE_COVERAGE_CSV_HEADERS, ruleCoverageCsvRows,
} from '../lib/rules/coverage';
import type { Rule } from '../lib/rules/rules';
import type { TaxEffect, TaxRulePack } from '../lib/rules/packs/shared';

const base: Omit<Rule<TaxEffect>, 'effect' | 'combine' | 'when' | 'id'> = {
  name: 'a rule',
  scope: 'line',
  validFrom: '2026-01-01',
  source: { authority: 'An authority', url: 'https://example.gov' },
  status: 'calculation',
};

const rate = (id: string, when: Rule<TaxEffect>['when'], combine: Rule<TaxEffect>['combine'] = 'accumulate'): Rule<TaxEffect> => ({
  ...base, id, combine, when, effect: { kind: 'rate', level: 'state', name: 'a rate', rate: 0.05 },
});

test('a rule gets the kind of the effect, and a rate that replaces another is a taxability answer', () => {
  assert.equal(coverageKindOf(rate('r1', [])), 'rate');
  assert.equal(coverageKindOf(rate('r2', [], 'override')), 'taxability');
  assert.equal(coverageKindOf(rate('r3', [], 'exclude')), 'taxability');
  const kinds: Array<[TaxEffect['kind'], string]> = [
    ['nexus', 'nexus'], ['registration-threshold', 'registration'], ['filing', 'filing'],
    ['marketplace', 'marketplace'], ['withholding-default', 'withholding'], ['reverse-charge', 'reverse-charge'],
    ['flat-rate-scheme', 'scheme'], ['scheme-threshold', 'scheme'], ['use-tax', 'use-tax'], ['import-vat', 'import-vat'],
  ];
  for (const [kind, expected] of kinds) {
    assert.equal(coverageKindOf({ ...base, id: kind, combine: 'accumulate', when: [], effect: { kind } as TaxEffect }), expected);
  }
  assert.equal(CORE_COVERAGE_KINDS.length, 4);
  for (const kind of COVERAGE_KINDS) assert.ok(COVERAGE_KIND_LABELS[kind], kind);
});

test('a state rule is a place inside its country, a country rule is the country, a buyer country is a place', () => {
  assert.deepEqual(coveragePlacesOf(rate('us', [{ attribute: 'country', op: 'in', values: ['US'] }, { attribute: 'state', op: 'in', values: ['TX', 'CA'] }])),
    [{ place: 'US/TX', country: 'US', region: 'TX' }, { place: 'US/CA', country: 'US', region: 'CA' }]);
  assert.deepEqual(coveragePlacesOf(rate('il', [{ attribute: 'country', op: 'in', values: ['IL'] }])), [{ place: 'IL', country: 'IL' }]);
  assert.deepEqual(coveragePlacesOf(rate('bare', [{ attribute: 'state', op: 'in', values: ['TX'] }])), [{ place: 'TX', country: '', region: 'TX' }]);
  assert.deepEqual(coveragePlacesOf(rate('buyer', [{ attribute: 'buyerCountry', op: 'in', values: ['FR', 'DE'] }])),
    [{ place: 'FR', country: 'FR' }, { place: 'DE', country: 'DE' }]);
});

test('the real packs come out with the places and kinds a reader expects', () => {
  const coverage = ruleCoverage();
  assert.ok(coverage.rows.length > 90, `places: ${coverage.rows.length}`);
  assert.ok(coverage.totals.rules > 200, `rules: ${coverage.totals.rules}`);
  const texas = coverage.rows.find(row => row.place === 'US/TX');
  assert.ok(texas, 'Texas has rules');
  assert.ok((texas!.kinds.rate || 0) >= 1, 'Texas has a state rate');
  assert.ok((texas!.kinds.nexus || 0) >= 1, 'Texas has a nexus rule');
  assert.ok((texas!.kinds.taxability || 0) >= 1, 'Texas has product taxability rules');
  assert.ok((texas!.kinds['use-tax'] || 0) >= 1, 'Texas has a use-tax rule');
  assert.ok(texas!.sources >= 1, 'Texas cites its department page');
  assert.ok(texas!.packs.includes('us-sales-tax') && texas!.packs.includes('us-nexus'));

  const israel = coverage.rows.find(row => row.place === 'IL');
  assert.ok(israel);
  for (const kind of ['rate', 'filing', 'registration', 'withholding', 'import-vat'] as const) {
    assert.ok((israel!.kinds[kind] || 0) >= 1, `Israel has ${kind}`);
  }
  for (const place of ['GB', 'DE', 'CA/QC']) assert.ok(coverage.rows.some(row => row.place === place), `${place} has rules`);
  for (const row of coverage.rows) assert.ok(row.rules >= Object.values(row.kinds).reduce((s, n) => s + n, 0), row.place);
});

test('a rule that has not started yet on the chosen date is not counted', () => {
  const early = ruleCoverage({ asOf: '2025-06-01' });
  const late = ruleCoverage({ asOf: '2026-06-01' });
  const alabamaEarly = early.rows.find(row => row.place === 'US/AL')?.kinds;
  const alabamaLate = late.rows.find(row => row.place === 'US/AL')?.kinds;
  assert.ok(alabamaEarly, 'Alabama is covered by the older tables');
  assert.equal(alabamaEarly!.marketplace, undefined, 'the marketplace pack is asserted from 2026');
  assert.ok((alabamaLate?.marketplace || 0) >= 1, 'from 2026 Alabama has a marketplace rule');
  assert.ok(late.totals.rules > early.totals.rules, 'later dates carry the newer tables');
});

test('the gaps name the places that have rules but none of a kind, and a place the packs never mention is absent', () => {
  const { gaps, rows } = ruleCoverage();
  assert.deepEqual(gaps.map(gap => gap.kind), CORE_COVERAGE_KINDS);
  const filing = gaps.find(gap => gap.kind === 'filing')!;
  assert.ok(filing.places.includes('US/TX'), 'Texas has no state filing rule in this lane');
  const places = new Set(rows.map(row => row.place));
  for (const gap of gaps) for (const place of gap.places) assert.ok(places.has(place), `${place} is a gap only for a place the packs cover`);
  assert.equal(places.has('FR/IDF'), false, 'a place no pack mentions is not a row');
});

test('the CSV carries one row per place with every kind and its source count', () => {
  const coverage = ruleCoverage({ asOf: '2026-10-13' });
  const rows = ruleCoverageCsvRows(coverage);
  assert.equal(rows.length, coverage.rows.length);
  for (const row of rows) assert.equal(row.length, RULE_COVERAGE_CSV_HEADERS.length);
  assert.equal(RULE_COVERAGE_CSV_HEADERS[0], 'Place');
  assert.ok(RULE_COVERAGE_CSV_HEADERS.includes('Rate') && RULE_COVERAGE_CSV_HEADERS.includes('Filing'));
});

test('a pack list given to the reader is what it reads (and nothing else)', () => {
  const only: TaxRulePack = { id: 'test-pack', name: 'Test pack', rules: [
    rate('a', [{ attribute: 'country', op: 'in', values: ['IL'] }]),
    { ...base, id: 'b', combine: 'accumulate', when: [{ attribute: 'country', op: 'in', values: ['IL'] }], effect: { kind: 'filing', form: 'Form X', frequency: 'yearly', due: 'a day' } },
  ], unmapped: [] };
  const coverage = ruleCoverage({ packs: [only] });
  assert.equal(coverage.rows.length, 1);
  assert.deepEqual(coverage.rows[0].kinds, { rate: 1, filing: 1 });
  assert.deepEqual(coverage.totals, { places: 1, rules: 2, packs: 1 });
});
