import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTexasLocalRates,parseCaliforniaLocalRates,parseNewYorkLocalRates,parseWashingtonLocalRates,parseColoradoLocalRates, parseRateFraction } from '../lib/tax/stateLocalRateImporters';
test('E-11 Texas: distinguish a combined city rate from a component-only line',()=>{
 const result=parseTexasLocalRates([['Name','Local Code','Local Rate','Total Rate'],['Abilene','2221012','.020000','.082500'],['Taylor Co','4221000','.005000','']], '2026-10-01');
 assert.deepEqual(result.rows.map(x=>[x.rate,x.basis]),[[0.0825,'combined'],[0.005,'component']]);
 assert.equal(result.readyForTaxCalculation,false);
});
test('E-11 California: three decimal percentage points and source retained',()=>{
 const r=parseCaliforniaLocalRates([['Location','Rate','County','Type'],['Alameda','10.750%','Alameda','City']],'2026-10-01');
 assert.equal(r.rows[0].rate,0.1075);assert.match(r.rows[0].source,/cdtfa/);
});
test('E-11 New York: reporting code and vulgar fractions survive publication extraction',()=>{
 const r=parseNewYorkLocalRates([['County or other locality','Tax rate %','Reporting code'],['Albany','8¼','0181'],['Kings','8½','1234']],'2026-10-01');
 assert.deepEqual(r.rows.map(x=>x.rate),[0.0825,0.085]);assert.equal(r.rows[0].code,'0181');
});
test('E-11 Washington: five-digit ZIP and four-digit plus-4 range stay strings',()=>{
 const r=parseWashingtonLocalRates([['ZIP','ZIP+4 Low','ZIP+4 High','Location Code','Rate'],['98101','0000','9999','1726','.103'],['98102','9999','0000','1726','.103']],'2026-10-01');
 assert.equal(r.rows[0].zip,'98101');assert.equal(r.rows[0].zip4Low,'0000');assert.equal(r.rows[0].rate,0.103);
 assert.equal(r.issues[0].row,3);
});
test('E-11 Colorado: only component rates, not guessed cumulative tax for home-rule',()=>{
 const r=parseColoradoLocalRates([['Jurisdiction','Sales Tax Rate','Location Code'],['County','1.25%','001']],'2026-07-01');
 assert.equal(r.rows[0].rate,0.0125);assert.equal(r.rows[0].basis,'component');
 assert.throws(()=>parseColoradoLocalRates([], '2026-07-01'),/headings/);
 assert.throws(()=>parseColoradoLocalRates([['a']],'2026-02-30'),/effective date/);
});


test('E-11: unknown or duplicated source headers stop an import before any rates are interpreted', () => {
  assert.throws(
    () => parseTexasLocalRates([['Name', 'Local Code', 'Something Else'], ['Austin', '1', '.08']], '2026-10-01'),
    /Unrecognized source headings/,
  );
  assert.throws(
    () => parseCaliforniaLocalRates([['Location', 'Rate', 'Rate'], ['A', '8%', '9%']], '2026-10-01'),
    /Duplicate column heading/,
  );
  assert.throws(
    () => parseWashingtonLocalRates([['ZIP', 'Rate'], ['98101', '.103']], '2026-10-01'),
    /Unrecognized source headings/,
  );
});

test('E-11: preserve audit edition, source row, explicit date bounds, and publication link', () => {
  const r = parseCaliforniaLocalRates(
    [['Location', 'Rate', 'County'], ['City', '10.750%', 'County']],
    '2026-10-01',
    {
      validTo: '2026-12-31',
      edition: 'CDTFA 2026 Q4 (verified manually)',
      publicationUrl: 'https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm',
    },
  );
  assert.deepEqual(
    [r.rows[0].sourceRow, r.rows[0].validFrom, r.rows[0].validTo, r.rows[0].edition],
    [2, '2026-10-01', '2026-12-31', 'CDTFA 2026 Q4 (verified manually)'],
  );
  assert.equal(r.readyForTaxCalculation, false);
  assert.throws(
    () => parseCaliforniaLocalRates([['Location', 'Rate']], '2026-10-01', { validTo: '2026-09-30' }),
    /end date/,
  );
  assert.throws(
    () => parseCaliforniaLocalRates([['Location', 'Rate']], '2026-10-01', { validTo: '2026-11-31' }),
    /end date/,
  );
  assert.throws(
    () => parseCaliforniaLocalRates([['Location', 'Rate']], '2026-10-01', { publicationUrl: 'http://example.com/file.csv' }),
    /HTTPS/,
  );
});

