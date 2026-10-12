/**
 * A-23 (PLAN IL-5): the yearly report of tax withheld at source from vendor payments — Israel's
 * Form 856. Per vendor for one tax year: what was paid, the base the rate applied to, what was
 * withheld and the certificate numbers relied on, plus what is still missing. Read-only: nothing
 * here files the form, posts or pays anything (src/lib/tax/form856.ts does the arithmetic).
 */
import { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { downloadCsv } from '../../lib/csvExport';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { FORM_856_CSV_HEADERS, form856CsvRows, form856Notes, form856Rows, form856Summary, form856Year, type Form856Payment } from '../../lib/tax/form856';

const th = 'font-semibold py-1 px-2';

export default function Form856ReportView() {
  const { loading } = useLedgerCollections('payments');
  const payments = useLedgerStore(s => s.payments);
  const baseCurrency = useLedgerStore(s => s.baseCurrency) || 'ILS';
  const thisYear = (getLocalDateISO() || new Date().toISOString()).slice(0, 4);
  const [year, setYear] = useState(thisYear);

  const years = useMemo(() => {
    const found = new Set<string>([thisYear]);
    for (const payment of (payments || []) as Form856Payment[]) {
      const y = form856Year(payment.date);
      if (y) found.add(y);
    }
    return [...found].sort().reverse();
  }, [payments, thisYear]);

  const rows = useMemo(() => form856Rows((payments || []) as Form856Payment[], year), [payments, year]);
  const summary = useMemo(() => form856Summary(rows), [rows]);
  const notes = useMemo(() => form856Notes(rows), [rows]);
  const money = (cents: number) => formatCurrency(cents, baseCurrency);

  return (
    <section aria-labelledby="form-856-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="form-856-title" className="text-lg font-bold text-[var(--text)]">Withholding Report (Form 856)</h2>
          <p className="text-sm text-[var(--muted)]">
            Tax withheld at source from payments to vendors, per vendor, for one tax year. Read-only: the figures come from the recorded payments, and nothing is filed here.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label htmlFor="form-856-year" className="text-xs font-semibold text-[var(--muted)]">Year</label>
          <select id="form-856-year" value={year} onChange={e => setYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" disabled={rows.length === 0}
            onClick={() => downloadCsv(`form-856-${year}.csv`, FORM_856_CSV_HEADERS, form856CsvRows(rows))}
            className="px-4 py-2 rounded-xl border border-[var(--line)] text-xs font-bold uppercase tracking-widest disabled:opacity-40">
            Download CSV
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {rows.length === 0 && !loading && (
        <p className="text-sm text-[var(--muted)]">No vendor payment in {year} has tax withheld at source.</p>
      )}

      {rows.length > 0 && (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div className="flex gap-2"><dt className="text-[var(--muted)]">Vendors</dt><dd className="font-mono">{summary.vendors}</dd></div>
            <div className="flex gap-2"><dt className="text-[var(--muted)]">Payments</dt><dd className="font-mono">{summary.payments}</dd></div>
            <div className="flex gap-2"><dt className="text-[var(--muted)]">Paid</dt><dd className="font-mono">{money(summary.paidCents)}</dd></div>
            <div className="flex gap-2"><dt className="text-[var(--muted)]">Withheld</dt><dd className="font-mono">{money(summary.withheldCents)}</dd></div>
          </dl>
          <ul className="list-disc ps-6 text-sm text-[var(--muted)]">
            {notes.map(note => <li key={note}>{note}</li>)}
          </ul>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <table className="w-full text-sm">
              <caption className="text-left font-semibold text-[var(--text)] pb-1">Per vendor ({rows.length})</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
                  <th scope="col" className={`text-left ${th}`}>Vendor</th>
                  <th scope="col" className={`text-left ${th}`}>Tax id</th>
                  <th scope="col" className={`text-right ${th}`}>Payments</th>
                  <th scope="col" className={`text-right ${th}`}>Paid</th>
                  <th scope="col" className={`text-right ${th}`}>Base</th>
                  <th scope="col" className={`text-right ${th}`}>Withheld</th>
                  <th scope="col" className={`text-right ${th}`}>Rate</th>
                  <th scope="col" className={`text-left ${th}`}>Certificates</th>
                  <th scope="col" className={`text-left ${th}`}>Months</th>
                  <th scope="col" className={`text-right ${th}`}>Missing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.contactId} className="border-b border-[var(--line)]/50">
                    <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{row.name}</bdi></th>
                    <td className="py-1 px-2 font-mono">{row.taxId || '—'}</td>
                    <td className="text-right font-mono py-1 px-2">{row.payments}</td>
                    <td className="text-right font-mono py-1 px-2">{money(row.paidCents)}</td>
                    <td className="text-right font-mono py-1 px-2">{money(row.baseCents)}</td>
                    <td className="text-right font-mono py-1 px-2">{money(row.withheldCents)}</td>
                    <td className="text-right font-mono py-1 px-2">{row.effectiveRatePercent}%</td>
                    <td className="py-1 px-2"><bdi>{row.certificates.join(', ') || '—'}</bdi></td>
                    <td className="py-1 px-2 font-mono">{row.months.join(', ')}</td>
                    <td className="text-right font-mono py-1 px-2">{row.missingCertificates || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
