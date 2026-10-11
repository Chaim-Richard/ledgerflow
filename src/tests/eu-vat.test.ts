/**
 * A-25: the EU's VAT table. Hand-checked: Germany 19%, Hungary 27% (the highest), Luxembourg 17%
 * (the lowest), Finland 25.5%, Slovakia 23% from 2025, Estonia 24% from Jul 2025, Romania 21% from
 * Aug 2025, Greece's code is EL, and the reduced rows are dated (Ireland's hospitality 9% from Jul 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EU_VAT_RATES, EU_VAT_COUNTRIES,
  euVatStandardRow, euVatStandardRate, euVatReducedRows, euVatReducedFor, euVatRateTable,
} from '../lib/tax/euVat';

const DATE = '2026-10-11';
const EU27 = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'EL', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

test('all 27 member states are present, with EL for Greece', () => {
  assert.deepEqual([...EU_VAT_COUNTRIES].sort(), [...EU27].sort());
  assert.equal(EU_VAT_COUNTRIES.includes('GR'), false, 'the EU code is EL, not GR');
});

test('every country has exactly one standard rate in force today', () => {
  for (const country of EU27) {
    const rows = EU_VAT_RATES.filter(r => r.country === country && r.kind === 'standard' && r.validFrom <= DATE && (!r.validTo || DATE <= r.validTo));
    assert.equal(rows.length, 1, `${country} has ${rows.length} standard rows in force`);
    assert.ok(rows[0].rate >= 0.15 && rows[0].rate <= 0.27, `${country} standard rate ${rows[0].rate} in range`);
  }
});

test('every row carries a dated https source', () => {
  for (const row of EU_VAT_RATES) {
    assert.match(row.source, /^https:\/\//, `${row.country} ${row.kind}`);
    assert.match(row.validFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.rate >= 0 && row.rate <= 0.3, `${row.country} ${row.kind} rate in range`);
    if (row.kind === 'reduced' || row.kind === 'zero') assert.ok(row.appliesTo, `${row.country} says what the reduced row is for`);
  }
});

test('hand-checked standard rates, including the 2025–2026 changes', () => {
  assert.equal(euVatStandardRate('DE', DATE), 0.19);
  assert.equal(euVatStandardRate('HU', DATE), 0.27);
  assert.equal(euVatStandardRate('LU', DATE), 0.17);
  assert.equal(euVatStandardRate('FI', DATE), 0.255);
  assert.equal(euVatStandardRate('SK', DATE), 0.23);
  assert.equal(euVatStandardRate('SK', '2024-12-31'), undefined, 'no earlier row was written for SK yet');
  assert.equal(euVatStandardRate('EE', DATE), 0.24);
  assert.equal(euVatStandardRate('EE', '2024-06-30'), 0.22, 'Estonia was 22% in early 2024');
  assert.equal(euVatStandardRate('RO', DATE), 0.21);
  assert.equal(euVatStandardRate('EL', DATE), 0.24, 'Greece under its EU code');
});

test('an unknown country asks for a table instead of guessing', () => {
  assert.equal(euVatStandardRate('US', DATE), undefined);
  assert.equal(euVatStandardRow('US', DATE), undefined);
  assert.equal(euVatRateTable()({ country: 'US' }, DATE), undefined);
});

test('reduced rows are found by what they apply to, and dated changes are honoured', () => {
  assert.equal(euVatReducedFor('DE', 'food', DATE)?.rate, 0.07);
  assert.equal(euVatReducedFor('IE', 'hospitality', DATE)?.rate, 0.09, '9% from 1 Jul 2026');
  assert.equal(euVatReducedFor('IE', 'hospitality', '2026-06-30'), undefined, 'the 9% row starts 1 Jul 2026');
  assert.equal(euVatReducedFor('AT', 'food', DATE)?.rate, 0.05);
  assert.equal(euVatReducedRows('FR', DATE).length, 3);
  assert.equal(euVatReducedFor('FR', 'nothing-like-this', DATE), undefined, 'no match, no invented rate');
});

test('the table plugs into resolveLineTax as RateTables.<country>', () => {
  const table = euVatRateTable();
  assert.deepEqual(table({ country: 'FR' }, DATE), [{ level: 'country', name: 'France VAT', rate: 0.2 }]);
  assert.deepEqual(table({ country: 'el' }, DATE), [{ level: 'country', name: 'Greece VAT', rate: 0.24 }]);
});

test('a country’s own rows never overlap with a different rate in force', () => {
  for (const country of EU27) {
    for (const kind of ['standard', 'zero']) {
      const rows = EU_VAT_RATES.filter(r => r.country === country && r.kind === kind);
      for (const day of ['2024-06-15', '2025-09-15', '2026-10-11', '2030-01-01']) {
        assert.ok(rows.filter(r => r.validFrom <= day && (!r.validTo || day <= r.validTo)).length <= 1, `${country} ${kind} on ${day}`);
      }
    }
  }
});
