/**
 * A-26: the UK's VAT table. Hand-checked: 20% standard since 4 Jan 2011, the 2008–2009 temporary
 * 15%, the 17.5% years, 5% reduced on domestic fuel, the 2020–2021 hospitality rates, and 0% zero
 * rating on food, books and children's clothes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { UK_VAT_RATES, ukVatStandardRate, ukVatZeroRow, ukVatReducedFor, ukVatRowsOn, ukVatRateTable } from '../lib/tax/ukVat';

test('the standard rate history is dated and hand-checked', () => {
  assert.equal(ukVatStandardRate('2026-10-11'), 0.2);
  assert.equal(ukVatStandardRate('2009-06-01'), 0.15, 'the 2008–2009 reduction');
  assert.equal(ukVatStandardRate('2008-11-30'), 0.175);
  assert.equal(ukVatStandardRate('2010-06-01'), 0.175);
  assert.equal(ukVatStandardRate('2011-01-04'), 0.2);
  assert.equal(ukVatStandardRate('1990-01-01'), undefined, 'before this table starts: no guessed rate');
});

test('zero rating is a rate, not a missing table', () => {
  assert.ok(ukVatZeroRow('2026-10-11'));
  assert.equal(ukVatZeroRow('2026-10-11')?.rate, 0);
  assert.match(ukVatZeroRow('2026-10-11')!.appliesTo!, /food/);
});

test('the reduced rows carry what they apply to, and the temporary ones end', () => {
  assert.equal(ukVatReducedFor('domestic fuel and power', '2026-10-11')?.rate, 0.05);
  assert.equal(ukVatReducedFor('hospitality', '2020-08-01')?.rate, 0.05);
  assert.equal(ukVatReducedFor('hospitality', '2022-01-01')?.rate, 0.125);
  assert.equal(ukVatReducedFor('hospitality', '2026-10-11'), undefined, 'the support rates ended in Mar 2022');
});

test('one standard rate is in force at a time and every row has a source', () => {
  for (const row of UK_VAT_RATES) {
    assert.match(row.source, /^https:\/\//);
    assert.match(row.validFrom, /^\d{4}-\d{2}-\d{2}$/);
  }
  for (const day of ['2008-12-15', '2010-06-01', '2021-11-01', '2026-10-11']) {
    assert.equal(ukVatRowsOn(day).filter(r => r.kind === 'standard').length, 1, day);
  }
});

test('the table plugs into resolveLineTax for a UK buyer', () => {
  const table = ukVatRateTable();
  assert.deepEqual(table({ country: 'GB' }, '2026-10-11'), [{ level: 'country', name: 'UK VAT', rate: 0.2 }]);
  assert.deepEqual(table({ country: 'UK' }, '2026-10-11'), [{ level: 'country', name: 'UK VAT', rate: 0.2 }]);
  assert.equal(table({ country: 'IE' }, '2026-10-11'), undefined);
});
