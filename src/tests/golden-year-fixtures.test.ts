import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOLDEN_IL_PROFILES, GOLDEN_IL_REGISTRATION, GOLDEN_IL_YEAR, GOLDEN_TX_PROFILES,
  GOLDEN_TX_REGISTRATION, GOLDEN_TX_YEAR, goldenIlYearTotals, goldenTxYearTotals,
  verifyGoldenYearFixtures, verifyIlGoldenYear, verifyTxGoldenYear,
} from '../lib/goldenYearFixtures';
import { israelVatReturn } from '../lib/tax/ilVatReturn';
import { usSalesTaxReturn } from '../lib/tax/usSalesTaxReturn';
import {
  US_1099_THRESHOLDS, is1099Reportable, threshold1099CentsFor, threshold1099Row, us1099ThresholdProblems,
} from '../lib/tax/us1099Thresholds';
import { threshold1099Cents } from '../lib/tax/us1099Preview';

// ---------------------------------------------------------------------------------------------
// A-198 — the Israeli year
// ---------------------------------------------------------------------------------------------

test('A-198: the Israeli fixture covers twelve months in six bi-monthly periods', () => {
  assert.equal(GOLDEN_IL_YEAR.periods.length, 6);
  assert.deepEqual(GOLDEN_IL_YEAR.periods.map(p => p.period), ['2026-01', '2026-03', '2026-05', '2026-07', '2026-09', '2026-11']);
  // every document falls inside exactly one period
  const docs = [...GOLDEN_IL_YEAR.invoices, ...GOLDEN_IL_YEAR.bills, ...GOLDEN_IL_YEAR.creditNotes];
  for (const doc of docs) {
    const hits = GOLDEN_IL_YEAR.periods.filter(p => String(doc.date) >= p.startDate && String(doc.date) <= p.endDate);
    assert.equal(hits.length, 1, `${doc.id} ${doc.date}`);
  }
  // the fixture has no duplicate ids
  assert.equal(new Set(docs.map(d => d.id)).size, docs.length);
});

test('A-198: every period matches the worked figures through the product return', () => {
  assert.deepEqual(verifyIlGoldenYear(), { periods: 6, failures: [] });
});

test('A-198: hand-checked spots — the rate, the refund, and exempt kept apart from zero-rated', () => {
  const period = (key: string) => GOLDEN_IL_YEAR.periods.find(p => p.period === key)!;
  // Jan–Feb: ₪10,000 + ₪5,000 at 18% = ₪2,700 output; ₪2,000 export is zero-rated, not taxable
  assert.equal(period('2026-01').expected.outputVatCents, 270_000);
  assert.equal(period('2026-01').expected.zeroRatedSalesCents, 2_000_000);
  assert.equal(period('2026-01').expected.toPayCents, 198_000);
  // May–Jun: the ₪3,600 equipment input makes the period a refund, not a payment
  assert.equal(period('2026-05').expected.fixedAssetInputVatCents, 360_000);
  assert.equal(period('2026-05').expected.toPayCents, -234_000);
  // Sep–Oct: the exempt sale is reported in its own box and never counted as taxable
  assert.equal(period('2026-09').expected.exemptSalesCents, 200_000);
  assert.equal(period('2026-09').expected.taxableSalesCents, 1_500_000);
  // Mar–Apr: the April credit note reduces the same period it belongs to
  assert.equal(period('2026-03').expected.taxableSalesCents, 700_000);
});

test('A-198: the year totals add from the periods and equal the sum of the six returns', () => {
  const totals = goldenIlYearTotals();
  assert.equal(totals.taxableSalesCents, 7_800_000);
  assert.equal(totals.outputVatCents, 1_404_000);
  assert.equal(totals.zeroRatedSalesCents, 2_400_000);
  assert.equal(totals.exemptSalesCents, 200_000);
  assert.equal(totals.fixedAssetInputVatCents, 360_000);
  assert.equal(totals.otherInputVatCents, 405_000);
  assert.equal(totals.toPayCents, 639_000);
  assert.equal(totals.documentCount, 22);
  // the year is itself a valid return period: output − all input = the periods' net
  const year = israelVatReturn({
    registration: GOLDEN_IL_REGISTRATION, profiles: GOLDEN_IL_PROFILES, order: ['entity'],
    invoices: GOLDEN_IL_YEAR.invoices, bills: GOLDEN_IL_YEAR.bills, creditNotes: GOLDEN_IL_YEAR.creditNotes,
    startDate: '2026-01-01', endDate: '2026-12-31',
  });
  assert.equal(year.outputVatCents - (year.fixedAssetInputVatCents + year.otherInputVatCents), totals.toPayCents);
  assert.equal(year.taxableSalesCents, totals.taxableSalesCents);
});

// ---------------------------------------------------------------------------------------------
// A-199 — the Texas year
// ---------------------------------------------------------------------------------------------

test('A-199: the Texas fixture covers four quarters with the state base rate only', () => {
  assert.equal(GOLDEN_TX_YEAR.quarters.length, 4);
  assert.equal(GOLDEN_TX_YEAR.quarters.map(q => q.quarter).join(','), '2026-Q1,2026-Q2,2026-Q3,2026-Q4');
  assert.deepEqual(verifyTxGoldenYear(), { quarters: 4, failures: [] });
});

