/** Focused audit evidence, not financial posting acceptance. See docs/verification/ai3-calendar-scope-audit-2026-10-27.md. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysYMD, addMonthsYMD, civilDateParts, dayNumber, daysInMonth,
  fromDayNumber, isLeapYear, weekdayYMD,
} from '../lib/calendarDate';
import { resolveStatementScope, statementRows } from '../lib/statementScope';

const DAY_MS = 86_400_000;

test('audit: two Gregorian cycles (1600–2399) agree with an independent UTC Date oracle', () => {
  // UTC is used only by the oracle: the production implementation is integer civil arithmetic.
  const end = Date.UTC(2400, 0, 1);
  let inspected = 0;
  for (let ms = Date.UTC(1600, 0, 1); ms < end; ms += DAY_MS) {
    const oracle = new Date(ms);
    const ymd = oracle.toISOString().slice(0, 10);
    assert.equal(dayNumber(ymd), ms / DAY_MS, ymd);
    assert.equal(fromDayNumber(ms / DAY_MS), ymd, ymd);
    assert.equal(weekdayYMD(ymd), oracle.getUTCDay(), ymd);
    assert.deepEqual(civilDateParts(ymd), {
      year: oracle.getUTCFullYear(), month: oracle.getUTCMonth() + 1, day: oracle.getUTCDate(),
    });
    inspected++;
  }
  assert.equal(inspected, 292_194);
});

test('audit: Gregorian century rules and every month length across two cycles', () => {
  for (let year = 1600; year < 2400; year++) {
    const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
    assert.equal(isLeapYear(year), leap, String(year));
    for (let month = 1; month <= 12; month++) {
      assert.equal(daysInMonth(year, month), new Date(Date.UTC(year, month, 0)).getUTCDate());
    }
  }
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(2100), false);
});

test('audit: strict civil parser rejects malformed, timestamp and impossible dates', () => {
  for (const value of ['', ' ', '2026-00-01', '2026-13-01', '2026-01-00', '2026-01-32',
    '2026-04-31', '1900-02-29', '2100-02-29', '2026-02-29', '2026-02-30',
    '2026-10-27T00:00:00Z', '27/10/2026', '26-10-27', '2026-1-1extra']) {
    assert.equal(civilDateParts(value), null, JSON.stringify(value));
  }
  assert.deepEqual(civilDateParts(' 2024-2-29 '), { year: 2024, month: 2, day: 29 });
});

test('audit: negative epoch, leap day, year rollover and both DST boundaries preserve civil days', () => {
  const cases: Array<[string, number, string]> = [
    ['1969-12-31', 1, '1970-01-01'], ['1970-01-01', -1, '1969-12-31'],
    ['2000-02-28', 2, '2000-03-01'], ['1900-02-28', 1, '1900-03-01'],
    ['2026-12-31', 1, '2027-01-01'], ['2026-01-01', -1, '2025-12-31'],
    ['2026-03-07', 2, '2026-03-09'], ['2026-10-31', 2, '2026-11-02'],
  ];
  for (const [start, delta, expected] of cases) {
    assert.equal(addDaysYMD(start, delta), expected);
    assert.equal(addDaysYMD(expected, -delta), start);
  }
});

test('audit: month arithmetic clamps independently, with explicit recurring anchor recovery', () => {
  const cases: Array<[string, number, string]> = [
    ['2024-01-31', 1, '2024-02-29'], ['2026-01-31', 1, '2026-02-28'],
    ['2026-03-31', -1, '2026-02-28'], ['2024-02-29', 12, '2025-02-28'],
    ['2026-12-31', 2, '2027-02-28'], ['2026-01-31', -13, '2024-12-31'],
  ];
  for (const [start, delta, expected] of cases) assert.equal(addMonthsYMD(start, delta), expected);
  assert.equal(addMonthsYMD('2026-02-28', 1, 31), '2026-03-31');
  assert.equal(addMonthsYMD('2026-02-28', 1), '2026-03-28');
});

test('audit: statement defaults, leap days, same-day periods and backwards periods', () => {
  assert.deepEqual(resolveStatementScope({}, '2026-10-27'), {
    scope: { startDate: '2026-01-01', endDate: '2026-10-27' },
  });
  assert.deepEqual(resolveStatementScope({ startDate: '2024-02-29', endDate: '2024-02-29' }, '2026-10-27'), {
    scope: { startDate: '2024-02-29', endDate: '2024-02-29' },
  });
  assert.deepEqual(resolveStatementScope({ startDate: '2026-10-28' }, '2026-10-27'), {
    error: 'The statement period starts after it ends',
  });
});

test('audit: statement validator rejects type confusion without throwing', () => {
  for (const value of [42, false, {}, [], 'not-a-date', '2026-02-30', '1900-02-29']) {
    for (const field of ['startDate', 'endDate']) {
      assert.deepEqual(resolveStatementScope({ [field]: value }, '2026-10-27'), {
        error: 'Statement dates are YYYY-MM-DD',
      });
    }
  }
});

test('audit DEFECT reproduction: out-of-range statement dates throw instead of returning validation error', () => {
  // This characterizes a defect, NOT the desired contract. Keep it explicit until AI #1 fixes
  // the shared screen/server helper; then replace these throws with validation-error assertions.
  for (const value of ['2026-13-01', '2026-00-01', '2026-01-32', '2026-01-00']) {
    for (const field of ['startDate', 'endDate']) {
      assert.throws(() => resolveStatementScope({ [field]: value }, '2026-10-27'), RangeError);
    }
  }
});

test('audit: printed opening row and negative balance are preserved without input mutation', () => {
  const entry = Object.freeze({ date: '2026-10-27', type: 'Payment', reference: 'PAY-1', amountCents: -200, runningBalanceCents: -100 });
  const entries = [entry];
  Object.freeze(entries);
  const input = Object.freeze({ startDate: '2026-10-01', openingBalanceCents: 100, entries });
  assert.deepEqual(statementRows(input), [
    { date: '2026-10-01', type: 'Opening balance', reference: '', amountCents: 100, runningBalanceCents: 100 }, entry,
  ]);
  assert.equal(input.entries[0], entry);
});
