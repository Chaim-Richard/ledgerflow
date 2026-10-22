import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isIsraeliSummaryRow, israeliAmountCents, readIsraeliBankCsv } from '../lib/israeliBankCsv';

/**
 * E-26 / E-43 worked figures, read off the fixtures by hand:
 *
 * il-debit-credit.csv (Hebrew headers, debit and credit columns)
 *   01/02/2024  rent        debit 1,250.50  → -125050
 *   05/02/2024  customer    credit 2,000.10 →  200010
 *   29/02/2024  bank fee    debit    12.00  →   -1200
 *   "יתרת סגירה" is a closing-balance line and is skipped, never imported.
 *
 * il-signed-amount.csv (value date, one signed amount column)
 *   31/01/2024  cheque 42   (500.00)  → -50000
 *   01/02/2024  cash        ₪1,000.00 → 100000
 *
 * il-english-headers.csv (English headers, MM/DD order chosen)
 *   02/01/2024  rent 300.00 debit → -30000 ; 02/02/2024 credit 1,200.00 → 120000
 */
const fixture = (name: string) => readFileSync(new URL('./fixtures/bank-statements/' + name, import.meta.url), 'utf8');

test('E-26 debit and credit columns: Hebrew headers, shekel signs, a closing-balance line skipped', () => {
  const result = readIsraeliBankCsv(fixture('il-debit-credit.csv'), 'dmy');
  assert.deepEqual(result.lines, [
    { date: '2024-02-01', amountCents: -125050, description: 'העברה לספק שכירות', reference: '1001', type: 'debit' },
    { date: '2024-02-05', amountCents: 200010, description: 'תקבול מלקוח בע"מ', reference: '1002', type: 'credit' },
    { date: '2024-02-29', amountCents: -1200, description: 'עמלת בנק', reference: '1003', type: 'debit' },
  ]);
  assert.equal(result.columns.shape, 'debit-credit');
  assert.equal(result.columns.date, 'תאריך');
  assert.equal(result.columns.description, 'תיאור');
  assert.equal(result.columns.reference, 'אסמכתא');
  assert.equal(result.columns.debit, 'חובה');
  assert.equal(result.columns.credit, 'זכות');
  assert.equal(result.columns.balance, 'יתרה');
});

test('E-26 one signed amount column: parentheses are negative, a shekel prefix is stripped', () => {
  const result = readIsraeliBankCsv(fixture('il-signed-amount.csv'), 'dmy');
  assert.deepEqual(result.lines, [
    { date: '2024-01-31', amountCents: -50000, description: 'המחאה מס\' 42', reference: '42', type: 'debit' },
    { date: '2024-02-01', amountCents: 100000, description: 'הפקדת מזומן', type: 'credit' },
  ]);
  assert.equal(result.columns.shape, 'signed-amount');
  assert.equal(result.columns.amount, 'סכום');
  assert.equal(result.columns.date, 'תאריך ערך');
});

test('E-26 the date order is the user\'s: the same file reads differently under day/month and month/day', () => {
  const dmy = readIsraeliBankCsv(fixture('il-english-headers.csv'), 'dmy');
  const mdy = readIsraeliBankCsv(fixture('il-english-headers.csv'), 'mdy');
  assert.deepEqual(dmy.lines.map(line => line.date), ['2024-01-02', '2024-02-02']);
  assert.deepEqual(mdy.lines.map(line => line.date), ['2024-02-01', '2024-02-02']);
  // 13/02 can only be a day, so the day/month reading works and the month/day reading is refused.
  assert.deepEqual(readIsraeliBankCsv(fixture('il-ambiguous-month.csv'), 'dmy').lines.map(line => line.date), ['2024-02-13', '2024-03-05']);
  assert.throws(() => readIsraeliBankCsv(fixture('il-ambiguous-month.csv'), 'mdy'), /row 2: Date 13\/02\/2024 is not a real date/);
});

