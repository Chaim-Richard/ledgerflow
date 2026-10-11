import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTexasLocalRates,parseCaliforniaLocalRates,parseNewYorkLocalRates,parseWashingtonLocalRates,parseColoradoLocalRates } from '../lib/tax/stateLocalRateImporters';
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
