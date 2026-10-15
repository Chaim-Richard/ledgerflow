import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseUsBankCsv, type UsBankCsvFormat } from '../lib/usBankCsv';

const fixture = (name: string) => readFileSync(new URL('./fixtures/bank-statements/' + name, import.meta.url), 'utf8');

test('E-27 Chase checking retains true posting dates, signed cents, Hebrew and check reference', () => {
  assert.deepEqual(parseUsBankCsv(fixture('us-chase-checking.csv'), 'chase-checking'), [
    { date: '2024-02-28', amountCents: -125050, description: 'שכירות Office', reference: '1042', type: 'debit' },
    { date: '2024-02-29', amountCents: 200010, description: 'Customer, Inc', type: 'credit' },
  ]);
});
test('E-27 Chase card uses POST date and optional memo, not transaction date or category', () => {
  assert.deepEqual(parseUsBankCsv(fixture('us-chase-card.csv'), 'chase-card'), [
    { date: '2024-02-29', amountCents: -2999, description: 'Travel, train', type: 'debit' },
    { date: '2024-02-29', amountCents: 1005, description: 'Card refund', type: 'credit' },
  ]);
});
test('E-27 Bank of America checking recognises and excludes preamble and opening-balance line', () => {
  assert.deepEqual(parseUsBankCsv(fixture('us-boa-checking.csv'), 'boa-checking'), [
    { date: '2024-02-28', amountCents: -10075, description: 'ירושלים חנות', type: 'debit' },
    { date: '2024-02-29', amountCents: 200050, description: 'Payroll deposit', type: 'credit' },
  ]);
});
test('E-27 Bank of America card uses posted date, payee, and independent reference', () => {
  assert.deepEqual(parseUsBankCsv(fixture('us-boa-card.csv'), 'boa-card'), [
    { date: '2024-02-29', amountCents: -8200, description: 'Internet provider', reference: 'REF-101', type: 'debit' },
    { date: '2024-02-29', amountCents: 525, description: 'Refund', reference: 'REF-102', type: 'credit' },
  ]);
});
test('E-27 Wells Fargo first row is data, not a header; full CSV quoted fields', () => {
  assert.deepEqual(parseUsBankCsv(fixture('us-wells-fargo.csv'), 'wells-fargo-checking'), [
    { date: '2024-02-28', amountCents: -6422, description: 'SAFEWAY MARKET', type: 'debit' },
    { date: '2024-02-29', amountCents: 215000, description: 'Payroll שכירות', type: 'credit' },
  ]);
  assert.deepEqual(parseUsBankCsv('02/29/2024,1.00,*,"123",Donation', 'wells-fargo-checking'), [
    { date: '2024-02-29', amountCents: 100, description: 'Donation', reference: '123', type: 'credit' },
  ]);
});
test('E-27 rejects format confusion and does not guess date or column order', () => {
  assert.throws(() => parseUsBankCsv(fixture('us-chase-card.csv'), 'chase-checking'), /Required bank export header/);
  assert.throws(() => parseUsBankCsv(fixture('us-chase-checking.csv'), 'boa-checking'), /Required bank export header/);
  assert.throws(() => parseUsBankCsv('02/28/2024,-1.00,,,Anything', 'wells-fargo-checking'), /Expected five Wells Fargo columns/);
  assert.throws(() => parseUsBankCsv('Date,Description,Amount\n02/28/2024,Foo,1', 'chase-card'), /Required bank export header/);
});
test('E-27 refuses invalid calendar dates, unsafe/precision amounts, and suspicious signs', () => {
  const template = fixture('us-chase-checking.csv');
  for (const badDate of ['02/30/2024', '31/12/2024', '02/29/2026', '2024-02-29', '02/29/24']) {
    assert.throws(() => parseUsBankCsv(template.replace('02/28/2024', badDate), 'chase-checking'), /row 2: (Invalid calendar date|Expected an unambiguous)/);
  }
  for (const badAmount of ['-12.345', '1e5', 'NaN', '0.00', '-0.00', '9,9.00', '900719925474099.99', '9'.repeat(500)]) {
    assert.throws(() => parseUsBankCsv(template.replace('"-1,250.50"', badAmount), 'chase-checking'), /row 2: (Amount|Column count)/);
  }
  assert.throws(() => parseUsBankCsv(template.replace('DEBIT,02/28/2024', 'CREDIT,02/28/2024'), 'chase-checking'), /marker disagrees/);
  assert.throws(() => parseUsBankCsv(template.replace('DEBIT,02/28/2024', 'UNKNOWN,02/28/2024'), 'chase-checking'), /Unknown Chase/);
  assert.throws(() => parseUsBankCsv(template.replace('שכירות Office', ''), 'chase-checking'), /Missing transaction description/);
});
test('E-27 refuses unknown summaries, truncated rows and returns no partial candidates on error', () => {
  const boa = fixture('us-boa-checking.csv');
  assert.throws(() => parseUsBankCsv(boa.replace('Total credits', 'Unknown line'), 'boa-checking'), /Unexpected line/);
  assert.throws(() => parseUsBankCsv(boa.replace('Payroll deposit,"2,000.50"', 'Payroll deposit,'), 'boa-checking'), /row 9: Amount/);
  assert.throws(() => parseUsBankCsv('', 'boa-card'), /Required bank export header/);
  assert.throws(() => parseUsBankCsv('02/28/2024,0.00,*,,Foo', 'wells-fargo-checking'), /zero/);
});
test('E-27 respects size cap and rejects unrecognized layout selector', () => {
  assert.throws(() => parseUsBankCsv('x'.repeat(12_000_001), 'chase-card'), /12 MB/);
  assert.throws(() => parseUsBankCsv('x', 'unknown' as UsBankCsvFormat), /supported US bank/);
});
