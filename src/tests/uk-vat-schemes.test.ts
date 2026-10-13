/**
 * A-53: the UK's VAT special schemes. Hand-checked from GOV.UK's own figures: the limited-cost
 * trader rate is 16.5%, the first year of FRS registration takes 1 percentage point off (14.5%
 * accountancy becomes 13.5%), the cash and annual accounting thresholds were raised to £1,350,000
 * on 1 April 2022, and FRS entry/exit are £150,000/£230,000. Through the graph: a declared scheme
 * category replaces the UK standard rate; without the category the standard 20% stands. The table
 * states only the categories it is confident of — GOV.UK's full table governs a category not here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { UK_FRS_CATEGORIES, UK_VAT_SCHEME_THRESHOLDS, ukFrsCategory, ukFrsPercent, ukSchemeProblems } from '../lib/tax/ukVatSchemes';
import { UK_VAT_RATES } from '../lib/tax/ukVat';
import { slug } from '../lib/rules/packs/shared';
import { ukSchemesPack, ukStandardRuleIds } from '../lib/rules/packs/ukSchemesPack';
import { ukVatPack } from '../lib/rules/packs/ukVatPack';
import { taxRulePackProblems } from '../lib/rules/packs/index';
import { evaluateRules } from '../lib/rules/rules';
import { composeFacts, type Fact } from '../lib/rules/facts';

const DATE = '2026-10-13';

test('the table holds to its own promises', () => {
  assert.deepEqual(ukSchemeProblems(), []);
  assert.ok(UK_FRS_CATEGORIES.length >= 40, `${UK_FRS_CATEGORIES.length} categories stated`);
  const limited = ukFrsCategory('limited-cost-trader', DATE);
  assert.equal(limited?.percent, 16.5);
  assert.match(limited?.note || '', /2%/, 'the goods test is stated on the row');
  assert.equal(ukFrsCategory('accountancy', DATE)?.percent, 14.5);
  assert.equal(ukFrsCategory('retail-food', DATE)?.percent, 4);
  assert.equal(ukFrsCategory('made-up-category', DATE), undefined, 'a category not in the table is never guessed');
  assert.equal(ukFrsCategory('accountancy', '2017-03-31'), undefined, 'the rates are dated from 1 April 2017');
});

test('the first year takes one percentage point off, never below zero', () => {
  assert.equal(ukFrsPercent('accountancy', DATE), 14.5);
  assert.equal(ukFrsPercent('accountancy', DATE, true), 13.5);
  assert.equal(ukFrsPercent('limited-cost-trader', DATE, true), 15.5);
  assert.equal(ukFrsPercent('unknown', DATE, true), undefined);
});

test('the scheme thresholds are GOV.UK figures, dated', () => {
  const byId = new Map(UK_VAT_SCHEME_THRESHOLDS.map(row => [row.id, row]));
  assert.equal(byId.get('uk-flat-rate-entry')?.thresholdCents, 15_000_000, '£150,000 excluding VAT');
  assert.equal(byId.get('uk-flat-rate-exit')?.thresholdCents, 23_000_000, '£230,000 total income');
  assert.match(byId.get('uk-flat-rate-exit')?.measure || '', /total income/i, 'the exit test measures a different thing than the entry one');
  assert.equal(byId.get('uk-cash-accounting')?.thresholdCents, 135_000_000, '£1,350,000');
  assert.equal(byId.get('uk-cash-accounting')?.validFrom, '2022-04-01', 'raised on 1 April 2022');
  assert.equal(byId.get('uk-annual-accounting')?.thresholdCents, 135_000_000);
  for (const row of UK_VAT_SCHEME_THRESHOLDS) assert.equal(row.currency, 'GBP', row.id);
});

test('the pack: one override rule per category, entity-period thresholds, no pack problems', () => {
  const pack = ukSchemesPack();
  assert.equal(pack.id, 'uk-vat-schemes');
  assert.equal(pack.rules.length, UK_FRS_CATEGORIES.length + UK_VAT_SCHEME_THRESHOLDS.length);
  assert.deepEqual(taxRulePackProblems().filter(p => p.pack === 'uk-vat-schemes'), [], 'including: every override target exists in A-26\'s pack');
  const accountancy = pack.rules.find(r => r.id === 'uk-frs-accountancy')!;
  assert.equal(accountancy.scope, 'line');
  assert.equal(accountancy.combine, 'override');
  assert.deepEqual(accountancy.targets, ukStandardRuleIds());
  assert.ok(accountancy.effect.kind === 'flat-rate-scheme' && accountancy.effect.percent === 14.5);
  assert.equal(accountancy.effect.firstYearDiscountPoints, 1);
  const cash = pack.rules.find(r => r.id === 'uk-scheme-uk-cash-accounting')!;
  assert.equal(cash.scope, 'entity-period');
  assert.ok(cash.effect.kind === 'scheme-threshold' && cash.effect.thresholdCents === 135_000_000);
});

test('a declared scheme category replaces the UK standard rate; without it 20% stands', () => {
  // A-26's UK rate rules, so the override has something real to replace
  const rules = [...ukSchemesPack().rules, ...ukVatPack().rules];
  const standard = ukStandardRuleIds();
  // only the standard rule in force on the date is a candidate the override can displace
  const inForceStandard = standard.filter(id => UK_VAT_RATES.some(row =>
    row.kind === 'standard' && row.validFrom <= DATE && (!row.validTo || DATE <= row.validTo) &&
    id === `uk-vat-standard-${slug(row.validFrom)}-${slug(String(row.rate))}`));
  assert.equal(inForceStandard.length, 1, 'one UK standard rate is in force today (20%)');
  const withCategory = evaluateRules(rules, composeFacts({ books: [
    { attribute: 'country', value: 'GB' } as Fact,
    { attribute: 'schemeCategory', value: 'accountancy' } as Fact,
  ] }, {}, [], DATE), { date: DATE, scope: 'line' });
  const applied = withCategory.applied.map(a => a.rule.id);
  assert.ok(applied.includes('uk-frs-accountancy'), applied.join(','));
  assert.ok(!applied.some(id => standard.includes(id)), 'the standard-rate rule is replaced');
  assert.deepEqual(withCategory.displaced.map(d => d.rule.id), inForceStandard);

  const without = evaluateRules(rules, composeFacts({ books: [
    { attribute: 'country', value: 'GB' } as Fact,
  ] }, {}, [], DATE), { date: DATE, scope: 'line' });
  assert.deepEqual(without.applied.filter(a => a.rule.id.startsWith('uk-frs-')), []);
  assert.ok(without.applied.some(a => standard.includes(a.rule.id)), 'no category, no scheme: the standard rate stands');
});
