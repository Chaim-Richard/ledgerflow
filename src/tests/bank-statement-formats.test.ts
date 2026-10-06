import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseQIFStatement } from '../lib/qifParser';
import { parseBAI2Statement } from '../lib/bai2Parser';

const sample = (name: string) => readFileSync(new URL(`./fixtures/bank-statements/${name}`, import.meta.url), 'utf8');
const bai = sample('checking.bai2');

test('QIF parses both date orders, signed exact cents, Hebrew and cheque references', () => {
  const expected = [
    { date: '2026-10-05', amountCents: -125050, description: 'שכירות Office - October rent', reference: '1042', type: 'debit' },
    { date: '2026-10-06', amountCents: 25010, description: 'Customer deposit', type: 'credit' },
  ];
  assert.deepEqual(parseQIFStatement(sample('checking-mdy.qif'), 'mdy'), expected);
  assert.deepEqual(parseQIFStatement(sample('checking-dmy.qif'), 'dmy'), expected);
});

test('QIF dates never guess ambiguous day orders; accepts valid leap dates and two-digit years', () => {
  const content = '!Type:Cash\nD02/03/26\nT0.29\nPTest\n^';
  assert.equal(parseQIFStatement(content, 'mdy')[0].date, '2026-02-03');
  assert.equal(parseQIFStatement(content, 'dmy')[0].date, '2026-03-02');
  assert.equal(parseQIFStatement(content.replace('02/03/26', '02/29/2024'), 'mdy')[0].date, '2024-02-29');
  assert.equal(parseQIFStatement(content.replace('02/03/26', '12/31/99'), 'mdy')[0].date, '1999-12-31');
});

test('QIF names bad dates, amounts, missing fields and truncation by line', () => {
  const content = '!Type:Bank\nD02/29/2026\nT12.34\nPTest\n^';
  assert.throws(() => parseQIFStatement(content, 'mdy'), /QIF line 2: Invalid calendar date/);
  for (const amount of ['NaN', '12.345', '1,25.50', '1e3', '900719925474099.99']) {
    assert.throws(() => parseQIFStatement(content.replace('02/29/2026', '02/28/2026').replace('12.34', amount), 'mdy'), /QIF line 3:/);
  }
  assert.throws(() => parseQIFStatement('!Type:Bank\nD10/05/26\n^', 'mdy'), /QIF line 2: Each transaction/);
  assert.throws(() => parseQIFStatement('!Type:Bank\nD10/05/26\nT1', 'mdy'), /QIF line 2: Missing \^/);
  assert.throws(() => parseQIFStatement('date,amount\n10/05/26,1', 'mdy'), /QIF line 1:/);
});

test('QIF refuses unsupported account sections, duplicate fields and disagreeing T/U amounts', () => {
  assert.throws(() => parseQIFStatement('!Type:Invst\nD10/05/26\nT1\n^', 'mdy'), /QIF line 1: Only Bank/);
  assert.throws(() => parseQIFStatement(sample('checking-mdy.qif') + '\n!Type:Bank', 'mdy'), /Export one account/);
  assert.throws(() => parseQIFStatement('!Type:Bank\nD10/05/26\nT1\nT2\n^', 'mdy'), /QIF line 4: Duplicate T/);
  assert.throws(() => parseQIFStatement('!Type:Bank\nD10/05/26\nT1\nU2\n^', 'mdy'), /QIF line 4: T and U amounts disagree/);
});

test('BAI2 debits and credits are detail records only; 88 continues summary and description', () => {
  assert.deepEqual(parseBAI2Statement(bai, 'USD'), [
    { date: '2026-10-05', amountCents: 25050, description: 'Customer payment, Acme תשלום October', reference: 'CUSTOMERREF1', type: 'credit' },
    { date: '2026-10-05', amountCents: -5000, description: 'Office supplies', reference: '1042', type: 'debit' },
  ]);
});

