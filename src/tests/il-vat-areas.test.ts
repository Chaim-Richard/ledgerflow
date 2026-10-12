/**
 * A-29: Israel's special VAT areas. Hand-checked: Eilat is zero-rated, the ordinary area keeps the
 * standard rate (18% from 1 Jan 2025), and each row carries a source. The table must agree with
 * `IL_VAT_STANDARD` rather than making a second rate history.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IL_VAT_SPECIAL_AREAS, ilVatAreaRow, isIlZeroArea, ilVatRateTable, ilStandardVatRow } from '../lib/tax/ilVat';
import { rateOn, IL_VAT_STANDARD } from '../lib/tax/ilVatRates';

const DATE = '2026-10-11';

test('Eilat is a zero area with a Hebrew name and a source', () => {
  const row = ilVatAreaRow('Eilat', DATE);
  assert.ok(row);
  assert.equal(row.treatment, 'zero');
  assert.equal(row.rate, 0);
  assert.equal(row.nameHebrew, 'אילת');
  assert.match(row.source, /^https:\/\//);
  assert.equal(isIlZeroArea('eilat', DATE), true, 'the key is matched case-insensitively');
});

test('the other export and duty-free areas are zero, and the ordinary area is not', () => {
  assert.equal(isIlZeroArea('judea-samaria', DATE), true);
  assert.equal(isIlZeroArea('gaza', DATE), true);
  assert.equal(isIlZeroArea('duty-free', DATE), true);
  assert.equal(isIlZeroArea('israel', DATE), false);
  assert.equal(isIlZeroArea('', DATE), false);
  assert.equal(isIlZeroArea('nowhere', DATE), false);
});

test('every row has a source, a checked date and a Hebrew name', () => {
  for (const row of IL_VAT_SPECIAL_AREAS) {
    assert.match(row.source, /^https:\/\//, row.area);
    assert.match(row.validFrom, /^\d{4}-\d{2}-\d{2}$/, row.area);
    assert.match(row.nameHebrew, /[\u0590-\u05FF]/, `${row.area} has a Hebrew name`);
    assert.match(row.name, /\S/);
    assert.ok(row.rate >= 0 && row.rate <= 0.2);
  }
});

test('the ordinary row agrees with the standard rate table, not a second history', () => {
  const standard = ilStandardVatRow(DATE);
  assert.ok(standard, 'the standard row is in force today');
  assert.equal(ilVatAreaRow('israel', DATE)?.rate, standard.rate, 'the ordinary row copies IL_VAT_STANDARD');
  assert.equal(rateOn(IL_VAT_STANDARD, DATE)?.rate, 0.18);
});

test('the IL rate table answers 0 in Eilat and the standard rate elsewhere', () => {
  const table = ilVatRateTable();
  assert.deepEqual(table({ country: 'IL', city: 'Eilat' }, DATE), [{ level: 'district', name: 'VAT — אילת', rate: 0 }]);
  assert.deepEqual(table({ country: 'IL', district: 'eilat' }, DATE), [{ level: 'district', name: 'VAT — אילת', rate: 0 }]);
  assert.deepEqual(table({ country: 'IL', city: 'Tel Aviv' }, DATE), [{ level: 'country', name: 'VAT (מע"מ)', rate: 0.18 }]);
  assert.deepEqual(table({ country: 'IL', city: 'Tel Aviv' }, '2024-06-01'), [{ level: 'country', name: 'VAT (מע"מ)', rate: 0.17 }]);
  assert.equal(table({ country: 'US', state: 'TX' }, DATE), undefined);
});

test('resolveLineTax treats Eilat as a zero area, not an unstubbed place', async () => {
  const { resolveLineTax } = await import('../lib/tax/resolveLineTax');
  const seller = { from: ['books'], place: { country: 'IL' }, registrations: [{ kind: 'vat' as const, number: 'IL-1', place: { country: 'IL' } }] };
  const answer = resolveLineTax({ seller, buyer: { country: 'IL', city: 'Eilat', district: 'eilat' }, date: DATE, tables: { IL: ilVatRateTable() } });
  assert.equal(answer.reason, 'zero-area');
  assert.equal(answer.rate, 0);
  assert.equal(answer.components[0].level, 'district');
});
