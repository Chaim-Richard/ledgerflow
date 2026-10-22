/**
 * AUD-14: the receipt reader reads the receipt the person pastes, and says what it cannot be sure of. Figures by hand:
 *   CORNER CAFE, 2026-10-03: latte 4.50 + croissant 3.25 = 7.75, VAT 1.55, TOTAL £9.30 → 930, GBP, no warnings
 *   OFFICE WORLD #42 (a known payee "Office World"), 15/09/2026: 12.00 + 86.50 = TOTAL 98.50, "USD" → 9,850, no warnings
 *   QUICK MART, two dates, no "total" line, no currency: the first date, the largest amount 3.40 → 340, three warnings
 *   two different totals 10.00 and €12.00: the last (1,200, EUR), one warning
 * With nothing pasted the built-in receipt is read and labelled "Example only"; pasted text is read instead of it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptOCR, RECEIPT_CAPTURE_ALGO } from '../lib/algorithms/receipt-capture';
import { buildAlgorithmContext } from '../lib/algorithms/types';

const CAFE = ['CORNER CAFE', '12 HIGH ST', '2026-10-03 09:12', 'LATTE        4.50', 'CROISSANT    3.25', 'SUBTOTAL     7.75', 'VAT          1.55', 'TOTAL     £9.30'];
const OFFICE = ['Thank you for shopping', 'OFFICE WORLD #42', '15/09/2026', 'PAPER A4     12.00', 'TONER        86.50', 'TOTAL       98.50', 'USD'];

test('two receipts give their own merchant, date, total and currency', () => {
  assert.deepEqual(parseReceiptOCR(CAFE, []), { merchant: 'CORNER CAFE', dateStr: '2026-10-03', totalCents: 930, currency: 'GBP', warnings: [] });
  assert.deepEqual(parseReceiptOCR(OFFICE, ['Office World']), { merchant: 'Office World', dateStr: '15/09/2026', totalCents: 9_850, currency: 'USD', warnings: [] });
});

test('what the rules cannot be sure of is a warning, not a confident answer', () => {
  const unsure = parseReceiptOCR(['QUICK MART', '01/10/2026', '02/10/2026', 'MILK 2.10', 'BREAD 3.40'], []);
  assert.deepEqual([unsure.dateStr, unsure.totalCents, unsure.currency], ['01/10/2026', 340, undefined]);
  assert.equal(unsure.warnings.length, 3);
  assert.match(unsure.warnings[0], /More than one date \(01\/10\/2026, 02\/10\/2026\)/);
  assert.match(unsure.warnings[1], /No line says "total"/);
  assert.match(unsure.warnings[2], /no currency/);

  const twoTotals = parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL 10.00', 'TOTAL €12.00'], []);
  assert.deepEqual([twoTotals.totalCents, twoTotals.currency], [1_200, 'EUR']);
  assert.deepEqual(twoTotals.warnings, ['More than one total (10.00, 12.00): the last is used — check it.']);

  const empty = parseReceiptOCR([], []);
  assert.equal(empty.totalCents, 0);
  assert.ok(empty.warnings.includes('The receipt has no text.') && empty.warnings.includes('No amount was found.'));
});

test('nothing pasted: the sample is read and labelled; pasted text is read instead; no accuracy is claimed', () => {
  const ctx = buildAlgorithmContext([], [], '2026-10-22', { start: '2026-10-01', end: '2026-10-31' });
  const metric = (r: ReturnType<typeof RECEIPT_CAPTURE_ALGO.compute>, label: string) => r.metrics.find(m => m.label === label)?.value;

  const sample = RECEIPT_CAPTURE_ALGO.compute(ctx, { receiptText: '' });
  assert.match(sample.insights[0], /^Example only/);
  assert.deepEqual([metric(sample, 'Merchant'), metric(sample, 'Total')], ['HOME DEPOT 123', 'USD 20.00']);

  const mine = RECEIPT_CAPTURE_ALGO.compute(ctx, { receiptText: CAFE.join('\n') });
  assert.ok(!mine.insights.some(i => /Example only/.test(i)));
  assert.deepEqual([metric(mine, 'Merchant'), metric(mine, 'Date'), metric(mine, 'Total'), metric(mine, 'Warnings')], ['CORNER CAFE', '2026-10-03', 'GBP 9.30', 0]);

  assert.ok(![RECEIPT_CAPTURE_ALGO.description, ...sample.insights].some(t => /\d+\s*%|accura/i.test(t)), 'no accuracy figure');
});
