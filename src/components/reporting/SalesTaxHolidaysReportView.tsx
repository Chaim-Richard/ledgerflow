import React, { useMemo, useState } from 'react';
import { getLocalDateISO } from '../../lib/utils';
import { downloadCsv } from '../../lib/csvExport';
import {
  HOLIDAY_CSV_HEADERS, bandCapWords, holidayCsvRows, holidayItemAnswer, holidayRowsInForce, holidayStates,
  US_SALES_TAX_HOLIDAYS, type HolidayBand,
} from '../../lib/tax/usSalesTaxHolidays';
import ReportTableScroll from './ReportTableScroll';

const field = 'min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)]';

const capWords = bandCapWords;

/**
 * A-58: US state sales tax holidays. The dated windows, the categories each one covers and the
 * per-item sales-price cap it sets, every row from the state's own page. The checker answers the
 * table's own question — is an item at this price inside a band's cap on this date? — and says
 * plainly that the source's qualifying-item list governs which items a band covers. Read-only:
 * nothing here posts, files, or changes the tax the engine computes, and a window this table does
 * not state is never assumed absent (the rule pack lists those as rows to add).
 */
export default function SalesTaxHolidaysReportView({ today = '' }: { today?: string }) {
  const [asOf, setAsOf] = useState(today || getLocalDateISO());
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [checkState, setCheckState] = useState<string>('TX');
  const [checkBand, setCheckBand] = useState<string>('clothing-footwear');
  const [checkPrice, setCheckPrice] = useState<string>('45.00');

  const rows = useMemo(() => (
    US_SALES_TAX_HOLIDAYS
      .filter(row => stateFilter === 'all' || row.state === stateFilter)
      .slice()
      .sort((a, b) => b.from.localeCompare(a.from) || a.state.localeCompare(b.state))
  ), [stateFilter]);

  const inForce = useMemo(() => holidayRowsInForce(checkState, asOf), [checkState, asOf]);
  const checkBands = useMemo(() => {
    const bands: HolidayBand[] = [];
    for (const row of inForce) for (const band of row.bands) if (!bands.some(b => b.id === band.id)) bands.push(band);
    return bands;
  }, [inForce]);
  const priceCents = Math.round(Number(checkPrice || '0') * 100);
  const answer = Number.isFinite(priceCents) && priceCents >= 0
    ? holidayItemAnswer(checkState, asOf, checkBand, priceCents)
    : null;

  return <section aria-label="Sales tax holidays" className="p-4 space-y-4 min-w-0">
    <h2>Sales tax holidays</h2>
    <p className="text-sm text-[var(--muted)]">
      The dated windows in which US states stop taxing qualifying items, with each window's categories and its per-item
      price cap, every row from the state's own publication. A cap is on the item's sales price — both states count
      delivery, shipping and handling in it — and the source's qualifying-item list decides item by item what a band
      covers. Read-only: nothing here posts or files, and a holiday this table does not list is one it does not state,
      never a statement that no holiday exists.
    </p>

    <div className="flex flex-wrap items-end gap-3" data-print-hide>
      <label className="flex flex-col gap-1">As of
        <input aria-label="Holiday checker date" type="date" className={field} value={asOf} onChange={event => setAsOf(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1">State
        <select aria-label="Holiday state filter" className={field} value={stateFilter} onChange={event => setStateFilter(event.target.value)}>
          <option value="all">All states in this table</option>
          {holidayStates().map(entry => <option key={entry.state} value={entry.state}>{entry.stateName} ({entry.state})</option>)}
        </select>
      </label>
      <button type="button" className="btn-secondary min-h-11 px-3" disabled={!rows.length} onClick={() => downloadCsv(
        `sales-tax-holidays.csv`, HOLIDAY_CSV_HEADERS, holidayCsvRows(rows),
      )}>Export CSV</button>
    </div>

    <h3>What is in force on {asOf}</h3>
    {inForce.length === 0
      ? <p>No holiday from this table is in force in {checkState} on {asOf}.</p>
      : <p className="text-sm" data-testid="holiday-in-force">{inForce.map(row => (
          <span key={row.id} className="inline-block mr-4"><b>{row.name}</b> ({row.stateName}, {row.from} to {row.to})
            {' — '}{row.bands.map(band => `${band.label.split(' (')[0]} ${capWords(band)}`).join(' · ')}</span>
        ))}</p>}

    <div className="flex flex-wrap items-end gap-3" data-print-hide>
      <label className="flex flex-col gap-1">Checker state
        <select aria-label="Checker state" className={field} value={checkState} onChange={event => {
          setCheckState(event.target.value);
          const first = holidayRowsInForce(event.target.value, asOf)[0]?.bands[0];
          if (first) setCheckBand(first.id);
        }}>
          {holidayStates().map(entry => <option key={entry.state} value={entry.state}>{entry.stateName} ({entry.state})</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Item band
        <select aria-label="Checker band" className={field} value={checkBand} onChange={event => setCheckBand(event.target.value)} disabled={!checkBands.length}>
          {checkBands.length === 0 && <option value="">No band — no holiday in force</option>}
          {checkBands.map(band => <option key={band.id} value={band.id}>{band.label.split(' (')[0]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Item sales price (major units)
        <input aria-label="Checker price" type="number" min="0" step="0.01" className={field} value={checkPrice} onChange={event => setCheckPrice(event.target.value)} />
      </label>
    </div>
    {answer && <p role="status" className="text-sm" data-testid="holiday-answer">
      {answer.state === 'within-cap' && <b>Within the cap. </b>}
      {answer.state === 'over-cap' && <b>Over the cap. </b>}
      {answer.because}
    </p>}
    {!answer && <p role="alert">Give a price of 0 or more to check a band's cap.</p>}

    <h3>The calendar this table states</h3>
    <ReportTableScroll><table className="w-full text-sm">
      <caption>Sales tax holiday windows with their item bands and per-item price caps</caption>
      <thead><tr>
        <th scope="col">State</th><th scope="col">Holiday</th><th scope="col">Window</th>
        <th scope="col">What is covered (the source's list governs)</th>
        <th scope="col" className="text-right">Per-item cap</th><th scope="col">Source</th>
      </tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t border-[var(--line)] align-top">
        <th scope="row" className="text-left">{row.stateName} ({row.state})</th>
        <td><bdi>{row.name}</bdi><div className="text-xs text-[var(--muted)]"><bdi>{row.note}</bdi></div></td>
        <td className="tabular-nums whitespace-nowrap">{row.from} → {row.to}</td>
        <td><ul className="list-disc ps-4">{row.bands.map(band => <li key={band.id}>
          {band.label} — <b>{capWords(band)}</b>{band.note ? <span className="text-xs text-[var(--muted)]"> ({band.note})</span> : null}
        </li>)}</ul></td>
        <td className="text-right tabular-nums">{row.bands.map(band => <div key={band.id}>{(band.capCents / 100).toFixed(2)}</div>)}</td>
        <td className="text-xs"><a href={row.source.url} target="_blank" rel="noopener noreferrer" className="underline">{row.source.authority}</a><div className="text-[var(--muted)]">checked {row.checked}</div></td>
      </tr>)}</tbody>
    </table></ReportTableScroll>

    <p className="text-xs text-[var(--muted)]">
      Windows not stated here (Texas' water-efficient products holiday, Florida's disaster-preparedness and
      hunting/fishing/camping windows, and every other state's holidays) are listed as rows to add in the tax rule
      pack — never assumed absent.
    </p>
  </section>;
}
