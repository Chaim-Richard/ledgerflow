import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { depreciationSchedule, scheduleByYear } from '../../lib/depreciationEngine';
import { downloadCsv } from '../../lib/csvExport';
import { formatCurrency } from '../../lib/utils';
import type { FixedAsset } from '../../types';

/**
 * An asset's depreciation schedule (X-02): by year on screen (depreciation, accumulated and book
 * value at the year end, and whether the month-end run already posted it), month by month in the
 * CSV. Worked out by the same engine the month-end run posts from.
 */
export default function DepreciationScheduleTable({ asset }: { asset: FixedAsset }) {
  const months = useMemo(() => depreciationSchedule(asset), [asset]);
  const years = useMemo(() => scheduleByYear(months), [months]);
  const cents = (c: number) => (c / 100).toFixed(2);
  const download = () => downloadCsv(`depreciation-${asset.name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`,
    ['Month', 'Depreciation', 'Accumulated', 'Book value', 'Posted'],
    months.map(m => [m.month, cents(m.amountCents), cents(m.accumulatedCents), cents(m.bookValueCents), m.posted ? 'yes' : 'no']));

  if (months.length === 0) return <p className="text-xs text-[var(--muted)]">No schedule: the purchase date is missing.</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">{months.length} months from {months[0].month} to {months[months.length - 1].month}; the month-end run posts each month.</p>
        <button type="button" onClick={download} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brass)] hover:underline">
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Monthly schedule (.csv)
        </button>
      </div>
      <table className="w-full text-xs">
        <caption className="sr-only">Depreciation schedule of {asset.name} by year</caption>
        <thead className="text-[var(--muted)]">
          <tr>
            <th scope="col" className="py-1 text-left">Year</th>
            <th scope="col" className="py-1 text-right">Depreciation</th>
            <th scope="col" className="py-1 text-right">Accumulated</th>
            <th scope="col" className="py-1 text-right">Book value</th>
            <th scope="col" className="py-1 text-left pl-3">Posted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {years.map(y => (
            <tr key={y.year}>
              <th scope="row" className="py-1 text-left font-semibold">{y.year}{y.months < 12 ? ` (${y.months} mo)` : ''}</th>
              <td className="py-1 text-right font-mono">{formatCurrency(y.amountCents)}</td>
              <td className="py-1 text-right font-mono">{formatCurrency(y.accumulatedCents)}</td>
              <td className="py-1 text-right font-mono">{formatCurrency(y.bookValueCents)}</td>
              <td className="py-1 pl-3 text-[var(--muted)]">{y.posted ? 'yes' : 'not yet'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
