/**
 * A-54: US use tax — the rules and the "use tax you may owe" bill review. Hand-checked numbers:
 * Texas at 6.25%, a $1,000.00 taxable purchase the seller charged no tax on estimates $62.50;
 * Texas groceries are exempt and never estimated; a bill that already carries tax is skipped and
 * counted; a line with no item is listed for a person, never estimated; another currency is
 * counted, never converted; and the five no-sales-tax states get a plain-word refusal instead of a
 * rate of zero pretended to be an answer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { usUseTaxPack, reviewUseTax, reviewUseTaxCsvRows, USE_TAX_STATES, USE_TAX_CSV_HEADERS, type UseTaxBill, type UseTaxItem } from '../lib/tax/usUseTax';
import { US_STATE_SALES_TAX, NO_STATE_SALES_TAX } from '../lib/tax/usStateSalesTax';
import { taxRulePackProblems } from '../lib/rules/packs/index';
import { evaluateRules } from '../lib/rules/rules';
import { composeFacts, type Fact } from '../lib/rules/facts';

const DATE = '2026-10-13';
const FROM = '2026-01-01';
const TO = '2026-10-13';

const items: UseTaxItem[] = [
  { id: 'i-office', productTaxCategory: 'general' },        // taxable in TX
  { id: 'i-food', productTaxCategory: 'groceries' },        // exempt in TX
  { id: 'i-plain' },                                        // no category: 'general' by the vocabulary
];

const bill = (over: Partial<UseTaxBill> & { id: string }): UseTaxBill => ({
  amountCents: 0, status: 'approved', vendorName: 'Remote Vendor', date: '2026-05-01', ...over,
});

const review = (bills: UseTaxBill[], state = 'TX', over: Partial<Parameters<typeof reviewUseTax>[0]> = {}) =>
  reviewUseTax({ bills, items, state, from: FROM, to: TO, homeCurrency: 'USD', ...over });

test('the pack: one dated rule per taxing jurisdiction, and the graph answers with it', () => {
  const pack = usUseTaxPack();
  assert.equal(pack.id, 'us-use-tax');
  assert.equal(pack.rules.length, US_STATE_SALES_TAX.filter(row => row.rate > 0).length);
  assert.equal(pack.rules.length, 46, '45 states with a sales tax, plus DC');
  assert.equal(USE_TAX_STATES.length, 46);
  for (const noTax of NO_STATE_SALES_TAX) assert.ok(!USE_TAX_STATES.includes(noTax), noTax);
  assert.deepEqual(taxRulePackProblems().filter(p => p.pack === 'us-use-tax'), []);
  const tx = pack.rules.find(r => r.id.startsWith('us-use-tax-tx-'))!;
  assert.ok(tx.effect.kind === 'use-tax' && tx.effect.rate === 0.0625);
  assert.match(tx.source.url, /^https:\/\/comptroller\.texas\.gov/, 'the state\'s own department');

  // through the graph: a purchase the seller charged no tax on finds the state's use-tax rule
  const facts = composeFacts({ books: [
    { attribute: 'country', value: 'US' } as Fact,
    { attribute: 'state', value: 'TX' } as Fact,
    { attribute: 'taxCollectedBySeller', value: 'no' } as Fact,
  ] }, {}, [], DATE);
  const outcome = evaluateRules(pack.rules, facts, { date: DATE, scope: 'line' });
  assert.equal(outcome.applied.length, 1);
  assert.equal(outcome.applied[0].rule.id, tx.id);

  const collected = composeFacts({ books: [
    { attribute: 'country', value: 'US' } as Fact,
    { attribute: 'state', value: 'TX' } as Fact,
    { attribute: 'taxCollectedBySeller', value: 'yes' } as Fact,
  ] }, {}, [], DATE);
  assert.deepEqual(evaluateRules(pack.rules, collected, { date: DATE, scope: 'line' }).applied, [], 'where the seller collected, use tax does not apply');
});

test('the golden review: $1,000 taxable at 6.25% estimates $62.50; groceries stay out', () => {
  const result = review([
    bill({ id: 'b1', amountCents: 100_000, splits: [{ amountCents: 100_000, itemId: 'i-office' }] }),
    bill({ id: 'b2', vendorName: 'Food Wholesalers', amountCents: 50_000, splits: [{ amountCents: 50_000, itemId: 'i-food' }] }),
  ]);
  assert.equal(result.problem, undefined);
  assert.equal(result.rows.length, 2);
  const b1 = result.rows.find(r => r.billId === 'b1')!;
  assert.equal(b1.rate, 0.0625);
  assert.equal(b1.taxableCents, 100_000);
  assert.equal(b1.estimatedUseTaxCents, 6_250, '$1,000.00 × 6.25% = $62.50, in whole cents');
  const b2 = result.rows.find(r => r.billId === 'b2')!;
  assert.equal(b2.exemptCents, 50_000);
  assert.equal(b2.estimatedUseTaxCents, 0);
  assert.equal(result.totals.estimatedUseTaxCents, 6_250);
  assert.equal(result.totals.taxableCents, 100_000, 'exempt bases are not in the taxable total');
});

test('a mixed bill splits its base by category and rounds each line to whole cents', () => {
  const result = review([bill({
    id: 'b3', amountCents: 10_001, splits: [
      { amountCents: 3_333, itemId: 'i-office' },
      { amountCents: 3_334, itemId: 'i-food' },
      { amountCents: 3_334, itemId: 'i-plain' }, // no category recorded: 'general' → taxable in TX
    ],
  })]);
  const row = result.rows[0];
  assert.equal(row.taxableCents, 3_333 + 3_334);
  assert.equal(row.exemptCents, 3_334);
  assert.equal(row.estimatedUseTaxCents, Math.round(3_333 * 0.0625) + Math.round(3_334 * 0.0625), 'each line rounds on its own');
});

test('what is skipped is counted, never silently dropped', () => {
  const result = review([
    bill({ id: 'taxed', amountCents: 10_000, taxAmountCents: 825, splits: [{ amountCents: 10_000, itemId: 'i-office' }] }),
    bill({ id: 'eur', amountCents: 10_000, currency: 'EUR', splits: [{ amountCents: 10_000, itemId: 'i-office' }] }),
    bill({ id: 'draft', amountCents: 10_000, status: 'draft', splits: [{ amountCents: 10_000, itemId: 'i-office' }] }),
    bill({ id: 'nodate', date: '', amountCents: 10_000, splits: [{ amountCents: 10_000, itemId: 'i-office' }] }),
    bill({ id: 'outside', date: '2025-06-01', amountCents: 10_000, splits: [{ amountCents: 10_000, itemId: 'i-office' }] }),
    bill({ id: 'unknown-item', amountCents: 20_000, splits: [{ amountCents: 20_000, itemId: 'i-missing' }] }),
    bill({ id: 'no-splits', amountCents: 30_000 }),
  ]);
  assert.equal(result.skipped.taxCharged, 1);
  assert.equal(result.skipped.otherCurrency, 1);
  assert.equal(result.skipped.notRecorded, 1);
  assert.equal(result.skipped.undated, 1);
  assert.equal(result.rows.find(r => r.billId === 'outside'), undefined, 'a bill dated outside the period is simply not this review');
  const unknown = result.rows.find(r => r.billId === 'unknown-item')!;
  assert.equal(unknown.unclearCents, 20_000, 'an item that is not loaded is for a person, never guessed');
  assert.equal(unknown.estimatedUseTaxCents, 0);
  assert.match(unknown.note, /review/);
  const noSplits = result.rows.find(r => r.billId === 'no-splits')!;
  assert.equal(noSplits.unclearCents, 30_000);
  assert.equal(noSplits.estimatedUseTaxCents, 0);
  assert.equal(result.totals.unclearCents, 50_000);
});

test('a no-sales-tax state or an unknown state gets a plain-word refusal, not a pretended zero', () => {
  const or = review([], 'OR');
  assert.match(or.problem || '', /no state sales tax/);
  assert.deepEqual(or.rows, []);
  const xx = review([], 'XX');
  assert.match(xx.problem || '', /not in the state sales-tax table/);
  const none = review([], '');
  assert.match(none.problem || '', /Choose the state/);
  const badPeriod = review([], 'TX', { from: '2026-10-13', to: '2026-01-01' });
  assert.match(badPeriod.problem || '', /two dates/);
});

test('the CSV keeps the review honest: unclear bases in their own column', () => {
  const result = review([
    bill({ id: 'b1', amountCents: 100_000, splits: [{ amountCents: 100_000, itemId: 'i-office' }] }),
    bill({ id: 'b4', amountCents: 7_000 }),
  ]);
  const rows = reviewUseTaxCsvRows(result);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].length, USE_TAX_CSV_HEADERS.length);
  const taxableRow = rows.find(r => r[3] === '1000.00')!;
  assert.equal(taxableRow[7], '6.25', 'the rate as a percent');
  assert.equal(taxableRow[8], '62.50', 'estimated use tax');
  const unclearRow = rows.find(r => r[6] === '70.00')!;
  assert.equal(unclearRow[8], '0.00', 'an unclear base is never estimated');
  assert.match(unclearRow[10], /review/);
});