test('E-26 money cells: shekels, thousands separators, signs and refusals', () => {
  assert.equal(israeliAmountCents('1,234.56'), 123456);
  assert.equal(israeliAmountCents('₪1,234.56'), 123456);
  assert.equal(israeliAmountCents('1234.56-'), -123456);
  assert.equal(israeliAmountCents('(1,234.56)'), -123456);
  assert.equal(israeliAmountCents('-1,234.56'), -123456);
  assert.equal(israeliAmountCents('ש"ח 1,000'), 100000);
  assert.equal(israeliAmountCents(''), 0);
  for (const bad of ['12.345', '1e5', 'abc', '1,23.00', '9'.repeat(20)]) {
    assert.throws(() => israeliAmountCents(bad, 3), /row 3: Amount/);
  }
});

test('E-26 refuses ambiguous direction, totals as transactions, and unusable dates', () => {
  const row = (extra: string) => `תאריך,תיאור,חובה,זכות\n${extra}`;
  assert.throws(() => readIsraeliBankCsv(row('01/02/2024,שתי עמודות,10.00,20.00'), 'dmy'), /Both a debit and a credit/);
  assert.throws(() => readIsraeliBankCsv(row('01/02/2024,ריק,,'), 'dmy'), /Neither a debit nor a credit/);
  assert.throws(() => readIsraeliBankCsv(row('01/02/2024,שלילי,-10.00,'), 'dmy'), /debit must be a positive/);
  assert.throws(() => readIsraeliBankCsv(row('01/02/2024,סה"כ חודש,10.00,'), 'dmy'), /looks like a total or balance line/);
  assert.throws(() => readIsraeliBankCsv(row('01/02/24,תאריך קצר,10.00,'), 'dmy'), /four-digit year/);
  assert.throws(() => readIsraeliBankCsv(row('31/02/2024,תאריך שגוי,10.00,'), 'dmy'), /not a real date/);
  assert.throws(() => readIsraeliBankCsv(row('01/02/2024,,10.00,'), 'dmy'), /Missing transaction description/);
  assert.throws(() => readIsraeliBankCsv(row(',תיאור בלי תאריך,10.00,'), 'dmy'), /No date on a row/);
  assert.throws(() => readIsraeliBankCsv(fixture('il-debit-credit.csv'), 'ymd' as never), /Choose the statement date order/);
});

test('E-26 a file without the needed columns is refused, never guessed', () => {
  assert.throws(() => readIsraeliBankCsv('שם,כתובת\nא,ב', 'dmy'), /No date column/);
  assert.throws(() => readIsraeliBankCsv('תאריך,כתובת\n01/02/2024,ב', 'dmy'), /No description column/);
  assert.throws(() => readIsraeliBankCsv('תאריך,תיאור,יתרה\n01/02/2024,ב,100.00', 'dmy'), /Need either debit and credit columns, or one amount column/);
  assert.throws(() => readIsraeliBankCsv('תאריך,תיאור,חובה,זכות,סכום\n01/02/2024,ב,10.00,,10.00', 'dmy'), /ambiguous/);
  assert.throws(() => readIsraeliBankCsv('תאריך,תיאור,חובה,זכות\n', 'dmy'), /no transaction rows/);
  assert.throws(() => readIsraeliBankCsv('תאריך,תיאור,חובה,זכות\n,יתרת סגירה,,', 'dmy'), /No transactions found/);
});

test('E-26 summary vocabulary covers Hebrew and English balance lines', () => {
  for (const text of ['יתרת סגירה', 'יתרת פתיחה', 'סה"כ', 'סך הכל לתקופה', 'Total', 'Closing balance', 'Balance carried forward']) {
    assert.equal(isIsraeliSummaryRow(text), true, text);
  }
  for (const text of ['העברה לספק', 'תקבול מלקוח', 'Bank fee', 'יתרון']) {
    assert.equal(isIsraeliSummaryRow(text), false, text);
  }
});
