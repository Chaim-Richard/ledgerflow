/** The filings each entity owes for a year, with evidence (PLAN §10). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { entityFilings } from '../lib/tax/entityFilings';
import type { FactSources } from '../lib/rules/facts';

const verified = { kind: 'authority' as const, ref: 'letter', verifiedBy: 'acct', verifiedAt: '2026-01-10' };
const sources: FactSources = {
  books: [{ attribute: 'country', value: 'IL' }, { attribute: 'taxTreatment', value: 'il_company' }],
  labels: {
    'world:tx': [{ attribute: 'country', value: 'US' }, { attribute: 'taxTreatment', value: 's_corporation', evidence: verified }],
    'world:ny': [{ attribute: 'country', value: 'US' }, { attribute: 'taxTreatment', value: 's_corporation' }],
    'world:np': [{ attribute: 'country', value: 'US' }, { attribute: 'exemptStatus', value: 'recognized_exempt' }],
  },
};

test('each entity\'s filings: the books (Israeli company), a verified S corporation, a declared one, a declared exemption', () => {
  const [books, tx, ny, np] = entityFilings(sources, ['world:tx', 'world:ny', 'world:np'], 2026);
  assert.deepEqual(books.due.map(d => d.form).sort(), ['דוח שנתי 1214', 'דוח תקופתי למע"מ'].sort());
  assert.deepEqual(tx.due.map(d => d.form), ['Form 1120-S']);
  assert.equal(tx.due[0].status, 'calculation');
  assert.deepEqual([ny.due, ny.blocked.map(b => [b.form, b.unverified])], [[], [['Form 1120-S', ['taxTreatment']]]]);
  assert.deepEqual(np.blocked.map(b => b.ruleId), ['us-990']);
});
