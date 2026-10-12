/**
 * A-41: a sale through a marketplace is the marketplace's to tax. What the test holds:
 *  - every state with a state sales tax has one dated channel rule with an https source, and the
 *    five states without a state sales tax are reported with their reason instead;
 *  - `channel = marketplace` really switches the state rate rule off through `evaluateRules`, and the
 *    outcome says which rule did it (the evidence trail);
 *  - a direct sale is untouched, and a conflicting channel fact leaves the answer undecided;
 *  - a jurisdiction that switched the channel later can be expressed with `validTo`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceChannelPack, marketplaceRuleId, taxRulePackProblems, usSalesTaxPack } from '../lib/rules/packs/index';
import { evaluateRules } from '../lib/rules/rules';
import { composeFacts, type Fact } from '../lib/rules/facts';
import { US_MARKETPLACE_FACILITATORS, US_MARKETPLACE_ROW_LIMITS, marketplaceFacilitatorRow } from '../lib/tax/usMarketplaceFacilitator';
import { US_STATE_SALES_TAX } from '../lib/tax/usStateSalesTax';

const DATE = '2026-10-12';

const factsFor = (input: { state: string; channel?: string; secondChannel?: string }) => composeFacts({
  books: [
    { attribute: 'country', value: 'US' } as Fact,
    { attribute: 'state', value: input.state } as Fact,
    ...(input.channel ? [{ attribute: 'channel', value: input.channel } as Fact] : []),
    ...(input.secondChannel ? [{ attribute: 'channel', value: input.secondChannel } as Fact] : []),
  ],
}, {}, [], DATE);

test('every state with a sales tax has one channel rule; the rest are reported', () => {
  const pack = marketplaceChannelPack();
  const statesWithTax = US_STATE_SALES_TAX.filter(row => row.rate > 0).map(row => row.state);
  assert.deepEqual(pack.rules.map(r => (r.effect as { state: string }).state), statesWithTax);
  assert.equal(new Set(pack.rules.map(r => r.id)).size, pack.rules.length, 'one rule per state');
  for (const rule of pack.rules) {
    assert.match(rule.source.url, /^https:\/\//, rule.id);
    assert.equal(rule.status, 'calculation');
    assert.equal(rule.validFrom, '2026-01-01');
    assert.ok(rule.targets?.length, `${rule.id} names the rate rules it switches off`);
    assert.ok(rule.targets?.every(t => t.startsWith('us-sales-')), rule.id);
    assert.deepEqual(rule.when.map(c => c.attribute).sort(), ['channel', 'country', 'state']);
  }
  assert.deepEqual(pack.unmapped.map(u => u.row.split(' ')[0]), US_MARKETPLACE_ROW_LIMITS.map(r => r.state));
  assert.ok(pack.unmapped.every(u => /no state sales tax/.test(u.reason)));
});

test('nothing in the pack has a packing problem', () => {
  assert.deepEqual(taxRulePackProblems(), []);
});

test('a marketplace sale switches the state rate off and says who did it', () => {
  const facts = factsFor({ state: 'TX', channel: 'marketplace' });
  const outcome = evaluateRules([...usSalesTaxPack().rules, ...marketplaceChannelPack().rules], facts, { date: DATE, scope: 'line' });
  assert.deepEqual(outcome.applied.map(a => a.rule.id), ['us-marketplace-tx-2026-01-01']);
  assert.ok(outcome.displaced.some(d => d.rule.id.startsWith('us-sales-tx') && d.by === 'us-marketplace-tx-2026-01-01'));
  const effect = outcome.applied[0].rule.effect as { kind: string; stateName: string; assertedFrom: string };
  assert.equal(effect.kind, 'marketplace');
  assert.equal(effect.stateName, 'Texas');
  assert.equal(effect.assertedFrom, '2026-01-01');
});

test('a direct sale is untouched and keeps paying the state rate', () => {
  const outcome = evaluateRules([...usSalesTaxPack().rules, ...marketplaceChannelPack().rules], factsFor({ state: 'TX', channel: 'direct' }), { date: DATE, scope: 'line' });
  assert.deepEqual(outcome.applied.map(a => a.rule.id), ['us-sales-tx-2000-01-01']);
  assert.equal(outcome.displaced.length, 0);
});

test('two dimensions stating a different channel leave the answer undecided, never silently chosen', () => {
  // channel is a single-valued attribute: a label stating 'marketplace' and another stating 'direct'
  // is exactly the case the rule graph must not resolve by itself
  const conflicting = composeFacts({
    books: [
      { attribute: 'country', value: 'US' } as Fact,
      { attribute: 'state', value: 'TX' } as Fact,
    ],
    labels: {
      'salesChannel:online': [{ attribute: 'channel', value: 'marketplace' } as Fact],
      'orderSource:manual': [{ attribute: 'channel', value: 'direct' } as Fact],
    },
  }, { salesChannel: 'online', orderSource: 'manual' }, ['salesChannel', 'orderSource'], DATE);
  assert.deepEqual(conflicting.conflicts.map(c => c.attribute), ['channel']);
  const outcome = evaluateRules(marketplaceChannelPack().rules, conflicting, { date: DATE, scope: 'line' });
  assert.equal(outcome.applied.length, 0);
  assert.equal(outcome.displaced.length, 0);
  assert.equal(outcome.undecided.length, 1, 'the Texas channel rule waits for the channel to be resolved');
  assert.deepEqual(outcome.undecided[0].conflicting, ['channel']);
});

test('a channel rule for another state does not touch this state', () => {
  const outcome = evaluateRules(marketplaceChannelPack().rules, factsFor({ state: 'CA', channel: 'marketplace' }), { date: DATE, scope: 'line' });
  assert.deepEqual(outcome.applied.map(a => a.rule.id), ['us-marketplace-ca-2026-01-01']);
});

test('the lookup and the rule id agree with the table', () => {
  const row = marketplaceFacilitatorRow('tx', DATE);
  assert.ok(row);
  assert.equal(row.stateName, 'Texas');
  assert.equal(marketplaceRuleId('TX', DATE), 'us-marketplace-tx-2026-01-01');
  assert.equal(marketplaceRuleId('TX', '2018-01-01'), undefined, 'the rule is not asserted before its own date');
  assert.equal(marketplaceFacilitatorRow('MT', DATE), undefined, 'Montana has no state sales tax row');
  assert.equal(US_MARKETPLACE_FACILITATORS.length, 46, '45 states with a state sales tax and DC');
});

test('a state that ends its channel rule is expressed with validTo, not by deleting the row', () => {
  const pack = marketplaceChannelPack();
  const withEnd = { ...pack, rules: pack.rules.map(r => (r.id === 'us-marketplace-tx-2026-01-01' ? { ...r, validTo: '2026-06-30' } : r)) };
  const after = evaluateRules(withEnd.rules, factsFor({ state: 'TX', channel: 'marketplace' }), { date: DATE, scope: 'line' });
  assert.equal(after.applied.length, 0, 'the rule is out of force after its own end date');
});
