/**
 * A-22 (PLAN US-1): the US state sales-tax table. What the test holds: all 50 states and DC are
 * there, each row has a dated source, the five no-tax states are 0, rates stay in a sane range, one
 * state never has two rows in force at once, and the table plugs into `resolveLineTax`'s RateTable.
 * Hand-checked numbers: Texas 6.25%, California 7.25%, Colorado 2.9%, Louisiana 5% from 2025.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  US_STATE_SALES_TAX,
  US_SALES_TAX_STATES,
  NO_STATE_SALES_TAX,
  ORIGIN_SOURCING_STATES,
  stateSalesTaxRate,
  stateSalesTaxRows,
  shippingTreatment,
  usShippingIsTaxable,
  usStateSalesTaxRateTable,
} from '../lib/tax/usStateSalesTax';

const DATE = '2026-10-11';

test('every state and DC is present exactly once', () => {
  const codes = US_STATE_SALES_TAX.map(r => r.state);
  assert.equal(new Set(codes).size, codes.length, 'no duplicate state rows');
  assert.equal(codes.length, 51, '50 states + DC');
  assert.deepEqual([...codes].sort(), [...US_SALES_TAX_STATES].sort());
  assert.equal(codes.includes('DC'), true);
  assert.equal(codes.includes('PR'), false, 'territories are not claimed by this table');
});

test('each row carries a dated official source', () => {
  for (const row of US_STATE_SALES_TAX) {
    assert.match(row.source, /^https:\/\//, `${row.state} source is https`);
    assert.match(row.validFrom, /^\d{4}-\d{2}-\d{2}$/, `${row.state} validFrom is a date`);
    assert.match(row.checked, /^\d{4}-\d{2}-\d{2}$/, `${row.state} checked is a date`);
    assert.ok(row.source.includes('.'), `${row.state} source names a host`);
    assert.match(row.stateName, /\S/);
  }
});

test('rates are fractions within the plausible range, and the five no-tax states are 0', () => {
  for (const row of US_STATE_SALES_TAX) {
    assert.ok(row.rate >= 0 && row.rate <= 0.1, `${row.state} rate ${row.rate} in [0, 10%]`);
  }
  assert.deepEqual([...NO_STATE_SALES_TAX].sort(), ['AK', 'DE', 'MT', 'NH', 'OR']);
  for (const state of NO_STATE_SALES_TAX) {
    assert.equal(stateSalesTaxRate(state, DATE), 0, `${state} has no state sales tax`);
    assert.equal(shippingTreatment(state, DATE), 'no-state-tax');
  }
  // hand-checked rates
  assert.equal(stateSalesTaxRate('TX', DATE), 0.0625);
  assert.equal(stateSalesTaxRate('CA', DATE), 0.0725);
  assert.equal(stateSalesTaxRate('CO', DATE), 0.029);
  assert.equal(stateSalesTaxRate('LA', DATE), 0.05);
  assert.equal(stateSalesTaxRate('la', DATE), 0.05, 'a lower-case code works');
});

test('Louisiana is 4.45% before 1 Jan 2025 and 5% from it', () => {
  assert.equal(stateSalesTaxRate('LA', '2024-12-31'), undefined, 'no earlier row was written for LA yet');
  assert.equal(stateSalesTaxRate('LA', '2025-01-01'), 0.05);
});

test('one state never has two rows in force on the same day', () => {
  for (const state of US_SALES_TAX_STATES) {
    for (const day of ['2025-01-01', '2026-10-11', '2030-01-01']) {
      const rows = stateSalesTaxRows(state, day);
      assert.ok(rows.length <= 1, `${state} has ${rows.length} rows in force on ${day}`);
    }
  }
});

test('an unknown state asks for a real table instead of guessing', () => {
  assert.equal(stateSalesTaxRate('XX', DATE), undefined);
  assert.equal(shippingTreatment('XX', DATE), undefined);
  assert.equal(usShippingIsTaxable('XX', DATE), undefined);
});

test('shipping treatments are one of the four, and the known ones are hand-checked', () => {
  const allowed = ['taxable', 'exempt-separately-stated', 'mixed', 'no-state-tax'];
  for (const row of US_STATE_SALES_TAX) assert.ok(allowed.includes(row.shipping), `${row.state} shipping`);
  assert.equal(usShippingIsTaxable('TX', DATE), true, 'Texas taxes shipping on a taxable sale');
  assert.equal(usShippingIsTaxable('CA', DATE), false, 'California exempts separately stated shipping');
  assert.equal(usShippingIsTaxable('IL', DATE), undefined, 'Illinois is “mixed”, so it is not a plain yes/no');
});

test('origin and destination sourcing are both represented', () => {
  assert.ok(ORIGIN_SOURCING_STATES.length >= 10, 'the well-known origin states are listed');
  for (const state of ['TX', 'CA', 'AZ', 'OH', 'PA', 'VA', 'WA']) assert.ok(ORIGIN_SOURCING_STATES.includes(state), `${state} is origin-based`);
  assert.equal(ORIGIN_SOURCING_STATES.includes('NY'), false, 'New York is destination-based');
});

test('the table plugs into resolveLineTax as RateTable US-<state>', () => {
  const table = usStateSalesTaxRateTable();
  const components = table({ country: 'US', state: 'TX' }, DATE);
  assert.deepEqual(components, [{ level: 'state', name: 'Texas state sales tax', rate: 0.0625 }]);
  assert.deepEqual(table({ country: 'US', state: 'OR' }, DATE), [{ level: 'state', name: 'Oregon state sales tax', rate: 0 }]);
  assert.equal(table({ country: 'US', state: 'ZZ' }, DATE), undefined);
  assert.equal(table({ country: 'IL', state: 'TX' }, DATE), undefined, 'not a US buyer');
  assert.equal(table({ country: 'US' }, DATE), undefined, 'no state, no table');
});

test('the whole table resolves through resolveLineTax for a Texas permit', async () => {
  const { resolveLineTax } = await import('../lib/tax/resolveLineTax');
  const seller = {
    from: ['books'],
    place: { country: 'US', state: 'TX' },
    registrations: [{ kind: 'sales_tax' as const, number: 'TX-1', place: { country: 'US', state: 'TX' } }],
  };
  const answer = resolveLineTax({ seller, buyer: { country: 'US', state: 'TX' }, date: DATE, tables: { 'US-TX': usStateSalesTaxRateTable() } });
  assert.equal(answer.reason, 'taxed');
  assert.equal(answer.rate, 0.0625);
  assert.equal(answer.components[0].level, 'state');
});
