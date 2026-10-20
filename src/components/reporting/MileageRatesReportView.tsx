import { formatCurrency } from '../../lib/utils';
import React, { useState } from 'react';
import { US_MILEAGE_RATES, mileageRateOn } from '../../lib/tax/usMileageRates';
import { downloadCsv } from '../../lib/csvExport';
import ReportTableScroll from './ReportTableScroll';

const CSV_HEADERS = ['Valid from', 'Valid to', 'Cents per mile', 'Rate per mile', 'Source', 'Note'];

function rowsToCsv(rows: typeof US_MILEAGE_RATES) {
  return rows.map(r => [r.validFrom, r.validTo || '', String(r.rateCentsPerMile), formatCurrency(r.rateCentsPerMile, 'USD'), r.source.url, r.note || '']);
}

/**
 * A-108: US standard mileage rates by year (IRS) — read-only reference table.
 * Nothing posts, files or pays; a mileage claim still records the rate the person typed.
 */
export default function MileageRatesReportView() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const active = mileageRateOn(date);
  return (
    <section aria-label="US mileage rates" className="p-4 space-y-4 min-w-0">
      <h2>US standard mileage rates (business)</h2>
      <p className="text-sm text-[var(--muted)]">
        The IRS business standard mileage rate that was in force on a date. This table is a dated reference
        from <a className="underline" href="https://www.irs.gov/tax-professionals/standard-mileage-rates">IRS standard mileage rates</a>.
        An expense claim still records the rate the person typed; the rate shown here is a suggestion only.
        2022 had a mid-year increase; 2026 is provisional until the 2026 IRS Notice is checked.
        Nothing here posts, files or calculates tax — it is calculation status only.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Check a date
          <input aria-label="Check date" type="date" value={date} onChange={e => setDate(e.target.value)} className="min-h-11 border rounded px-3 bg-[var(--panel)]" />
        </label>
        <p className="text-sm py-2">
          In force on {date}: <b>{active ? `${formatCurrency(active.rateCentsPerMile, 'USD')}/mi (${active.rateThousandths/1000}/mi)` : 'No row covers that date'}</b>
          {active?.note ? ` — ${active.note}` : ''}
        </p>
        <button type="button" className="min-h-11 px-4 rounded border border-[var(--line)]" onClick={() => downloadCsv('us-mileage-rates', CSV_HEADERS, rowsToCsv(US_MILEAGE_RATES))}>Export CSV</button>
      </div>

      <ReportTableScroll>
        <table className="w-full text-sm">
          <caption className="text-left font-semibold pb-1">IRS business standard mileage rates, dated</caption>
          <thead><tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
            {['Valid from', 'Valid to', 'Rate', 'Cents per mile', 'Source', 'Note'].map(h => <th key={h} scope="col" className="text-left py-1 px-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {US_MILEAGE_RATES.map(r => (
              <tr key={r.validFrom} className="border-b border-[var(--line)]/50">
                <td className="py-1 px-2 whitespace-nowrap">{r.validFrom}</td>
                <td className="py-1 px-2 whitespace-nowrap">{r.validTo || '—'}</td>
                <td className="py-1 px-2 tabular-nums">{formatCurrency(r.rateCentsPerMile, 'USD')}/mi</td>
                <td className="py-1 px-2 tabular-nums">{r.rateCentsPerMile}</td>
                <td className="py-1 px-2"><a className="underline break-all" href={r.source.url}>{r.source.authority}</a> · {r.source.retrieved}</td>
                <td className="py-1 px-2 text-[var(--muted)]">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportTableScroll>
      <p className="text-xs text-[var(--muted)]">Source: IRS standard mileage rates page. Medical/moving (22¢ from 2022) and charitable (14¢) are not in this business table. Verify the 2026 rate with the IRS Notice for 2026 before relying on it.</p>
    </section>
  );
}
