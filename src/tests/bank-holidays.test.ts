/**
 * A-137: bank holiday calendars. The generated lists are pinned to the authorities' published
 * 2026–2027 lists (read 2026-10-22):
 * - US: Federal Reserve K.8 / Federal Reserve Bank holiday schedules (2026: Independence Day is a
 *   Saturday, banks open Friday July 3; 2027: it is a Sunday, banks closed Monday July 5).
 * - UK: GOV.UK England and Wales (2026 Boxing Day substitute Monday 28 Dec; 2027 Christmas and
 *   Boxing Day substitutes Mon 27 / Tue 28 Dec).
 * - Israel: Bank of Israel, "Markets Department business days for 2026" — every weekday closure
 *   below is in that PDF, and the two Saturday festivals it omits ("except Saturdays") are here.
 * - TARGET: the ECB's six closing days.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANK_CALENDARS, addBankWorkingDays, bankHolidays, isBankWorkingDay, moveDueDate, nextBankWorkingDay,
} from '../lib/bankHolidays';

const closedOn = (calendar: Parameters<typeof bankHolidays>[0], year: number) =>
  bankHolidays(calendar, year).filter(h => h.kind === 'closed').map(h => h.date);

test('the US closures for 2026 and 2027 are the Federal Reserve list', () => {
  assert.deepEqual(closedOn('US', 2026), [
    '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19',
    '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25',
  ], 'July 4 2026 is a Saturday: no weekday closure');
  assert.deepEqual(closedOn('US', 2027), [
    '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-07-05',
    '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25',
  ], 'July 4 2027 is a Sunday and is observed on Monday July 5; Juneteenth and Christmas are Saturdays');
  assert.equal(isBankWorkingDay('US', '2026-07-03'), true, 'the Friday before a Saturday holiday is a working day at the Banks');
  const note = bankHolidays('US', 2026).find(h => h.date === '2026-07-04')!;
  assert.equal(note.kind, 'note');
  assert.match(note.note || '', /Board of Governors/);
});

test('the England and Wales closures for 2026 and 2027 are the GOV.UK list', () => {
  assert.deepEqual(closedOn('GB-EW', 2026), [
    '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04',
    '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  ]);
  assert.deepEqual(closedOn('GB-EW', 2027), [
    '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03',
    '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
  ]);
});

test('the TARGET closures are the six ECB days, unmoved at weekends', () => {
  assert.deepEqual(closedOn('TARGET', 2026), [
    '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-25', '2026-12-26',
  ]);
});

test('the Israeli closures for 2026 are the Bank of Israel list, Saturdays included', () => {
  assert.deepEqual(closedOn('IL', 2026), [
    '2026-03-03', '2026-03-04', // Purim (Tel Aviv), Shushan Purim (Jerusalem)
    '2026-04-02', '2026-04-08', // Passover first and last days
    '2026-04-22',               // Independence Day (5 Iyar, a Wednesday)
    '2026-05-22',               // Shavuot
    '2026-07-23',               // Fast of the Ninth of Av
    '2026-09-12', '2026-09-13', // Rosh Hashanah (the 12th is a Saturday)
    '2026-09-21',               // Yom Kippur
    '2026-09-26',               // Sukkot (a Saturday)
    '2026-10-03',               // Shemini Atzeret (a Saturday)
  ]);
  const purim2027 = bankHolidays('IL', 2027).filter(h => /Purim/.test(h.name)).map(h => h.date);
  assert.deepEqual(purim2027, ['2027-03-23', '2027-03-24'], '2027 is a leap year: Purim is in the second Adar');
  assert.equal(isBankWorkingDay('IL', '2026-04-03'), true, 'an intermediate day of Passover is a short working day, not a closure');
  assert.equal(isBankWorkingDay('IL', '2026-10-23'), true, 'Friday is a working day in Israel');
  assert.equal(isBankWorkingDay('IL', '2026-10-24'), false, 'Saturday is not');
});

test('due dates move forward to the next day banks work, and only then', () => {
  assert.equal(moveDueDate('US', '2026-07-04'), '2026-07-06', 'Saturday → Monday');
  assert.equal(moveDueDate('US', '2026-07-06'), '2026-07-06', 'a working day is kept as it is');
  assert.equal(moveDueDate('IL', '2026-09-12'), '2026-09-14', 'Saturday, then the second day of Rosh Hashanah on Sunday');
  assert.equal(moveDueDate('GB-EW', '2026-12-26'), '2026-12-29', 'Saturday, Sunday, then the substitute Boxing Day on Monday');
  assert.equal(nextBankWorkingDay('TARGET', '2026-12-25'), '2026-12-28', 'Christmas (Fri), Boxing Day (Sat), Sunday — TARGET gives no substitute Monday, so Monday 28 works');
  assert.equal(addBankWorkingDays('US', '2026-11-25', 1), '2026-11-27', 'Thanksgiving is skipped');
  assert.equal(addBankWorkingDays('US', '2026-11-27', -1), '2026-11-25', 'and back again');
  assert.equal(moveDueDate('US', ''), '', 'a value that is not a date is returned unchanged');
});

test('every calendar names its authority and the day the rules were read', () => {
  for (const calendar of Object.values(BANK_CALENDARS)) {
    assert.ok(calendar.source.authority.length > 5, calendar.id);
    assert.match(calendar.source.url, /^https:\/\//);
    assert.equal(calendar.source.retrieved, '2026-10-22');
  }
  assert.deepEqual(bankHolidays('US', 1999), [], 'outside the supported years nothing is generated');
});
