/**
 * AI #1's answers (2) and (3), 20 Oct evening, with worked figures:
 *  - Illinois groceries are taxed at a reduced 1% state rate that replaces the 6.25% state rate (local rates still
 *    add): a $100.00 grocery sale in Illinois carries $1.00 of state tax, not $7.25. The other reduced rows (groceries
 *    in AL, AR, MO, MS, SD, TN, UT; Illinois prescription medicine) replace their state rate the same way.
 *  - New York's economic-nexus test is "more than $500,000 and more than 100 sales": exactly $500,000.00 or exactly
 *    100 sales has not crossed it; $500,000.01 with 101 sales has. "Or more" states (Texas) are unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleRateTable } from '../lib/tax/ruleRateTable';
import { nexusWatch } from '../lib/tax/usNexus';

const table = ruleRateTable();
const DATE = '2026-08-10';
const stateTax = (state: string, category?: string) => {
  const parts = table({ country: 'US', state, city: 'X' }, DATE, category) || [];
  return Math.round(parts.reduce((s, p) => s + p.rate, 0) * 1e6) / 1e6;
};

test('Illinois groceries: 1% state, not 6.25% + 1% = 7.25%; $100.00 → $1.00', () => {
  assert.equal(stateTax('IL', 'groceries'), 0.01);
  assert.equal(Math.round(10_000 * stateTax('IL', 'groceries')), 100, '$100.00 = 10,000 cents × 1% = 100 cents');
  assert.equal(stateTax('IL', 'general'), 0.0625, 'other Illinois goods keep the state rate');
  assert.equal(stateTax('IL', 'prescription-medicine'), 0.01, 'Illinois prescription medicine: 1% the same way');
});

test('every reduced grocery rate replaces its state rate (one state part, never two added)', () => {
  // the state part each table row states for groceries (usProductTaxability GROCERY_REDUCED)
  // (Virginia is also listed as reduced, but the table's exempt list wins for it: groceries are exempt there)
  const reduced: Record<string, number> = { AL: 0.03, AR: 0.0125, MO: 0.01225, MS: 0.05, SD: 0.042, TN: 0.04, UT: 0.03 };
  for (const [state, rate] of Object.entries(reduced)) assert.equal(stateTax(state, 'groceries'), rate, state);
  assert.equal(stateTax('TX', 'groceries'), 0, 'an exemption is still 0');
  assert.equal(stateTax('VA', 'groceries'), 0, 'Virginia: exempt in the table');
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
