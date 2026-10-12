/**
 * A-23 (PLAN IL-5): the yearly withholding report (Form 856). Hand-checked: 100,000 + 50,000 base
 * for one vendor at 30% and 20% is 40,000 withheld (26.67% effective); a payment without a
 * certificate number is counted, not guessed; another year and a received payment are left out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORM_856_CSV_HEADERS, form856CsvRows, form856Notes, form856Rows, form856Summary, form856Year, isForm856Payment,
  type Form856Payment,
} from '../lib/tax/form856';

const payments: Form856Payment[] = [
  { id: 'p1', date: '2026-03-10', direction: 'made', contactId: 'v1', contactName: 'Alpha Ltd', contactTaxId: '511111111', amountCents: 118_000, vatCents: 18_000, withheldCents: 30_000, withholdingRatePercent: 30, withholdingCertificate: 'A-1' },
  { id: 'p2', date: '2026-09-02', direction: 'made', contactId: 'v1', contactName: 'Alpha Ltd', amountCents: 59_000, vatCents: 9_000, withheldCents: 10_000, withholdingRatePercent: 20, withholdingCertificate: 'A-2' },
  { id: 'p3', date: '2026-05-05', direction: 'made', contactId: 'v2', contactName: 'Beta Works', amountCents: 236_000, vatCents: 36_000, withheldCents: 10_000, withholdingRatePercent: 5 },
  { id: 'p4', date: '2025-12-31', direction: 'made', contactId: 'v1', contactName: 'Alpha Ltd', amountCents: 100_000, withheldCents: 30_000, withholdingCertificate: 'A-0' },
  { id: 'p5', date: '2026-06-06', direction: 'received', contactId: 'c1', contactName: 'A customer', amountCents: 100_000, withheldCents: 5_000 },
  { id: 'p6', date: '2026-07-07', direction: 'made', contactId: 'v2', contactName: 'Beta Works', amountCents: 40_000, withheldCents: 0 },
];

test('a payment belongs to the year of its date, and only money out with tax withheld counts', () => {
  assert.equal(form856Year('2026-03-10'), '2026');
  assert.equal(form856Year(''), '');
  assert.equal(isForm856Payment(payments[0]), true);
  assert.equal(isForm856Payment(payments[4]), false, 'money received is not Form 856');
  assert.equal(isForm856Payment(payments[5]), false, 'nothing withheld is not Form 856');
});

test('rows are per vendor for the year, with paid, base, withheld and the effective rate', () => {
  const rows = form856Rows(payments, '2026');
  assert.deepEqual(rows.map(r => r.name), ['Alpha Ltd', 'Beta Works']);
  const [alpha, beta] = rows;
  assert.equal(alpha.payments, 2);
  assert.equal(alpha.paidCents, 177_000);
  assert.equal(alpha.baseCents, 150_000);
  assert.equal(alpha.withheldCents, 40_000);
  assert.equal(alpha.effectiveRatePercent, 26.67, '40,000 / 150,000 rounded to two decimals');
  assert.deepEqual(alpha.certificates, ['A-1', 'A-2']);
  assert.deepEqual(alpha.months, ['2026-03', '2026-09']);
  assert.equal(alpha.missingCertificates, 0);
  assert.equal(beta.withheldCents, 10_000);
  assert.equal(beta.effectiveRatePercent, 5);
  assert.equal(beta.missingCertificates, 1, 'a payment without a certificate number is counted');
  assert.deepEqual(beta.months, ['2026-05']);
});

test('another year is left out entirely', () => {
  assert.equal(form856Rows(payments, '2025').length, 1);
  assert.equal(form856Rows(payments, '2025')[0].withheldCents, 30_000);
  assert.equal(form856Rows(payments, '2026').some(r => r.withheldCents === 30_000 + 10_000 + 10_000 + 30_000), false);
  assert.deepEqual(form856Rows([], '2026'), []);
});

test('the summary and the notes say what is missing, in plain words', () => {
  const summary = form856Summary(form856Rows(payments, '2026'));
  assert.deepEqual(summary, { vendors: 2, payments: 3, paidCents: 413_000, withheldCents: 50_000, missingCertificates: 1 });
  const notes = form856Notes(form856Rows(payments, '2026'));
  assert.equal(notes.length, 2);
  assert.match(notes[0], /1 payment in the year have no certificate number/);
  assert.match(notes[1], /Beta Works/);
  const clean = form856Rows([payments[0]], '2026');
  assert.match(form856Notes(clean)[0], /Every reported payment has a certificate number/);
});

test('the CSV rows are the same figures a spreadsheet would get', () => {
  const rows = form856CsvRows(form856Rows(payments, '2026'));
  assert.equal(FORM_856_CSV_HEADERS.length, 10);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ['Alpha Ltd', '511111111', 2, 1770, 1500, 400, 26.67, 'A-1 A-2', '2026-03 2026-09', 0]);
  assert.deepEqual(rows[1], ['Beta Works', '', 1, 2360, 2000, 100, 5, '', '2026-05', 1]);
});
