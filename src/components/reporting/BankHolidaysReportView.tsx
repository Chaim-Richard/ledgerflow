import React, { useMemo, useState } from 'react';
import { getLocalDateISO } from '../../lib/utils';
import { downloadCsv } from '../../lib/csvExport';
import {
  BANK_CALENDARS, BANK_CALENDAR_IDS, BANK_HOLIDAYS_CSV_HEADERS,
  bankHolidays, bankHolidaysCsvRows, isBankWorkingDay, moveDueDate,
  type BankCalendarId,
} from '../../lib/bankHolidays';
import ReportTableScroll from './ReportTableScroll';

const weekdayText = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const banksText = (kind: 'closed' | 'short-day' | 'note') =>
  kind === 'closed' ? 'Closed' : kind === 'short-day' ? 'Short day' : 'Open (see note)';

/**
 * A-137: bank holiday calendars and the due-date move. The lists are generated from each
 * authority's own rules (see src/lib/bankHolidays.ts for the sources and the limits) and a due
 * date can be checked against the chosen calendar here: it is kept when banks work that day and
 * moved to the next day they do. Reference only — no document's date is changed from this screen.
 */
export default function BankHolidaysReportView() {
  const today = getLocalDateISO();
  const thisYear = Number(today.slice(0, 4));
  const [calendar, setCalendar] = useState<BankCalendarId>('IL');
  const [year, setYear] = useState(thisYear);
  const [dueDate, setDueDate] = useState(today);

  const meta = BANK_CALENDARS[calendar];
  const rows = useMemo(() => bankHolidays(calendar, year), [calendar, year]);
  const moved = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? moveDueDate(calendar, dueDate) : '';
  const working = moved !== '' && isBankWorkingDay(calendar, dueDate);

  return <section aria-label="Bank holidays and due dates" className="p-4 space-y-4 min-w-0">
    <h2>Bank holidays and due dates</h2>
    <p className="text-sm text-[var(--muted)]">
      The days banks are closed in each calendar, generated from the authority&apos;s own rules, and what
      happens to a due date that falls on one: it moves forward to the next day banks work (the
      &quot;following&quot; convention). Check a date below before promising it. Nothing on this screen changes a
      document — it is the reference the move follows.
    </p>

    <div className="flex flex-wrap items-end gap-3" data-print-hide>
      <label className="flex flex-col gap-1 text-sm">Calendar
        <select aria-label="Bank calendar" className="min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)]"
          value={calendar} onChange={e => setCalendar(e.target.value as BankCalendarId)}>
          {BANK_CALENDAR_IDS.map(id => <option key={id} value={id}>{BANK_CALENDARS[id].name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Year
        <select aria-label="Year" className="min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)]"
          value={year} onChange={e => setYear(Number(e.target.value))}>
          {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Due date to check
        <input type="date" aria-label="Due date to check" className="min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)]"
          value={dueDate} onChange={e => setDueDate(e.target.value)} />
      </label>
      <button type="button" className="min-h-11 px-4 rounded border border-[var(--line)]" disabled={!rows.length}
        onClick={() => downloadCsv('bank-holidays', [...BANK_HOLIDAYS_CSV_HEADERS], bankHolidaysCsvRows(calendar, rows))}>Export CSV</button>
    </div>

    {moved && <p className="text-sm" role="status">
      {working
        ? <>Banks work on <b>{weekdayText(dueDate)}</b> in this calendar, so a due date stays {dueDate}.</>
        : <>Banks do not work on <b>{weekdayText(dueDate)}</b> in this calendar. The due date moves to <b>{weekdayText(moved)}</b> ({moved}).</>}
    </p>}
    {!moved && <p role="alert" className="text-sm">Choose a valid due date to check it.</p>}

    <ReportTableScroll>
      <table className="w-full text-sm">
        <caption>{meta.name}: bank holidays in {year}</caption>
        <thead>
          <tr>
            {['Date', 'Day', 'Holiday', 'Banks', 'Note'].map(head =>
              <th key={head} scope="col" className="text-left py-1 px-2">{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${row.date}-${row.name}`} className="border-b border-[var(--line)]/50">
              <th scope="row" className="text-left font-normal py-1 px-2 tabular-nums">{row.date}</th>
              <td className="py-1 px-2">{new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}</td>
              <td className="py-1 px-2">{row.name}{row.nameHe ? <> · <bdi lang="he">{row.nameHe}</bdi></> : null}</td>
              <td className="py-1 px-2">{banksText(row.kind)}</td>
              <td className="py-1 px-2">{row.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="text-sm text-[var(--muted)]">No calendar is generated for {year}.</p>}
    </ReportTableScroll>

    <p className="text-xs text-[var(--muted)]">
      Source: {meta.source.authority} — <a className="underline" href={meta.source.url} target="_blank" rel="noreferrer">{meta.source.url}</a>,
      read {meta.source.retrieved}. {meta.note} A one-off holiday an authority announces (an election, a
      royal occasion) is not generated by any rule: check the authority&apos;s list before relying on a date.
    </p>
  </section>;
}
