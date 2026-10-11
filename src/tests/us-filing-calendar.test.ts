/**
 * A-28: the US state filing calendar. Hand-checked dates: Pennsylvania's May 2026 return falls on
 * Saturday 20 June and moves to Monday 22 June; Texas' April return is due 20 May; California's
 * February (month-end rule) is due 31 March; a quarter ending 31 March in New York is due 20 April;
 * December 2026 in California lands on a Sunday and moves to 1 February 2027. The five no-tax states
 * have no state return at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_STATE_FILING, US_FILING_CALENDAR, US_FILING_CALENDAR_STATES, filingCalendarProblems, filingCalendarRow, filingDueDate, hasNoStateFiling,
} from '../lib/tax/usFilingCalendar';
import { US_STATE_SALES_TAX } from '../lib/tax/usStateSalesTax';

test('one row per rate-table jurisdiction, every row sourced, and the guards find nothing', () => {
  assert.equal(US_FILING_CALENDAR.length, 51);
  assert.deepEqual([...US_FILING_CALENDAR_STATES].sort(), [...US_STATE_SALES_TAX.map(r => r.state)].sort(), 'the same states and DC as the rate table');
  assert.deepEqual(filingCalendarProblems(), []);
  for (const row of US_FILING_CALENDAR) {
    assert.match(row.source, /^https:\/\//, `${row.state} has a source`);
    assert.equal(row.checked, '2026-10-11');
    assert.equal(row.validFrom, '2026-01-01');
  }
  assert.deepEqual(NO_STATE_FILING.sort(), ['AK', 'DE', 'MT', 'NH', 'OR']);
});

test('the due day is the state’s, and a weekend moves to the next Monday', () => {
  assert.equal(filingDueDate('PA', '2026-05-31'), '2026-06-22', 'the 20th is a Saturday, so Monday the 22nd');
  assert.equal(filingDueDate('TX', '2026-04-30'), '2026-05-20');
  assert.equal(filingDueDate('CA', '2026-02-28'), '2026-03-31', 'the state’s month-end rule');
  assert.equal(filingDueDate('NY', '2026-03-31'), '2026-04-20', 'the quarter ending in March');
  assert.equal(filingDueDate('MA', '2026-04-30'), '2026-06-01', 'the 30th is a Saturday, so Monday the 1st');
  assert.equal(filingDueDate('VT', '2026-09-30'), '2026-10-26', 'the 25th is a Sunday, so Monday the 26th');
  assert.equal(filingDueDate('CA', '2026-12-31'), '2027-02-01', 'the last day of January 2027 is a Sunday');
  assert.equal(filingDueDate('OH', '2026-01-31'), '2026-02-23');
});

test('a state with no state tax files nothing, and bad input is answered, not guessed', () => {
  for (const state of NO_STATE_FILING) {
    assert.equal(hasNoStateFiling(state), true);
    assert.equal(filingDueDate(state, '2026-01-31'), undefined);
    assert.deepEqual(filingCalendarRow(state)?.frequencies, []);
  }
  assert.equal(hasNoStateFiling('NY'), false);
  assert.equal(filingDueDate('ZZ', '2026-01-31'), undefined);
  assert.equal(filingDueDate('PA', 'not a date'), undefined);
  assert.equal(filingCalendarRow('pa')?.state, 'PA', 'looked up case-insensitively');
  assert.equal(filingCalendarRow('ZZ'), undefined);
  assert.equal(filingCalendarRow('PA')?.note?.includes('$600'), true, 'Pennsylvania’s bands are on the row');
  assert.deepEqual(filingCalendarRow('TX')?.frequencies, ['quarterly', 'monthly', 'annual']);
});

test('a broken row is reported, not silently kept', () => {
  const good = US_FILING_CALENDAR[0];
  assert.deepEqual(filingCalendarProblems([good]), [`Expected 51 rows (the rate table's states and DC), found 1.`]);
  const problems = filingCalendarProblems([good, { ...good, source: 'http://x.example' }, { ...good, state: 'AK', dueDay: 'none', frequencies: ['monthly'] }]);
  assert.ok(problems.some(p => p.includes('no https source')));
  assert.ok(problems.some(p => p.includes('pays no state tax but lists frequencies')));
});