test('BAI2 accepts CRLF, BOM, same-line records and immediate/one-day funds', () => {
  const expected = parseBAI2Statement(bai);
  assert.deepEqual(parseBAI2Statement('\uFEFF' + bai.replace(/\n/g, '\r\n')), expected);
  assert.deepEqual(parseBAI2Statement(bai.replace(/\n/g, '')), expected);
  for (const funds of ['1', '2', '']) assert.deepEqual(parseBAI2Statement(bai.replace('25050,0,', `25050,${funds},`)), expected);
});

test('BAI2 rejects incomplete files, orphan continuations, control totals and record counts by line', () => {
  assert.throws(() => parseBAI2Statement('88,orphan/'), /BAI2 line 1: 88 must continue/);
  assert.throws(() => parseBAI2Statement(bai.replace('49,255100,6', '49,255101,6')), /BAI2 line 8: Account control/);
  assert.throws(() => parseBAI2Statement(bai.replace('49,255100,6', '49,255100,5')), /BAI2 line 8: Account control/);
  assert.throws(() => parseBAI2Statement(bai.replace('98,255100,1,8', '98,255100,1,7')), /BAI2 line 9: Group control/);
  assert.throws(() => parseBAI2Statement(bai.replace('99,255100,1,10', '99,255100,1,9')), /BAI2 line 10: File control/);
  assert.throws(() => parseBAI2Statement(bai.split('\n').slice(0, 7).join('\n')), /Incomplete file/);
  assert.throws(() => parseBAI2Statement(bai.replace('Office supplies/', 'Office supplies')), /BAI2 line 7: Missing/);
});

test('BAI2 refuses invalid dates, amounts, direction, currency and unsupported funds', () => {
  assert.throws(() => parseBAI2Statement(bai.replace('1,261005,1200,USD', '1,260230,1200,USD')), /BAI2 line 2: Invalid group calendar/);
  assert.throws(() => parseBAI2Statement(bai.replace('195,25050', '195,-25050')), /BAI2 line 5: Transaction amount/);
  assert.throws(() => parseBAI2Statement(bai.replace('195,25050', '195,250.50')), /BAI2 line 5: Invalid transaction amount/);
  assert.throws(() => parseBAI2Statement(bai.replace('195,25050', '999,25050')), /BAI2 line 5: Unsupported transaction type/);
  assert.throws(() => parseBAI2Statement(bai, 'EUR'), /BAI2 line 3: Statement currency USD differs/);
  assert.throws(() => parseBAI2Statement(bai.replace('123456789,USD', '123456789,JPY')), /BAI2 line 3: Unsupported account currency/);
  assert.throws(() => parseBAI2Statement(bai.replace('25050,0,', '25050,X,')), /BAI2 line 5: Unsupported funds type/);
});

test('BAI2 handles distributed/value-dated funds and optional final summary fields', () => {
  const expected = parseBAI2Statement(bai);
  assert.deepEqual(parseBAI2Statement(bai.replace('25050,0,', '25050,D,2,0,20000,1,5050,')), expected);
  assert.deepEqual(parseBAI2Statement(bai.replace('25050,0,', '25050,V,261005,1200,')), expected);
  assert.deepEqual(parseBAI2Statement(bai.replace('015,125050,,,/', '015,125050,,/')), expected);
  assert.deepEqual(parseBAI2Statement(bai.replace('015,125050,,,/', '015,125050,,S,125050,0,0/')), expected);
  assert.throws(() => parseBAI2Statement(bai.replace('25050,0,', '25050,D,2,0,20000,')), /BAI2 line 5: Invalid funds/);
});

test('BAI2 never merges two source accounts or accepts records after a file trailer', () => {
  assert.throws(() => parseBAI2Statement(bai.replace('98,255100,1,8/', '03,OTHER,USD,010,1,,,/\n98,255100,1,8/')), /BAI2 line 9: Export one account/);
  assert.throws(() => parseBAI2Statement(bai + '16,195,1,0,,,Extra/'), /Transaction outside an account/);
});
