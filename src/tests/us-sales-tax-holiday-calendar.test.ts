import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOLIDAY_CALENDAR_CSV_HEADERS, US_SALES_TAX_HOLIDAY_CALENDAR, holidayCalendarCsvRows, holidayCalendarMonthsForYear,
  holidayCalendarRowsForYear, holidayCalendarRowsOn, holidayCalendarStatesForYear, holidayCalendarYears,
  nextHolidayWindow, usSalesTaxHolidayCalendarProblems,
} from '../lib/tax/usSalesTaxHolidayCalendar';
import { US_SALES_TAX_HOLIDAYS } from '../lib/tax/usSalesTaxHolidays';
import { usSalesTaxHolidayPack } from '../lib/rules/packs/usSalesTaxHolidayPack';

/**
 * A-109: the calendar of US sales-tax holidays — which states run a window and when, for every state
 * that has one, with the state's own page beside each row.
 *
 * The three checks that matter are not the dates themselves (the sources carry those): a window that is
 * only dated must never be read as a taxability rule, the calendar and A-58's rule table must not drift
 * apart on a window they both state, and a reduced-rate window must not be recorded as an exemption.
 */
describe('US sales-tax holiday calendar (A-109)', () => {
  it('is structured, sourced, and holds its anchor windows', () => {
    assert.deepEqual(usSalesTaxHolidayCalendarProblems(), []);
    assert.ok(US_SALES_TAX_HOLIDAY_CALENDAR.length >= 30, 'a calendar that stops at two states is not a calendar');
    assert.deepEqual(holidayCalendarYears(), [2025, 2026, 2027].filter(y => holidayCalendarRowsForYear(y).length > 0));
    for (const row of US_SALES_TAX_HOLIDAY_CALENDAR) {
      assert.ok(row.source.url.startsWith('https://'), `${row.id}: source must be https`);
      assert.ok(row.source.retrieved >= '2026-01-01', `${row.id}: the source needs a recent read date`);
      // a commercial aggregator is never the only thing a row rests on: either the state's page is
      // linked beside it, or the row says in its note that no link was published.
      if (!row.statePageUrl) assert.match(row.note ?? '', /without a link|no state page/i, `${row.id}: no state page and no note saying so`);
    }
  });

  it('shares its dates with the rule table wherever the two state the same window', () => {
    // this is the drift check: the calendar exists so the pack's "rows still to add" list and the
    // screen cannot disagree with the rules about WHEN a state's holiday runs.
    const drift: string[] = [];
    for (const rule of US_SALES_TAX_HOLIDAYS) {
      const cal = US_SALES_TAX_HOLIDAY_CALENDAR.find(r => r.id === rule.id);
      if (!cal) continue;
      if (cal.from !== rule.from || cal.to !== rule.to) {
        drift.push(`${rule.id}: rule table ${rule.from}→${rule.to}, calendar ${cal.from}→${cal.to}`);
      }
    }
    assert.deepEqual(drift, []);
    // and every rule-table window in a year the calendar covers must be dated there too, so the
    // calendar can never quietly lose a state that already has rules.
    for (const rule of US_SALES_TAX_HOLIDAYS) {
      const year = Number(rule.from.slice(0, 4));
      if (!holidayCalendarYears().includes(year)) continue;
      assert.ok(US_SALES_TAX_HOLIDAY_CALENDAR.some(r => r.id === rule.id), `${rule.id}: a rule with no calendar row`);
    }
    assert.ok(US_SALES_TAX_HOLIDAY_CALENDAR.some(r => r.id === 'tx-back-to-school-2026'));
    assert.ok(US_SALES_TAX_HOLIDAY_CALENDAR.some(r => r.id === 'fl-back-to-school-2026'));
  });

  it('never becomes a rule, so a dated window cannot exempt an entire state', () => {
    const pack = usSalesTaxHolidayPack();
    const ruleIds = new Set(pack.rules.map(rule => rule.id));
    const stated = new Set(US_SALES_TAX_HOLIDAYS.map(r => r.id));
    const invented: string[] = [];
    for (const row of US_SALES_TAX_HOLIDAY_CALENDAR) {
      if (stated.has(row.id)) continue; // A-58 states this window's items, so a rule may exist
      if (ruleIds.has(`us-holiday-${row.id}`)) invented.push(row.id);
    }
    assert.deepEqual(invented, []);
    // A-109 changed no rule: the pack still makes exactly one rule per window A-58 states (5 today),
    // and the 30 calendar-only windows make none.
    assert.equal(pack.rules.length, US_SALES_TAX_HOLIDAYS.length);
    assert.equal(pack.rules.length, 5);
    assert.equal(stated.size, 5);
    assert.equal(US_SALES_TAX_HOLIDAY_CALENDAR.filter(r => !stated.has(r.id)).length, 30, '33 windows dated, 3 of them also ruled (TX 2026 twice, FL 2026); the 2025 rows are not in the calendar because the 2025 compilation was not read');
  });

  it('records a rate cut as a rate cut, not as tax-free', () => {
    const kinds = new Map(US_SALES_TAX_HOLIDAY_CALENDAR.map(r => [r.id, r.kind]));
    assert.equal(kinds.get('il-back-to-school-2026'), 'reduced-rate');
    assert.equal(kinds.get('ak-skagway-seasonal-2026-27'), 'reduced-rate');
    assert.equal(kinds.get('nv-national-guard-2026'), 'restricted-purchaser');
    assert.equal(kinds.get('va-sales-tax-holiday-2026'), 'exempt');
    const il = US_SALES_TAX_HOLIDAY_CALENDAR.find(r => r.id === 'il-back-to-school-2026');
    assert.match(il?.note ?? '', /1\.25%/u, 'the Illinois note has to say the rate it keeps');
    assert.match(il?.note ?? '', /under-collects/u, 'and the consequence of getting it wrong');
    // the row Virginia's own page settles, because a popular commercial calendar has it a week early
    const va = US_SALES_TAX_HOLIDAY_CALENDAR.find(r => r.id === 'va-sales-tax-holiday-2026');
    assert.equal(va?.statePageRead, true);
    assert.equal(va?.source.url, va?.statePageUrl);
    assert.match(va?.note ?? '', /August 1-3/u);
  });

  it('answers the planner\'s questions: this year, this day, and what comes next', () => {
    const year2026 = holidayCalendarRowsForYear(2026);
    assert.equal(year2026.length, 32);
    assert.equal(holidayCalendarStatesForYear(2026).length, 22, 'the states that run something in 2026');
    assert.deepEqual(holidayCalendarStatesForYear(2026).find(s => s.state === 'TX'), { state: 'TX', stateName: 'Texas', windows: 4 });
    // the August weekend most of them share
    const saturation = holidayCalendarRowsOn('2026-08-08').map(r => r.state);
    assert.deepEqual(saturation, ['FL', 'IL', 'IA', 'MO', 'OH', 'OK', 'SC', 'TX', 'VA', 'MA']);
    assert.equal(nextHolidayWindow('2026-10-20')?.id, 'nv-national-guard-2026');
    assert.equal(nextHolidayWindow('2026-11-02')?.id, 'nm-small-business-saturday-2026');
    // a window is listed under the month it starts in, once, even when it runs into the next month
    const months = holidayCalendarMonthsForYear(2026);
    assert.deepEqual(months.map(m => m.month), ['2026-02', '2026-04', '2026-05', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    assert.ok(months.find(m => m.month === '2026-07')?.rows.some(r => r.id === 'fl-back-to-school-2026'));
    assert.ok(!months.find(m => m.month === '2026-08')?.rows.some(r => r.id === 'fl-back-to-school-2026'), 'Florida listed once, in its start month');
    // and 2027 is mostly not dated yet, which the table says rather than leaving blank
    assert.equal(holidayCalendarRowsForYear(2027).length, 2);
    assert.match(holidayCalendarCsvRows().join('|'), /Saturday after Thanksgiving/u);
  });

  it('exports the calendar as a file with its own columns', () => {
    const rows = holidayCalendarCsvRows();
    assert.equal(HOLIDAY_CALENDAR_CSV_HEADERS.length, 11);
    assert.equal(rows.length, US_SALES_TAX_HOLIDAY_CALENDAR.length);
    for (const r of rows) {
      assert.equal(r.length, HOLIDAY_CALENDAR_CSV_HEADERS.length);
      assert.ok(r.filter(c => !c).length <= 3, 'a calendar row must carry state, name, dates, kind, source and read date');
    }
  });
});
