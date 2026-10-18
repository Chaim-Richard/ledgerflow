import React, { useMemo, useState } from 'react';
import {
  GOLDEN_BILLS, GOLDEN_CSV_HEADERS, GOLDEN_INVOICES, goldenCsvRows, verifyGoldenFixtures,
  type GoldenBillCase, type GoldenInvoiceCase,
} from '../../lib/goldenTaxFixtures';
import { downloadCsv } from '../../lib/csvExport';
import ReportTableScroll from './ReportTableScroll';
import { formatCurrency } from '../../lib/utils';

const money = (cents: number, currency: string) => formatCurrency(cents, currency);

/**
 * A-146/A-147: the golden tax fixtures (IL + US only, PLAN §15) checked live against the dated
 * tables they name. Read-only test data for the tax engine — nothing here is a workspace
 * document, and nothing posts, files or calculates a return.
 */
export default function GoldenTaxFixturesReportView() {
  const result = useMemo(() => verifyGoldenFixtures(), []);
  return <GoldenTaxFixturesPanel invoices={GOLDEN_INVOICES} bills={GOLDEN_BILLS} failures={result.failures} />;
}

export function GoldenTaxFixturesPanel({ invoices, bills, failures }: {
  invoices: readonly GoldenInvoiceCase[];
  bills: readonly GoldenBillCase[];
  failures: readonly { id: string; detail: string }[];
}) {
  const [country, setCountry] = useState<'all' | 'IL' | 'US'>('all');
  const inv = invoices.filter(c => country === 'all' || c.country === country);
  const bil = bills.filter(b => country === 'all' || b.country === country);
  const failedIds = new Set(failures.map(f => f.id));

  return <section aria-label="Golden tax fixtures" className="p-4 space-y-4 min-w-0">
    <h2>Golden tax fixtures</h2>
    <p className="text-sm text-[var(--muted)]">
      Fifty real-world-shaped invoices and thirty purchase bills with the tax expected on each line,
      for Israel and the United States only. Each expected amount is checked here against the dated
      rate table it names, so a table change that would alter a result shows as a failure instead of
      passing silently. These are test fixtures, not workspace documents: nothing posts, files or
      calculates a return. US invoice amounts use the state base rate only — county, city and district
      taxes are not included and must never be read as the full amount due. Israel withholding uses
      the payment-less-VAT basis of the existing helper; the vendor&rsquo;s own approval always
      replaces a default rate, and an accountant confirms the legal base.
    </p>

    <p role={failures.length ? 'alert' : 'status'} className="text-sm font-semibold">
      {failures.length === 0
        ? `All ${invoices.length + bills.length} fixtures match the dated tables.`
        : `${failures.length} fixture check(s) fail against the current tables — do not rely on the affected rates until this is reviewed.`}
    </p>
    {failures.length > 0 && <ul className="text-sm list-disc ps-5">
      {failures.map(f => <li key={`${f.id}-${f.detail}`}>{f.id}: {f.detail}</li>)}
    </ul>}

    <div className="flex flex-wrap items-end gap-3" data-print-hide>
      <label className="text-sm">Country
        <select aria-label="Country" className="block min-h-11 px-2 rounded border border-[var(--line)]" value={country}
          onChange={event => setCountry(event.target.value as typeof country)}>
          <option value="all">Israel and United States</option>
          <option value="IL">Israel only</option>
          <option value="US">United States only</option>
        </select>
      </label>
      <button type="button" className="min-h-11 px-4 rounded border border-[var(--line)]"
        onClick={() => downloadCsv('golden-tax-fixtures', GOLDEN_CSV_HEADERS, goldenCsvRows())}>Export CSV</button>
    </div>

    <h3 className="font-semibold text-sm">Invoices ({inv.length})</h3>
    <ReportTableScroll>
      <table className="w-full text-sm">
        <caption className="text-left font-semibold text-[var(--text)] pb-1">Golden invoices with expected tax per case</caption>
        <thead><tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
          {['Case', 'Date', 'Place', 'Treatment', 'Net', 'Expected tax', 'Gross', 'Check'].map(head => <th key={head} scope="col" className="text-left py-1 px-2">{head}</th>)}
        </tr></thead>
        <tbody>
          {inv.map(c => <tr key={c.id} className="border-b border-[var(--line)]/50">
            <th scope="row" className="text-left font-normal py-1 px-2 font-mono">{c.id}</th>
            <td className="py-1 px-2 tabular-nums">{c.date}</td>
            <td className="py-1 px-2">{c.country} · {c.place}</td>
            <td className="py-1 px-2">{c.treatment}</td>
            <td className="py-1 px-2 tabular-nums">{money(c.lines.reduce((s, l) => s + l.netCents, 0), c.currency)}</td>
            <td className="py-1 px-2 tabular-nums">{money(c.expectedTaxTotalCents, c.currency)}</td>
            <td className="py-1 px-2 tabular-nums">{money(c.expectedGrossCents, c.currency)}</td>
            <td className="py-1 px-2">{failedIds.has(c.id) ? 'Fails — see above' : 'Matches table'}</td>
          </tr>)}
        </tbody>
      </table>
      {!inv.length && <p className="text-sm text-[var(--muted)]">No invoice fixtures for this choice.</p>}
    </ReportTableScroll>

    <h3 className="font-semibold text-sm">Purchase bills ({bil.length})</h3>
    <ReportTableScroll>
      <table className="w-full text-sm">
        <caption className="text-left font-semibold text-[var(--text)] pb-1">Golden bills: Israel withholding at source and US 1099 thresholds</caption>
        <thead><tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
          {['Case', 'Date', 'Kind', 'Paid', 'Expected', 'Check'].map(head => <th key={head} scope="col" className="text-left py-1 px-2">{head}</th>)}
        </tr></thead>
        <tbody>
          {bil.map(b => <tr key={b.id} className="border-b border-[var(--line)]/50">
            <th scope="row" className="text-left font-normal py-1 px-2 font-mono">{b.id}</th>
            <td className="py-1 px-2 tabular-nums">{b.date}</td>
            <td className="py-1 px-2">{b.country === 'IL' ? `IL withholding · ${b.paymentType} · ${b.residence}` : `US ${b.form} box ${b.box}`}</td>
            <td className="py-1 px-2 tabular-nums">{money(b.paidCents, b.currency)}</td>
            <td className="py-1 px-2 tabular-nums">{b.country === 'IL'
              ? `${b.expectedRatePercent}% → ${money(b.expectedWithheldCents ?? 0, b.currency)} withheld`
              : `${money(b.expectedThresholdCents ?? 0, b.currency)} threshold → ${b.expectedReportable ? 'reportable' : 'below threshold'}`}</td>
            <td className="py-1 px-2">{failedIds.has(b.id) ? 'Fails — see above' : 'Matches table'}</td>
          </tr>)}
        </tbody>
      </table>
      {!bil.length && <p className="text-sm text-[var(--muted)]">No bill fixtures for this choice.</p>}
    </ReportTableScroll>
  </section>;
}
