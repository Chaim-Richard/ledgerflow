/**
 * AI #1's answers (2) and (3), 20 Oct evening, corrected by #258's review against the states' own notices, with worked
 * figures:
 *  - A reduced grocery rate replaces the state's general rate (it used to be added to it: Illinois 6.25% + 1% =
 *    7.25%). Every reduced row now holds the state part only: Alabama 2% (from 1 Sep 2025, Act 2025-305), Missouri
 *    1.225%, Mississippi 5%, South Dakota 4.2%, Tennessee 4%, Utah 1.75% (3% with its 1% local and 0.25% county
 *    options). A $100.00 grocery sale in Utah carries $1.75 of state tax; in Alabama $2.00.
 *  - Illinois (state 1% repealed 1 Jan 2026) and Arkansas (state 0.125% repealed 1 Jan 2026) groceries carry no state
 *    tax in 2026: $100.00 → $0.00 state; local grocery taxes may still apply and are named in the row's note.
 *    Virginia's state part is 0 since 2023; its 1% local tax is named in the note. Illinois prescription medicine
 *    keeps its 1% state rate.
 *  - New York's economic-nexus test is "more than $500,000 and more than 100 sales": exactly $500,000.00 or exactly
 *    100 sales has not crossed it; $500,000.01 with 101 sales has. "Or more" states (Texas) are unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleRateTable } from '../lib/tax/ruleRateTable';
import { nexusWatch } from '../lib/tax/usNexus';
import { productTaxabilityRows } from '../lib/tax/usProductTaxability';
import { overlappingStateSalesRuleIds } from '../lib/rules/packs/productTaxabilityPack';
import { usNexusPack } from '../lib/rules/packs/usNexusPack';

const table = ruleRateTable();
const DATE = '2026-08-10';
const stateTax = (state: string, category?: string) => {
  const parts = table({ country: 'US', state, city: 'X' }, DATE, category) || [];
  return Math.round(parts.reduce((s, p) => s + p.rate, 0) * 1e6) / 1e6;
};

test('every reduced grocery rate replaces its state rate (one state part, never two added)', () => {
  const reduced: Record<string, number> = { AL: 0.02, MO: 0.01225, MS: 0.05, SD: 0.042, TN: 0.04, UT: 0.0175 };
  for (const [state, rate] of Object.entries(reduced)) assert.equal(stateTax(state, 'groceries'), rate, state);
  assert.equal(Math.round(10_000 * stateTax('UT', 'groceries')), 175, 'Utah: $100.00 = 10,000 cents × 1.75% = 175 cents');
  assert.equal(Math.round(10_000 * stateTax('AL', 'groceries')), 200, 'Alabama: $100.00 × 2% = $2.00');
  assert.equal(stateTax('TX', 'groceries'), 0, 'an exemption is still 0');
});

test('#258 review: Illinois and Arkansas groceries carry no state tax in 2026; the local taxes are named, not invented', () => {
  assert.equal(stateTax('IL', 'groceries'), 0);
  assert.equal(Math.round(10_000 * stateTax('IL', 'groceries')), 0, '$100.00 → $0.00 state tax');
  assert.equal(stateTax('AR', 'groceries'), 0);
  assert.equal(stateTax('IL', 'general'), 0.0625, 'other Illinois goods keep the state rate');
  assert.equal(stateTax('IL', 'prescription-medicine'), 0.01, 'Illinois prescription medicine keeps its 1%');
  assert.match(productTaxabilityRows('IL', 'groceries')[0].note || '', /may levy its own 1% grocery tax by ordinance/);
  assert.match(productTaxabilityRows('AR', 'groceries')[0].note || '', /city and county grocery taxes remain/);
  assert.equal(stateTax('VA', 'groceries'), 0, 'Virginia: no state part since 2023');
  assert.match(productTaxabilityRows('VA', 'groceries')[0].note || '', /the 1% local tax applies in every locality/);
  assert.match(productTaxabilityRows('UT', 'groceries')[0].note || '', /the rate is 3% everywhere/);
});

test('#258 review: a category row switches off every state rate row its dates overlap, not only the one on its first day', () => {
  // Texas has one general-rate row from 1990 with no end: it overlaps any 2026 row
  assert.deepEqual(overlappingStateSalesRuleIds('TX', '2026-01-01').length, 1);
  // a category row that ended before a state row began does not reach it
  assert.deepEqual(overlappingStateSalesRuleIds('TX', '1980-01-01', '1980-12-31'), []);
});

test('New York: exactly $500,000.00 and exactly 100 sales has not crossed "more than"; one cent and one sale more has', () => {
  const at = nexusWatch({ state: 'NY', salesCents: 50_000_000, orders: 100 }, DATE)!;
  assert.deepEqual([at.crossed, at.warning, at.ratio], [false, true, 1]);
  const over = nexusWatch({ state: 'NY', salesCents: 50_000_001, orders: 101 }, DATE)!;
  assert.equal(over.crossed, true);
  // both tests are needed: over on sales, exactly 100 sales → not crossed
  assert.equal(nexusWatch({ state: 'NY', salesCents: 60_000_000, orders: 100 }, DATE)!.crossed, false);
  // Texas says "$500,000 or more": exactly the threshold has crossed
  assert.equal(nexusWatch({ state: 'TX', salesCents: 50_000_000, orders: 1 }, DATE)!.crossed, true);
});

test('#258 review: the New York rule says "more than" in its effect and its name', () => {
  const rules = usNexusPack().rules;
  const ny = rules.find(r => r.id.startsWith('us-nexus-ny-'))!;
  assert.equal((ny.effect as { strict?: boolean }).strict, true);
  assert.match(ny.name, /more than \$500,000 or more than 100 transactions, both required/);
  const tx = rules.find(r => r.id.startsWith('us-nexus-tx-'))!;
  assert.equal((tx.effect as { strict?: boolean }).strict, undefined);
  assert.doesNotMatch(tx.name, /more than/);
});
