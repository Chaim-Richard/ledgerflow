import test from 'node:test';
import assert from 'node:assert/strict';
import { build1099Preview, threshold1099Cents, us1099ReviewCsvRows } from '../lib/tax/us1099Preview';
test('E-10 thresholds change by payment year and exceptional MISC boxes remain distinct', () => {
 assert.equal(threshold1099Cents(2025,'1099-NEC','1a'),60000);
 assert.equal(threshold1099Cents(2026,'1099-NEC','1a'),200000);
 assert.equal(threshold1099Cents(2026,'1099-MISC','1'),200000);
 assert.equal(threshold1099Cents(2026,'1099-MISC','2'),1000);
 assert.equal(threshold1099Cents(2026,'1099-MISC','10'),60000);
 assert.throws(()=>threshold1099Cents(2026,'1099-NEC','2'),/must be 1a/);
});
test('E-10 consolidates vendor totals, leaves missing W-9 data incomplete, computes a 1096 review summary', () => {
 const p=build1099Preview([
  { vendorId:'v1',vendorName:'Service Co',form:'1099-NEC',box:'1a',paidCents:110000 },
  { vendorId:'v1',vendorName:'Service Co',form:'1099-NEC',box:'1a',paidCents:100000 },
  { vendorId:'v2',vendorName:'Small Co',form:'1099-NEC',box:'1a',paidCents:150000 },
  { vendorId:'v3',vendorName:'Publisher',form:'1099-MISC',box:'2',paidCents:1500,tinLastFour:'1111' },
 ],2026);
 assert.deepEqual(p.forms.map(r=>[r.vendorId,r.amountCents]),[['v3',1500],['v1',210000]]);
 assert.equal(p.excluded,1);
 assert.deepEqual(p.form1096.map(g=>[g.form,g.forms,g.totalCents]),[['1099-NEC',1,210000],['1099-MISC',1,1500]]);
 assert.equal(p.filingReady,false);
 assert.ok(us1099ReviewCsvRows(p).every(r=>r.includes('REVIEW ONLY — NOT IRIS')));
 assert.throws(()=>build1099Preview([{vendorId:'v',vendorName:'A',form:'1099-NEC',box:'1a',paidCents:200000,tinLastFour:'123456789'}],2026),/final four/);
});
