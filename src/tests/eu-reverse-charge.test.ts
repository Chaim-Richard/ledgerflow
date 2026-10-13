/**
 * A-52: EU cross-border B2B reverse charge through the rule graph. Hand-checked golden cases on the
 * directive's own scheme: a German supplier selling services to a French business with a **verified**
 * valid VAT number gets its own standard-rate rule switched off and the reverse-charge rule applied;
 * a merely declared VAT number leaves the rule blocked (the block names what is missing); a domestic
 * buyer or a buyer outside the EU changes nothing; goods and services are separate rules with their
 * own articles and dates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { euReverseChargePack, EU_MEMBER_STATES, EU_MEMBER_STATE_CODES } from '../lib/rules/packs/euReverseChargePack';
import { euVatPack } from '../lib/rules/packs/euVatPack';
import { taxRulePackProblems } from '../lib/rules/packs/index';
import { evaluateRules } from '../lib/rules/rules';
import { composeFacts, type Fact } from '../lib/rules/facts';
import { EU_VAT_RATES } from '../lib/tax/euVat';

const DATE = '2026-10-13';
const verifiedVies = { kind: 'registration' as const, ref: 'VIES FR12345678901', verifiedBy: 'uid-accountant', verifiedAt: '2026-10-01' };
const declaredOnly = { kind: 'declared' as const };

const factsFor = (books: Fact[]) => composeFacts({ books }, {}, [], DATE);
const deStandard = () => EU_VAT_RATES.filter(r => r.country === 'DE' && r.kind === 'standard').map(r => r.rate);

function evaluate(books: Fact[]) {
  return evaluateRules([...euVatPack().rules, ...euReverseChargePack().rules], factsFor(books), { date: DATE, scope: 'line' });
}

const crossBorderServices: Fact[] = [
  { attribute: 'country', value: 'DE' },
  { attribute: 'buyerCountry', value: 'FR' },
  { attribute: 'supplyKind', value: 'services' },
  { attribute: 'buyerVatStatus', value: 'valid', evidence: verifiedVies },
];

test('every member state has a services and a goods rule, and the pack holds to its promises', () => {
  assert.equal(EU_MEMBER_STATE_CODES.length, 27, 'the codes come from A-25\'s own table');
  assert.ok(EU_MEMBER_STATE_CODES.includes('EL') && !EU_MEMBER_STATE_CODES.includes('GR'), 'Greece is EL, as the EU uses it');
  const pack = euReverseChargePack();
  assert.equal(pack.rules.length, 54, 'two rules per member state');
  assert.deepEqual(taxRulePackProblems().filter(p => p.pack === 'eu-reverse-charge'), []);
  for (const state of EU_MEMBER_STATES) {
    assert.ok(state.standardRuleIds.length >= 1, `${state.country} has standard-rate rules to switch off`);
  }
  for (const rule of pack.rules) {
    assert.equal(rule.combine, 'exclude', rule.id);
    assert.ok(rule.requiresVerified?.includes('buyerVatStatus'), rule.id);
    assert.ok(rule.effect.kind === 'reverse-charge' && rule.effect.taxedBy === 'buyer', rule.id);
    assert.match(rule.source.url, /^https:\/\/eur-lex\.europa\.eu\//, rule.id);
  }
});

test('a verified French buyer switches the German standard rate off for services', () => {
  const outcome = evaluate(crossBorderServices as Fact[]);
  const applied = outcome.applied.map(a => a.rule.id);
  assert.ok(applied.includes('eu-rc-services-de'), applied.join(','));
  assert.ok(!applied.some(id => id.startsWith('eu-de-standard')), 'the supplier charges none of its own VAT');
  assert.equal(outcome.displaced.length, deStandard().length, 'every German standard-rate rule is displaced');
  assert.equal(outcome.displaced[0].by, 'eu-rc-services-de');
  const effect = outcome.applied.find(a => a.rule.id === 'eu-rc-services-de')!.rule.effect;
  assert.ok(effect.kind === 'reverse-charge');
  assert.match(effect.basis, /Art\. 44/);
  assert.match(effect.basis, /Art\. 196/);
});

test('a merely declared VAT number leaves the rule blocked and the German rate stands', () => {
  const outcome = evaluate([
    ...crossBorderServices.slice(0, 3),
    { attribute: 'buyerVatStatus', value: 'valid', evidence: declaredOnly },
  ] as Fact[]);
  // until the number is verified the supplier's own VAT is not switched off: the safe side
  assert.deepEqual(outcome.applied.map(a => a.rule.id), ['eu-de-standard-2007-01-01-0-19'], 'the German rate stands on a label alone');
  assert.equal(outcome.blocked.length, 1);
  assert.equal(outcome.blocked[0].rule.id, 'eu-rc-services-de');
  assert.deepEqual(outcome.blocked[0].unverified, ['buyerVatStatus'], 'the block says what is missing');
  assert.deepEqual(outcome.displaced, []);
});

test('intra-community goods use their own rule, article and 1993 date', () => {
  const outcome = evaluate([
    { attribute: 'country', value: 'DE' },
    { attribute: 'buyerCountry', value: 'FR' },
    { attribute: 'supplyKind', value: 'goods' },
    { attribute: 'buyerVatStatus', value: 'valid', evidence: verifiedVies },
  ] as Fact[]);
  const applied = outcome.applied.map(a => a.rule.id);
  assert.ok(applied.includes('eu-rc-goods-de') && !applied.includes('eu-rc-services-de'), applied.join(','));
  const goods = euReverseChargePack().rules.find(r => r.id === 'eu-rc-goods-de')!;
  assert.equal(goods.validFrom, '1993-01-01', 'the single market');
  assert.ok(goods.effect.kind === 'reverse-charge' && /Art\. 138/.test(goods.effect.basis));
  const services = euReverseChargePack().rules.find(r => r.id === 'eu-rc-services-de')!;
  assert.equal(services.validFrom, '2010-01-01', 'Directive 2008/8/EC');
});

test('three country pairs: each supplier state gets its own rule and its own rate switched off', () => {
  for (const [supplier, buyer] of [['DE', 'FR'], ['FR', 'DE'], ['NL', 'IE']] as const) {
    const outcome = evaluate([
      { attribute: 'country', value: supplier },
      { attribute: 'buyerCountry', value: buyer },
      { attribute: 'supplyKind', value: 'services' },
      { attribute: 'buyerVatStatus', value: 'valid', evidence: verifiedVies },
    ] as Fact[]);
    const applied = outcome.applied.map(a => a.rule.id);
    assert.deepEqual(applied, [`eu-rc-services-${supplier.toLowerCase()}`], `${supplier}→${buyer}: ${applied.join(',')}`);
    assert.equal(outcome.displaced.length, 1, `${supplier}→${buyer}`);
    assert.ok(outcome.displaced[0].rule.id.startsWith(`eu-${supplier.toLowerCase()}-standard`), outcome.displaced[0].rule.id);
    assert.equal(outcome.displaced[0].by, `eu-rc-services-${supplier.toLowerCase()}`);
  }
});

test('a domestic buyer, a non-EU buyer or no supply kind changes nothing', () => {
  const domestic = evaluate([
    { attribute: 'country', value: 'DE' },
    { attribute: 'buyerCountry', value: 'DE' },
    { attribute: 'supplyKind', value: 'services' },
    { attribute: 'buyerVatStatus', value: 'valid', evidence: verifiedVies },
  ] as Fact[]);
  assert.ok(domestic.applied.some(a => a.rule.id.startsWith('eu-de-standard')), 'a domestic B2B service keeps German VAT');
  assert.deepEqual(domestic.applied.filter(a => a.rule.id.startsWith('eu-rc-')), []);

  const outside = evaluate([
    { attribute: 'country', value: 'DE' },
    { attribute: 'buyerCountry', value: 'US' },
    { attribute: 'supplyKind', value: 'services' },
    { attribute: 'buyerVatStatus', value: 'valid', evidence: verifiedVies },
  ] as Fact[]);
  assert.deepEqual(outside.applied.filter(a => a.rule.id.startsWith('eu-rc-')), [], 'a buyer outside the EU is not this rule');

  const noKind = evaluate([
    { attribute: 'country', value: 'DE' },
    { attribute: 'buyerCountry', value: 'FR' },
    { attribute: 'buyerVatStatus', value: 'valid', evidence: verifiedVies },
  ] as Fact[]);
  assert.deepEqual(noKind.applied.filter(a => a.rule.id.startsWith('eu-rc-')), [], 'goods and services stay apart: no supply kind, no reverse charge');
});
