import test from 'node:test';
import assert from 'node:assert/strict';
import {failureAnnotations} from './playwright-ci-feedback.mjs';

test('the final failed retry exposes its original Hebrew assertion and source location',()=>{
  const report={suites:[{title:'Report',file:'e2e/report.spec.ts',specs:[{ok:false,line:42,title:'Hebrew CSV',tests:[{status:'unexpected',results:[{error:{message:'Initial timeout'}},{errors:[{message:'Expected אישור; received another reference'}]}]}]}]}]};
  assert.deepEqual(failureAnnotations(report),['::error file=e2e/report.spec.ts,line=42::Report › Hebrew CSV: Expected אישור; received another reference']);
});
test('passed retries, expected failures and ordinary skips do not become false errors',()=>{
  assert.deepEqual(failureAnnotations({suites:[{specs:[{ok:true,tests:[{status:'flaky',results:[{status:'failed'},{status:'passed'}]}]},{ok:true,tests:[{expectedStatus:'failed',results:[{status:'failed'}]}]},{ok:true,tests:[{results:[{status:'skipped'}]}]}]}]}),[]);
});
test('command delimiters are escaped and setup errors and unexpected passes remain visible',()=>{
  const report={errors:[{message:'Setup\n::warning::fake%'}],suites:[{file:'e2e/a,b:1.spec.ts',specs:[{title:'Unexpected pass',ok:false,tests:[{status:'unexpected',expectedStatus:'failed',results:[{status:'passed'}]}]}]}]};
  const annotations=failureAnnotations(report);
  assert.equal(annotations[0],'::error::Playwright setup: Setup%0A::warning::fake%25');
  assert.ok(annotations[1].startsWith('::error file=e2e/a%2Cb%3A1.spec.ts::'));
  assert.ok(annotations[1].includes('passed (expected failed)'));
  assert.deepEqual(failureAnnotations(null),[]);
});

test('Playwright test-directory paths link to repository files and never outside the checkout',()=>{
  const spec={title:'CSV',ok:false,line:12,tests:[{status:'unexpected',results:[{error:{message:'Failure'}}]}]};
  const report={config:{rootDir:'/repo/e2e'},suites:[{file:'reports/csv.spec.ts',specs:[spec]}]};
  assert.equal(failureAnnotations(report,'/repo')[0],'::error file=e2e/reports/csv.spec.ts,line=12::CSV: Failure');
  report.suites[0].file='../../outside.spec.ts';
  assert.equal(failureAnnotations(report,'/repo')[0],'::error::CSV: Failure');
});
