/** Tax code suggestions that learn from history and corrections (PLAN §6). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestTaxCode, unusualTaxCode, type TaxHistoryRow } from '../lib/tax/taxSuggestions';

const h = (date: string, taxCodeId: string, contactId = 'c1', itemId = 'i1', entity = 'il'): TaxHistoryRow => ({ date, taxCodeId, contactId, itemId, entity });

test('the most specific match with history wins; recent documents count more', () => {
  const history = [h('2026-01-05', 'vat18'), h('2026-02-05', 'vat18'), h('2026-03-05', 'vat18'), h('2026-03-05', 'zero', 'c2', 'i9')];
  assert.deepEqual(suggestTaxCode(history, { contactId: 'c1', itemId: 'i1', entity: 'il' }, '2026-10-11'), { taxCodeId: 'vat18', share: 1, basedOn: 3, match: 'contact+item+entity' });
  assert.equal(suggestTaxCode(history, { contactId: 'c2', itemId: 'i5' }, '2026-10-11')?.match, 'contact');
  assert.equal(suggestTaxCode(history, { contactId: 'new', itemId: 'i9' }, '2026-10-11')?.taxCodeId, 'zero');
  assert.equal(suggestTaxCode([], { contactId: 'c1' }, '2026-10-11'), null);
});

test('a correction is learned: after two recent corrections the suggestion follows them', () => {
  const history = [h('2025-10-01', 'vat17'), h('2025-11-01', 'vat17'), h('2025-12-01', 'vat17'), h('2026-09-01', 'vat18'), h('2026-10-01', 'vat18')];
  const s = suggestTaxCode(history, { contactId: 'c1', itemId: 'i1', entity: 'il' }, '2026-10-11');
  assert.equal(s?.taxCodeId, 'vat18');
  assert.ok(s!.share > 0.5 && s!.share < 1);
});

test('an unusual code is flagged; a usual one or thin history is not', () => {
  const history = [h('2026-01-05', 'vat18'), h('2026-02-05', 'vat18'), h('2026-03-05', 'vat18'), h('2026-04-05', 'vat18')];
  assert.equal(unusualTaxCode(history, h('2026-05-05', 'zero'))?.taxCodeId, 'vat18');
  assert.equal(unusualTaxCode(history, h('2026-05-05', 'vat18')), null);
  assert.equal(unusualTaxCode(history.slice(0, 2), h('2026-05-05', 'zero')), null);
});
