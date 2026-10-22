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

// Review fixes, by hand:
//   TOTAL SAVINGS $5.00 / TOTAL TAX $2.00 / TOTAL ITEMS 3 / TOTAL $40.00 → 4,000 (the qualified totals are skipped)
//   AMOUNT DUE 18.00 is a payable label → 1,800; TOTAL $1 234.56 (space or no-break space) → 123,456, never 23,456
//   "TOTAL CAD $25.00" → CAD with a "$ is ambiguous" warning; "$" alone → USD, no warning
//   99/99/9999 and 12-34-56 are not dates; 31/12/2026 is; payee "Mart" does not match WALMART
test('qualified totals are skipped and payable labels are read', () => {
  const r = parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL SAVINGS $5.00', 'TOTAL TAX $2.00', 'TOTAL ITEMS 3', 'TOTAL $40.00', 'TOTAL SAVED 1.00'], []);
  assert.deepEqual([r.totalCents, r.currency, r.warnings], [4_000, 'USD', []]);
  assert.equal(parseReceiptOCR(['SHOP', '2026-10-05', 'ITEM 18.00', 'AMOUNT DUE 18.00 GBP'], []).totalCents, 1_800);
  assert.equal(parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL TAX $2.00', 'BALANCE DUE $9.00'], []).totalCents, 900);
});

test('space thousands are read whole, never split', () => {
  assert.equal(parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL $1 234.56'], []).totalCents, 123_456);
  assert.equal(parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL $1 234.56'], []).totalCents, 123_456);
  assert.equal(parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL $1,234.56'], []).totalCents, 123_456);
  const bare = parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL 1 234.56', 'USD'], []);
  assert.notEqual(bare.totalCents, 23_456);
  assert.equal(bare.totalCents, 0);
  assert.ok(bare.warnings.some(w => /split by a space/.test(w)));
});

test('a code overrides "$", with a warning; "$" alone is USD', () => {
  const cad = parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL CAD $25.00'], []);
  assert.deepEqual([cad.totalCents, cad.currency], [2_500, 'CAD']);
  assert.deepEqual(cad.warnings, ['"$" alone is ambiguous and the receipt says CAD: CAD is used — check it.']);
  assert.equal(parseReceiptOCR(['SHOP', 'PRICES IN AUD', '2026-10-05', 'TOTAL $25.00'], []).currency, 'AUD');
  assert.deepEqual(parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL $25.00'], []).warnings, []);
  const clash = parseReceiptOCR(['SHOP', '2026-10-05', 'TOTAL €25.00 USD'], []);
  assert.equal(clash.currency, 'EUR');
  assert.ok(clash.warnings.some(w => /disagree/.test(w)));
});

test('impossible dates are refused', () => {
  const bad = parseReceiptOCR(['SHOP', '99/99/9999', '12-34-56', 'TOTAL $1.00'], []);
  assert.equal(bad.dateStr, '');
  assert.match(bad.warnings[0], /No valid date was found \(99\/99\/9999, 12-34-56/);
  assert.equal(parseReceiptOCR(['SHOP', '99/99/9999', '31/12/2026', 'TOTAL $1.00'], []).dateStr, '31/12/2026');
  assert.equal(parseReceiptOCR(['SHOP', '2026-02-30', 'TOTAL $1.00'], []).dateStr, '');
});

test('a known payee matches only on whole words', () => {
  assert.equal(parseReceiptOCR(['WALMART #12', '2026-10-05', 'TOTAL $1.00'], ['Mart']).merchant, 'WALMART #12');
  assert.equal(parseReceiptOCR(['QUICK-MART', '2026-10-05', 'TOTAL $1.00'], ['Mart']).merchant, 'Mart');
});

test('help states the method, an example and the limits', () => {
  const h = RECEIPT_CAPTURE_ALGO.help;
  assert.ok(h && h.method && h.example);
  for (const s of [/dot decimals/i, /English "total"/, /date/i, /CAD/, /no vision model/i, /nothing is posted/i]) assert.match(h.limits, s);
  const ex = parseReceiptOCR(['SHOP', '15/09/2026', 'TOTAL SAVINGS $5.00', 'TOTAL CAD $1 234.56'], []);
  assert.deepEqual([ex.dateStr, ex.totalCents, ex.currency], ['15/09/2026', 123_456, 'CAD']);
});
