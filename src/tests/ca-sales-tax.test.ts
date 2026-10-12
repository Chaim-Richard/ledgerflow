/**
 * A-24: Canada's GST/HST/PST table. Hand-checked: Ontario 13% HST, Nova Scotia 14% from 1 Apr 2025
 * (15% before), BC 12% combined, Quebec 14.975%, Saskatchewan 11%, Alberta and the territories 5%.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CA_SALES_TAX, CA_PROVINCES, CA_HST_PROVINCES,
  caSalesTaxRows, canadaVatComponents, canadaCombinedRate, canadaSalesTaxRateTable,
} from '../lib/tax/caSalesTax';

const DATE = '2026-10-11';

test('all thirteen provinces and territories are present', () => {
  assert.deepEqual(CA_PROVINCES.sort(), ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);
  assert.equal(new Set(CA_PROVINCES).size, 13);
});

test('every row carries a dated https source', () => {
  for (const row of CA_SALES_TAX) {
    assert.match(row.source, /^https:\/\//, `${row.province} ${row.kind}`);
    assert.match(row.validFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.rate >= 0 && row.rate <= 0.2, `${row.province} ${row.kind} rate in range`);
  }
});

test('the federal GST is 5% in every province', () => {
  for (const province of CA_PROVINCES) {
    const gst = caSalesTaxRows(province, DATE).find(r => r.kind === 'GST');
    assert.ok(gst, `${province} has a GST row`);
    assert.equal(gst.rate, 0.05, `${province} GST is 5%`);
  }
});

test('HST provinces charge one combined rate, hand-checked', () => {
  assert.deepEqual([...CA_HST_PROVINCES].sort(), ['NB', 'NL', 'NS', 'ON', 'PE']);
  assert.equal(canadaCombinedRate('ON', DATE), 0.13);
  assert.equal(canadaCombinedRate('NS', DATE), 0.14, 'Nova Scotia from 1 Apr 2025');
  assert.equal(canadaCombinedRate('NS', '2025-03-31'), 0.15, 'Nova Scotia before that');
  assert.equal(canadaCombinedRate('NB', DATE), 0.15);
  assert.equal(canadaCombinedRate('NL', DATE), 0.15);
  assert.equal(canadaCombinedRate('PE', DATE), 0.15);
  assert.equal(canadaCombinedRate('PE', '2014-01-01'), 0.14, 'PE was 14% until Oct 2016');
});

test('an HST province does not add the GST a second time', () => {
  const components = canadaVatComponents('ON', DATE);
  assert.deepEqual(components, [{ level: 'country', name: 'HST Ontario', rate: 0.13 }]);
});

test('provinces with their own tax keep the GST and the provincial tax apart', () => {
  assert.equal(canadaCombinedRate('BC', DATE), 0.12);
  assert.equal(canadaCombinedRate('SK', DATE), 0.11);
  assert.equal(canadaCombinedRate('MB', DATE), 0.12);
  assert.equal(canadaCombinedRate('QC', DATE), 0.14975);
  assert.deepEqual(canadaVatComponents('QC', DATE).map(c => [c.name, c.rate]), [['GST', 0.05], ['QST Quebec', 0.09975]]);
  assert.deepEqual(canadaVatComponents('BC', DATE).map(c => c.rate), [0.05, 0.07]);
});

test('GST-only places are 5% and the unknown province answers nothing', () => {
  for (const province of ['AB', 'NT', 'NU', 'YT']) assert.equal(canadaCombinedRate(province, DATE), 0.05, province);
  assert.equal(canadaCombinedRate('ZZ', DATE), undefined);
  assert.deepEqual(canadaVatComponents('ZZ', DATE), []);
});

test('the same province and tax never has two rows in force at once', () => {
  for (const province of CA_PROVINCES) {
    for (const kind of ['GST', 'HST', 'PST', 'RST', 'QST']) {
      const on = (day: string) => caSalesTaxRows(province, day).filter(r => r.kind === kind);
      for (const day of ['2015-06-15', '2021-06-15', '2026-10-11', '2030-01-01']) {
        assert.ok(on(day).length <= 1, `${province} ${kind} has ${on(day).length} rows on ${day}`);
      }
    }
  }
});

test('the table plugs into resolveLineTax as RateTables.CA', () => {
  const table = canadaSalesTaxRateTable();
  assert.deepEqual(table({ country: 'CA', state: 'ON' }, DATE), [{ level: 'country', name: 'HST Ontario', rate: 0.13 }]);
  assert.equal(table({ country: 'CA' }, DATE), undefined, 'no province, no table');
  assert.equal(table({ country: 'US', state: 'ON' }, DATE), undefined);
  assert.equal(table({ country: 'CA', state: 'ZZ' }, DATE), undefined);
});
