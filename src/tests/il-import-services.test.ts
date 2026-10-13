/**
 * A-56: Israeli VAT on purchases from abroad. Hand-checked: the self-assessment rule for services
 * answers at 18% on a 2026 purchase and 17% on a 2024 one (A-29's own dated rates), the goods rule
 * says customs collects and lives on the document scope, an Israeli payee changes nothing; and the
 * bill review lists a foreign vendor's tax-free ₪10,000.00 bill with ₪1,800.00 of reference VAT,
 * counts an Israeli vendor, a vendor with no recorded country, another currency and a draft as
 * skipped, and flags a foreign bill that already carries VAT instead of estimating over it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ilImportServicesPack, importBillsReview, importBillsCsvRows, vendorCountryOf, IMPORT_BILLS_CSV_HEADERS, type ImportBill, type ImportVendor } from '../lib/tax/ilImportServices';
import { taxRulePackProblems } from '../lib/rules/packs/index';
import { evaluateRules } from '../lib/rules/rules';
import { composeFacts, type Fact } from '../lib/rules/facts';

const vendors: ImportVendor[] = [
  { id: 'v-il', name: 'Local Supplier', metadata: { taxPlace: { country: 'IL' } } },
  { id: 'v-de', name: 'Berlin Software GmbH', metadata: { taxPlace: { country: 'de' } } },
  { id: 'v-plain', name: 'Somewhere Inc' }, // no recorded country
];

const bill = (over: Partial<ImportBill> & { id: string }): ImportBill => ({
  amountCents: 0, status: 'approved', vendorName: 'Vendor', date: '2026-05-01', currency: 'ILS', ...over,
});

test('the pack: dated self-assessment and customs rules, no pack problems', () => {
  const pack = ilImportServicesPack();
  assert.equal(pack.id, 'il-import-services');
  assert.equal(pack.rules.length, 4, 'two dated rates × services and goods');
  assert.deepEqual(taxRulePackProblems().filter(p => p.pack === 'il-import-services'), []);
  for (const rule of pack.rules) {
    assert.ok(rule.effect.kind === 'import-vat', rule.id);
    assert.match(rule.source.url, /^https:\/\/www\.gov\.il\//, rule.id);
    assert.ok(rule.when.some(c => c.attribute === 'payeeResidence' && c.values?.includes('foreign')), rule.id);
  }
});

test('a 2026 services purchase self-assesses at 18%, a 2024 one at 17%', () => {
  const facts = (date: string) => composeFacts({ books: [
    { attribute: 'country', value: 'IL' } as Fact,
    { attribute: 'payeeResidence', value: 'foreign' } as Fact,
    { attribute: 'supplyKind', value: 'services' } as Fact,
  ] }, {}, [], date);
  const now = evaluateRules(ilImportServicesPack().rules, facts('2026-05-01'), { date: '2026-05-01', scope: 'line' });
  assert.equal(now.applied.length, 1);
  assert.equal(now.applied[0].rule.id, 'il-import-services-2025-01-01');
  assert.ok(now.applied[0].rule.effect.kind === 'import-vat');
  assert.equal(now.applied[0].rule.effect.rate, 0.18);
  assert.equal(now.applied[0].rule.effect.collectedBy, 'self-assessment');

  const old = evaluateRules(ilImportServicesPack().rules, facts('2024-06-01'), { date: '2024-06-01', scope: 'line' });
  assert.equal(old.applied.length, 1);
  assert.equal(old.applied[0].rule.id, 'il-import-services-2015-10-01');
  assert.ok(old.applied[0].rule.effect.kind === 'import-vat' && old.applied[0].rule.effect.rate === 0.17);
});

test('goods live on the document scope and say customs collects; an Israeli payee changes nothing', () => {
  const goodsFacts = composeFacts({ books: [
    { attribute: 'country', value: 'IL' } as Fact,
    { attribute: 'payeeResidence', value: 'foreign' } as Fact,
    { attribute: 'supplyKind', value: 'goods' } as Fact,
  ] }, {}, [], '2026-05-01');
  const lineScope = evaluateRules(ilImportServicesPack().rules, goodsFacts, { date: '2026-05-01', scope: 'line' });
  assert.deepEqual(lineScope.applied, [], 'the goods rule is not a line rule');
  const docScope = evaluateRules(ilImportServicesPack().rules, goodsFacts, { date: '2026-05-01', scope: 'document' });
  assert.equal(docScope.applied.length, 1);
  assert.equal(docScope.applied[0].rule.id, 'il-import-goods-2025-01-01');
  assert.ok(docScope.applied[0].rule.effect.kind === 'import-vat' && docScope.applied[0].rule.effect.collectedBy === 'customs');

  const domestic = composeFacts({ books: [
    { attribute: 'country', value: 'IL' } as Fact,
    { attribute: 'payeeResidence', value: 'IL' } as Fact, // the A-43 fact vocabulary: 'IL' or 'foreign'
    { attribute: 'supplyKind', value: 'services' } as Fact,
  ] }, {}, [], '2026-05-01');
  assert.deepEqual(evaluateRules(ilImportServicesPack().rules, domestic, { date: '2026-05-01', scope: 'line' }).applied, []);
});

test('the review lists the foreign bill with its reference VAT and counts every skip', () => {
  const review = importBillsReview({
    bills: [
      bill({ id: 'b-de', vendorId: 'v-de', vendorName: 'Berlin Software GmbH', number: 'R-2026-11', amountCents: 1_000_000 }),
      bill({ id: 'b-il', vendorId: 'v-il', vendorName: 'Local Supplier', amountCents: 500_000 }),
      bill({ id: 'b-plain', vendorId: 'v-plain', vendorName: 'Somewhere Inc', amountCents: 300_000 }),
      bill({ id: 'b-eur', vendorId: 'v-de', amountCents: 200_000, currency: 'EUR' }),
      bill({ id: 'b-draft', vendorId: 'v-de', amountCents: 100_000, status: 'draft' }),
      bill({ id: 'b-nodate', vendorId: 'v-de', date: '', amountCents: 100_000 }),
      bill({ id: 'b-vat', vendorId: 'v-de', amountCents: 118_000, taxAmountCents: 18_000 }),
      bill({ id: 'b-outside', vendorId: 'v-de', date: '2025-05-01', amountCents: 100_000 }),
    ],
    vendors, from: '2026-01-01', to: '2026-10-13', homeCurrency: 'ILS',
  });
  assert.equal(review.problem, undefined);
  assert.equal(review.rows.length, 2, 'the tax-free foreign bill and the one that already carries VAT');
  const de = review.rows.find(r => r.billId === 'b-de')!;
  assert.equal(de.vendorCountry, 'DE', 'the recorded country is normalised');
  assert.equal(de.ilRate, 0.18);
  assert.equal(de.referenceVatCents, 180_000, '₪10,000.00 × 18% = ₪1,800.00');
  assert.match(de.note, /customs at the import, or self-assessment/, 'the list never decides goods or services');
  const vat = review.rows.find(r => r.billId === 'b-vat')!;
  assert.equal(vat.vatOnBillCents, 18_000);
  assert.match(vat.note, /already carries VAT/, 'flagged, never silently estimated over');
  assert.equal(review.skipped.israeliVendor, 1);
  assert.equal(review.skipped.countryNotRecorded, 1);
  assert.equal(review.skipped.otherCurrency, 1);
  assert.equal(review.skipped.notRecorded, 1);
  assert.equal(review.skipped.undated, 1);
  assert.equal(review.rows.find(r => r.billId === 'b-outside'), undefined);
  assert.equal(review.totals.bills, 2);
  assert.equal(review.totals.amountCents, 1_118_000);
  assert.equal(review.totals.referenceVatCents, 180_000 + 21_240, 'each bill rounds on its own at the rate in force');
});

test('the country reading and the CSV stay honest', () => {
  assert.equal(vendorCountryOf({ id: 'x', metadata: { taxPlace: { country: 'il' } } }), 'IL');
  assert.equal(vendorCountryOf({ id: 'x', metadata: { taxPlace: { country: 'Israel' } } }), undefined, 'a value that is not a two-letter code is not read as a country');
  assert.equal(vendorCountryOf({ id: 'x' }), undefined);
  assert.equal(vendorCountryOf(undefined), undefined);

  const review = importBillsReview({ bills: [bill({ id: 'b-de', vendorId: 'v-de', amountCents: 1_000_000 })], vendors, from: '2026-01-01', to: '2026-10-13', homeCurrency: 'ILS' });
  const rows = importBillsCsvRows(review);
  assert.equal(rows[0].length, IMPORT_BILLS_CSV_HEADERS.length);
  assert.equal(rows[0][2], 'DE');
  assert.equal(rows[0][6], '18');
  assert.equal(rows[0][7], '1800.00');

  const badPeriod = importBillsReview({ bills: [], vendors, from: '2026-10-13', to: '2026-01-01' });
  assert.match(badPeriod.problem || '', /two dates/);
});
