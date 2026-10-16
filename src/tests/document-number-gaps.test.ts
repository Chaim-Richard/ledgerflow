import test from 'node:test';
import assert from 'node:assert/strict';
import { documentNumberGaps, parseDocumentNumber, documentNumberGapCsvRows, type NumberedDocument } from '../lib/documentNumberGaps';

const doc = (id: string, number?: string, collection = 'Invoice'): NumberedDocument => ({ id, number, collection });

test('A-184: the prefix is everything before the trailing digits', () => {
  assert.deepEqual(parseDocumentNumber('INV-2026-0007'), { prefix: 'INV-2026-', sequence: 7 });
  assert.deepEqual(parseDocumentNumber(' 2026/14 '), { prefix: '2026/', sequence: 14 });
  assert.equal(parseDocumentNumber('NO-NUMBER'), null);
  assert.equal(parseDocumentNumber(''), null);
  assert.equal(parseDocumentNumber(undefined), null);
});

test('A-184: a hole between the first and last number of one series is reported', () => {
  const report = documentNumberGaps([doc('i1', 'INV-2026-0001'), doc('i2', 'INV-2026-0002'), doc('i4', 'INV-2026-0004')]);
  assert.equal(report.series.length, 1);
  const series = report.series[0];
  assert.equal(series.collection, 'Invoice');
  assert.equal(series.prefix, 'INV-2026-');
  assert.equal(series.documents, 3);
  assert.equal(series.first, 1);
  assert.equal(series.last, 4);
  assert.deepEqual(series.missing, [3]);
  assert.equal(series.missingCount, 1);
  assert.equal(report.missingTotal, 1);
});

test('A-184: a repeated number is listed with both documents', () => {
  const report = documentNumberGaps([doc('i1', 'INV-1'), doc('i2', 'INV-1'), doc('i3', 'INV-3')]);
  const series = report.series[0];
  assert.equal(series.duplicates.length, 1);
  assert.deepEqual(series.duplicates[0], { number: 'INV-1', ids: ['i1', 'i2'] });
  assert.deepEqual(series.missing, [2]);
  assert.equal(report.duplicateTotal, 1);
});

test('A-184: collections and prefixes are separate series', () => {
  const report = documentNumberGaps([
    doc('i1', 'INV-2026-0001'), doc('i2', 'INV-2026-0009'),
    doc('b1', 'BILL-2026-0001', 'Bill'),
    doc('e1', 'EST-1', 'Estimate'), doc('e2', 'EST-3', 'Estimate'),
  ]);
  assert.equal(report.series.length, 3);
  const invoice = report.series.find(series => series.collection === 'Invoice')!;
  assert.deepEqual(invoice.missing, [2, 3, 4, 5, 6, 7, 8]);
  const bill = report.series.find(series => series.collection === 'Bill')!;
  assert.deepEqual(bill.missing, []);
  const estimate = report.series.find(series => series.collection === 'Estimate')!;
  assert.deepEqual(estimate.missing, [2]);
});

test('A-184: a document with no number and a number with no digits are counted separately', () => {
  const report = documentNumberGaps([doc('i1', 'INV-1'), doc('i2', undefined), doc('i3', '   '), doc('i4', 'LEGACY/A')]);
  assert.equal(report.unnumbered, 2);
  assert.deepEqual(report.unparsable, [{ id: 'i4', collection: 'Invoice', number: 'LEGACY/A' }]);
  assert.equal(report.series.length, 1);
});

test('A-184: a long gap is capped for display but its count stays true', () => {
  const documents = [doc('first', 'INV-1'), doc('last', 'INV-500')];
  const report = documentNumberGaps(documents);
  const series = report.series[0];
  assert.equal(series.missingCount, 498);
  assert.equal(series.missing.length, 200);
  assert.equal(series.missingTruncated, true);
  assert.equal(report.missingTotal, 498);
});

test('A-184: the CSV writes the series, the gap count and the numbers', () => {
  const report = documentNumberGaps([doc('i1', 'INV-2026-0001'), doc('i3', 'INV-2026-0003')]);
  const [row] = documentNumberGapCsvRows(report.series);
  assert.deepEqual(row, ['Invoice', 'INV-2026-', '2', '1', '3', '1', '2', '']);
});