test('E-11: reject accidental decimal-versus-percent confusion', () => {
  assert.equal(parseTexasLocalRates(
    [['Name', 'Local Code', 'Local Rate'], ['City', '12345', '.02']], '2026-10-01',
  ).rows[0].rate, 0.02);
  const texasWrongUnit = parseTexasLocalRates(
    [['Name', 'Local Code', 'Total Rate'], ['City', '12345', '8.25']], '2026-10-01',
  );
  assert.equal(texasWrongUnit.rows.length, 0);
  assert.match(texasWrongUnit.issues[0].reason, /units|range/);
  assert.throws(() => parseRateFraction('0.1', 'auto'), /Ambiguous/);
  assert.equal(parseRateFraction('8¼', 'percentage'), 0.0825);
  assert.equal(parseRateFraction('8 1/4', 'percentage'), 0.0825);
  assert.equal(parseRateFraction('8-1/4', 'percentage'), 0.0825);
});

test('E-11: overlapping Washington ZIP+4 coverage is flagged even for different codes', () => {
  const r = parseWashingtonLocalRates([
    ['ZIP', 'ZIP+4 Low', 'ZIP+4 High', 'Location Code', 'Rate'],
    ['98101', '0000', '0999', '1726', '.103'],
    ['98101', '0500', '1500', '1727', '.104'],
    ['98101', '1501', '9999', '1727', '.104'],
    ['98102', '0000', '9999', '1726', '.103'],
  ], '2026-10-01', { validTo: '2026-12-31', edition: 'WA 2026 Q4 short' });
  assert.equal(r.rows.length, 4);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].row, 3);
  assert.match(r.issues[0].reason, /Overlapping WA ZIP\+4/);
  assert.equal(r.readyForTaxCalculation, false);
});

test('E-11: malformed Washington ZIP and ZIP+4 cannot sneak through', () => {
  const r = parseWashingtonLocalRates([
    ['ZIP', 'ZIP+4 Low', 'ZIP+4 High', 'Location Code', 'Rate'],
    ['09801', '', '', 'A', '.080'],
    ['9801', '0000', '9999', 'B', '.080'],
    ['09801', '0000', '9999', 'C', '.080'],
  ], '2026-10-01');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].zip, '09801');
  assert.deepEqual(r.issues.map(issue => issue.row), [2, 3]);
});

test('E-11: duplicate rows produce an issue; empty or invalid input is never treated as ready', () => {
  const r = parseColoradoLocalRates([
    ['Jurisdiction', 'Sales Tax Rate', 'Location Code'],
    ['District', '1.25%', '123'],
    ['District', '1.25%', '123'],
  ], '2026-10-01');
  assert.equal(r.rows.length, 1);
  assert.equal(r.issues[0].row, 3);
  assert.match(r.issues[0].reason, /Duplicate/);
  const empty = parseColoradoLocalRates([['Jurisdiction', 'Sales Tax Rate']], '2026-10-01');
  assert.equal(empty.rows.length, 0);
  assert.match(empty.issues[0].reason, /No valid/);
  assert.equal(empty.readyForTaxCalculation, false);
});

test('E-11: missing key identifiers reject the affected rows, not the whole reviewed table', () => {
  const ny = parseNewYorkLocalRates([
    ['County or other locality', 'Tax rate %', 'Reporting code'],
    ['County A', '8½', ''],
    ['County B', '8¼', '0070'],
  ], '2026-10-01');
  assert.equal(ny.rows.length, 1);
  assert.equal(ny.rows[0].code, '0070');
  assert.equal(ny.issues[0].row, 2);
});

test('E-11: alternate accepted columns must not silently compete', () => {
  assert.throws(
    () => parseCaliforniaLocalRates([['Location', 'Rate', 'Tax Rate'], ['City', '8%', '9%']], '2026-10-01'),
    /Ambiguous source headings/,
  );
});
test('E-11: fractional percentage notation and official-domain source protection', () => {
  assert.equal(parseRateFraction('8¼%', 'percentage'), 0.0825);
  assert.throws(
    () => parseNewYorkLocalRates([['Jurisdiction', 'Rate', 'Code']], '2026-10-01', {
      publicationUrl: 'https://unverified.example/rates.pdf',
    }),
    /HTTPS/,
  );
});
test('E-11: different rates for one jurisdiction/code/interval are never silently reconciled', () => {
  const r = parseTexasLocalRates([
    ['Name', 'Local Code', 'Local Rate', 'Total Rate'],
    ['City', '12345', '.02', '.0825'],
    ['City', '12345', '.02', '.0875'],
  ], '2026-10-01');
  assert.equal(r.rows.length, 2);
  assert.equal(r.issues[0].row, 3);
  assert.match(r.issues[0].reason, /Conflicting rates/);
  assert.equal(r.readyForTaxCalculation, false);
});
