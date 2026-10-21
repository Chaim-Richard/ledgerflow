/**
 * A-27 (nexus) and A-30/A-31 (item tax categories and the state-by-category table). Hand-checked:
 * Texas crosses at $500,000 of sales with no transaction test; Connecticut needs both $100,000 and
 * 200 transactions; New York $500,000 and 100; Alabama $250,000; the warning line is 80%; and the
 * category table answers clothing exempt in Pennsylvania, groceries reduced in Illinois (1%) and
 * exempt in California, prescriptions exempt in New York.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  US_NEXUS_THRESHOLDS, US_NEXUS_STATES, nexusThreshold, nexusWatch, NEXUS_WARNING_RATIO,
} from '../lib/tax/usNexus';
import { US_STATE_SALES_TAX } from '../lib/tax/usStateSalesTax';
import {
  TAX_CATEGORIES, TAX_CATEGORY_IDS, taxCategory, taxCategoryLabel, effectiveTaxCategory, filterItemsByTaxCategory,
} from '../lib/tax/taxCategories';
import {
  US_PRODUCT_TAXABILITY, productTreatment, productIsExempt, unclearCategories, TAX_TREATMENT_LABELS,
} from '../lib/tax/usProductTaxability';

const DATE = '2026-10-11';

test('every sales-tax state and DC has a nexus row, and the no-tax states say so', () => {
  assert.deepEqual([...US_NEXUS_STATES].sort(), US_STATE_SALES_TAX.map(r => r.state).sort());
  for (const state of US_NEXUS_STATES) {
    const row = nexusThreshold(state, DATE);
    assert.ok(row, `${state} has a row`);
    assert.match(row.source, /^https:\/\//, state);
    if (row.salesThresholdCents !== null) assert.ok(row.salesThresholdCents >= 100_000_00, `${state} threshold in cents`);
  }
  for (const state of ['DE', 'MT', 'NH', 'OR']) {
    const row = nexusThreshold(state, DATE)!;
    assert.equal(row.salesThresholdCents, null, `${state} has no sales-tax nexus test`);
  }
});

test('one state has one threshold in force at a time', () => {
  for (const state of US_NEXUS_STATES) {
    for (const day of ['2023-06-01', '2025-08-01', '2026-10-11', '2030-01-01']) {
      const rows = US_NEXUS_THRESHOLDS.filter(r => r.state === state && r.validFrom <= day && (!r.validTo || day <= r.validTo));
      assert.ok(rows.length <= 1, `${state} has ${rows.length} rows on ${day}`);
    }
  }
});

test('hand-checked thresholds and tests', () => {
  assert.equal(nexusThreshold('TX', DATE)?.salesThresholdCents, 500_000_00);
  assert.equal(nexusThreshold('TX', DATE)?.transactions, null);
  assert.equal(nexusThreshold('CT', DATE)?.test, 'both');
  assert.equal(nexusThreshold('NY', DATE)?.test, 'both');
  assert.equal(nexusThreshold('NY', DATE)?.transactions, 100);
  assert.equal(nexusThreshold('AL', DATE)?.salesThresholdCents, 250_000_00);
  assert.equal(nexusThreshold('IL', '2025-06-01')?.transactions, 200, 'before 2026: sales or 200');
  assert.equal(nexusThreshold('IL', '2026-01-02')?.transactions, null, 'the transaction test was removed');
});

test('the watch warns at 80% and crosses when the state’s test is met', () => {
  assert.equal(NEXUS_WARNING_RATIO, 0.8);
  const quiet = nexusWatch({ state: 'TX', salesCents: 100_000_00, orders: 5 }, DATE)!;
  assert.equal(quiet.crossed, false);
  assert.equal(quiet.warning, false);
  assert.equal(quiet.ratio, 0.2);

  const near = nexusWatch({ state: 'TX', salesCents: 400_000_00, orders: 5 }, DATE)!;
  assert.equal(near.crossed, false);
  assert.equal(near.warning, true, '80% of $500,000');
  assert.ok(Math.abs((near.ratio || 0) - 0.8) < 1e-9);

  const crossed = nexusWatch({ state: 'TX', salesCents: 500_000_00, orders: 1 }, DATE)!;
  assert.equal(crossed.crossed, true);
  assert.equal(crossed.warning, true);
});

test('a both-tests state is not crossed until both are met', () => {
  const salesOnly = nexusWatch({ state: 'CT', salesCents: 120_000_00, orders: 10 }, DATE)!;
  assert.equal(salesOnly.crossed, false, 'sales alone is not enough in Connecticut');
  assert.equal(salesOnly.warning, true);
  const both = nexusWatch({ state: 'CT', salesCents: 120_000_00, orders: 200 }, DATE)!;
  assert.equal(both.crossed, true);
  const ordersOnly = nexusWatch({ state: 'NY', salesCents: 10_000_00, orders: 500 }, DATE)!;
  assert.equal(ordersOnly.crossed, false, 'New York needs the money too');
});

test('a state with no test never warns and an unknown state is not invented', () => {
  const oregon = nexusWatch({ state: 'OR', salesCents: 9_000_000_00, orders: 4000 }, DATE)!;
  assert.equal(oregon.crossed, false);
  assert.equal(oregon.warning, false);
  assert.equal(nexusWatch({ state: 'XX', salesCents: 1, orders: 1 }, DATE), undefined);
});

test('the item tax categories are a fixed vocabulary with plain labels', () => {
  assert.equal(TAX_CATEGORIES.length, 9);
  assert.deepEqual(TAX_CATEGORY_IDS, TAX_CATEGORIES.map(c => c.id));
  assert.equal(taxCategory('clothing')?.label, 'Clothing');
  assert.equal(taxCategoryLabel('saas'), 'Software as a service (SaaS)');
  assert.equal(taxCategoryLabel('something-else'), 'something-else', 'an unknown id is shown, not hidden');
  assert.equal(taxCategory('nope'), undefined);
  assert.equal(effectiveTaxCategory(undefined), 'general');
  assert.equal(effectiveTaxCategory('nope'), undefined, 'never guessed');
});

test('the item filter uses the item’s own category', () => {
  const items = [
    { id: 'a', productTaxCategory: 'clothing' },
    { id: 'b', productTaxCategory: 'groceries' },
    { id: 'c' },
  ];
  assert.deepEqual(filterItemsByTaxCategory(items, 'all').map(i => i.id), ['a', 'b', 'c']);
  assert.deepEqual(filterItemsByTaxCategory(items, 'groceries').map(i => i.id), ['b']);
  assert.deepEqual(filterItemsByTaxCategory(items, 'general').map(i => i.id), ['c'], 'no category means general');
  assert.deepEqual(filterItemsByTaxCategory(items, 'saas'), []);
});

test('the state-by-category table covers every state and category with a source', () => {
  assert.equal(US_PRODUCT_TAXABILITY.length, 51 * TAX_CATEGORY_IDS.length);
  for (const row of US_PRODUCT_TAXABILITY) {
    assert.match(row.source, /^https:\/\//, `${row.state} ${row.category}`);
    assert.ok(Object.keys(TAX_TREATMENT_LABELS).includes(row.treatment), row.treatment);
    if (row.treatment === 'reduced') assert.equal(typeof row.rate, 'number', `${row.state} ${row.category} reduced carries a rate`);
  }
});

test('hand-checked treatments', () => {
  assert.equal(productTreatment('PA', 'clothing')?.treatment, 'exempt');
  assert.equal(productTreatment('NJ', 'clothing')?.treatment, 'exempt');
  assert.equal(productTreatment('MN', 'clothing')?.treatment, 'exempt');
  assert.equal(productTreatment('NY', 'clothing')?.treatment, 'unclear', 'New York’s $110 cap is not a yes/no');
  assert.equal(productIsExempt('CA', 'groceries'), true);
  assert.equal(productIsExempt('TX', 'groceries'), true);
  // #258 review: Illinois's state 1% grocery tax ended 1 Jan 2026 (Public Act 103-0781); Alabama's food rate is 2%
  // from 1 Sep 2025 (Act 2025-305)
  assert.equal(productTreatment('IL', 'groceries')?.treatment, 'exempt');
  assert.equal(productTreatment('IL', 'groceries')?.rate, undefined);
  assert.equal(productTreatment('AL', 'groceries')?.rate, 0.02);
  assert.equal(productTreatment('NY', 'prescription-medicine')?.treatment, 'exempt');
  assert.equal(productTreatment('IL', 'prescription-medicine')?.treatment, 'reduced');
  assert.equal(productTreatment('TX', 'prepared-food')?.treatment, 'taxable');
  assert.equal(productTreatment('CA', 'general')?.treatment, 'taxable');
  assert.equal(productTreatment('OR', 'general')?.treatment, 'exempt', 'no state tax in Oregon');
  assert.equal(productTreatment('OR', 'saas')?.treatment, 'unclear', 'no state tax, but a local jurisdiction may still tax');
});

test('categories whose answer depends on the product are unclear, not guessed', () => {
  assert.deepEqual([...unclearCategories('TX')].sort(), ['books', 'saas', 'services']);
  assert.equal(productTreatment('TX', 'saas')?.treatment, 'unclear');
  assert.ok(productTreatment('TX', 'saas')?.note?.includes('confirm'), 'the row tells the person to confirm');
  assert.equal(productTreatment('XX', 'general'), undefined);
});