test('A-199: hand-checked spots — rounding, the credit note, the Oregon sale and the certificate', () => {
  assert.deepEqual(verifyGoldenYearFixtures(), { ilPeriods: 6, txQuarters: 4, failures: [] });
  const q = (key: string) => GOLDEN_TX_YEAR.quarters.find(x => x.quarter === key)!;
  // Q1: ₪/ $1,400 taxable at 6.25% = $87.50; the $200 resale sale is exempt and the Oregon sale absent
  assert.equal(q('2026-Q1').expected.taxCollectedCents, 87_500);
  assert.equal(q('2026-Q1').expected.exemptSalesCents, 200_000);
  assert.equal(q('2026-Q1').expected.documentCount, 3);
  // Q3: 333,333 × 6.25% = 20,833.3125 rounds to 20,833, not up to 20,834
  assert.equal(q('2026-Q3').expected.taxCollectedCents, 145_833);
  // Q4: the odd amounts round down; $1,234,567 × 6.25% = 77,160.44
  assert.equal(q('2026-Q4').expected.taxCollectedCents, 116_223);
});

test('A-199: each quarter reconciles gross = taxable + exempt, and the year totals add', () => {
  const totals = goldenTxYearTotals();
  const returns = GOLDEN_TX_YEAR.quarters.map(quarter => usSalesTaxReturn({
    registration: GOLDEN_TX_REGISTRATION, profiles: GOLDEN_TX_PROFILES, order: ['entity'],
    invoices: GOLDEN_TX_YEAR.invoices, creditNotes: GOLDEN_TX_YEAR.creditNotes,
    customers: [{ id: 'tx-1', metadata: { taxPlace: { country: 'US', state: 'TX' } } },
      { id: 'tx-2', metadata: { taxPlace: { country: 'US', state: 'TX' } } },
      { id: 'tx-3', metadata: { taxPlace: { country: 'US', state: 'TX' }, taxExemption: { number: 'TX-RESALE-001', type: 'resale' } } },
      { id: 'or-1', metadata: { taxPlace: { country: 'US', state: 'OR' } } }],
    startDate: quarter.startDate, endDate: quarter.endDate,
  }));
  for (const r of returns) assert.equal(r.grossSalesCents, r.taxableSalesCents + r.exemptSalesCents, r.registration);
  assert.equal(totals.grossSalesCents, 7_192_900);
  assert.equal(totals.exemptSalesCents, 700_000);
  assert.equal(totals.taxableSalesCents, 6_492_900);
  assert.equal(totals.taxCollectedCents, 405_806);
  assert.equal(returns.reduce((s, r) => s + r.taxCollectedCents, 0), totals.taxCollectedCents);
  // the by-jurisdiction split is the state part only — the screen says so, and the fixture proves it
  assert.deepEqual(returns[0].byJurisdiction, [{ name: 'Texas state sales tax', taxCents: 87_500 }]);
});

// ---------------------------------------------------------------------------------------------
// A-106 — the 1099 thresholds by year
// ---------------------------------------------------------------------------------------------

test('A-106: the threshold table is sound and covers every year without a gap', () => {
  assert.deepEqual(us1099ThresholdProblems(), []);
  for (let year = 2020; year <= 2030; year++) {
    assert.ok(threshold1099Row('1099-NEC', year), `1099-NEC ${year}`);
    assert.ok(threshold1099Row('1099-MISC-ordinary', year), `1099-MISC ${year}`);
  }
});

test('A-106: the 2026 change — $600 through 2025, $2,000 from 2026', () => {
  assert.equal(threshold1099CentsFor('1099-NEC', 2025), 60_000);
  assert.equal(threshold1099CentsFor('1099-NEC', 2026), 200_000);
  assert.equal(threshold1099CentsFor('1099-MISC-ordinary', 2024), 60_000);
  assert.equal(threshold1099CentsFor('1099-MISC-ordinary', 2027), 200_000);
  assert.equal(is1099Reportable('1099-NEC', 2025, 59_999), false);
  assert.equal(is1099Reportable('1099-NEC', 2025, 60_000), true); // at the floor is reportable
  assert.equal(is1099Reportable('1099-NEC', 2026, 199_999), false);
  assert.equal(is1099Reportable('1099-NEC', 2026, 200_000), true);
});

test('A-106: the exceptions did not change with the 2026 increase', () => {
  assert.equal(threshold1099CentsFor('1099-MISC-royalties', 2025), 1_000);
  assert.equal(threshold1099CentsFor('1099-MISC-royalties', 2026), 1_000);
  assert.equal(threshold1099CentsFor('1099-MISC-attorney', 2026), 60_000);
});

test('A-106: one answer with E-10 — the review helper and the table agree for every year', () => {
  for (let year = 2020; year <= 2030; year++) {
    assert.equal(threshold1099Cents(year, '1099-NEC', '1a'), threshold1099CentsFor('1099-NEC', year), `NEC ${year}`);
    assert.equal(threshold1099Cents(year, '1099-MISC', '1'), threshold1099CentsFor('1099-MISC-ordinary', year), `MISC 1 ${year}`);
    assert.equal(threshold1099Cents(year, '1099-MISC', '3'), threshold1099CentsFor('1099-MISC-ordinary', year), `MISC 3 ${year}`);
    assert.equal(threshold1099Cents(year, '1099-MISC', '2'), threshold1099CentsFor('1099-MISC-royalties', year), `royalty ${year}`);
    assert.equal(threshold1099Cents(year, '1099-MISC', '10'), threshold1099CentsFor('1099-MISC-attorney', year), `attorney ${year}`);
  }
});

test('A-106: every row names an https source and a retrieval date', () => {
  for (const row of US_1099_THRESHOLDS) {
    assert.match(row.source.url, /^https:\/\//);
    assert.match(row.source.retrieved, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.form.length > 5);
  }
  assert.equal(new Set(US_1099_THRESHOLDS.map(r => `${r.kind}|${r.validFrom}`)).size, US_1099_THRESHOLDS.length);
});
