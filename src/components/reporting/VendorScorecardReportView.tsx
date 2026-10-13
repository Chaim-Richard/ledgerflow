import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDataNeedsStore } from '../../stores/useDataNeedsStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { useCollection } from '../../hooks/useCollection';
import { vendorScorecard, vendorScorecardCsvRows, VENDOR_SCORECARD_CSV_HEADERS } from '../../lib/vendorScorecard';
import { validCustomReportPeriod } from '../../lib/reportCustomPeriod';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { downloadCsv } from '../../lib/csvExport';
import ReportTableScroll from './ReportTableScroll';
import type { PurchaseOrder } from '../../types';

const field = 'min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)]';
const percent = (value: number | null | undefined) => (value === null || value === undefined ? 'Not measured' : `${value.toFixed(2)}%`);

/**
 * A-47: vendor scorecard. Per vendor: on-time delivery against the expected date, price changes
 * per item (in the bill's own currency), and the returns sent back. Read-only; nothing is posted
 * or changed. The purchase orders are read in one request of up to 500, so a longer history is
 * flagged as partial rather than shown as complete.
 */
export default function VendorScorecardReportView({ endDate = '' }: { endDate?: string }) {
  const { data: orders, loading: loadingOrders } = useCollection<PurchaseOrder>('purchaseOrders', { orderByField: 'createdAt', orderDirection: 'desc', limit: 500 });
  return <VendorScorecardPanel endDate={endDate} orders={orders} ordersLoading={loadingOrders} />;
}

/** The scorecard for the purchase orders it is given (the wrapper above reads them). */
export function VendorScorecardPanel({ endDate = '', orders, ordersLoading = false }: { endDate?: string; orders: PurchaseOrder[]; ordersLoading?: boolean }) {
  const bills = useLedgerStore(state => state.bills);
  const vendors = useLedgerStore(state => state.vendors);
  const credits = useLedgerStore(state => state.vendorCredits);
  const truncated = useLedgerStore(state => state.truncatedCollections);
  const failed = useDataNeedsStore(state => state.failed);
  const workspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspace = useAuthStore(state => state.getCurrentWorkspace());
  const { loading: loadingLedger } = useLedgerCollections('bills', 'vendors', 'vendorCredits');
  const [chosenFrom, setChosenFrom] = useState<string | null>(null);

  const to = endDate || getLocalDateISO();
  const valid = validCustomReportPeriod({ startDate: to, endDate: to });
  const from = chosenFrom && validCustomReportPeriod({ startDate: chosenFrom, endDate: chosenFrom }) ? chosenFrom : `${to.slice(0, 4)}-01-01`;
  const homeCurrency = workspace?.currency || 'USD';

  const rows = useMemo(() => {
    if (!valid) return [];
    const scopedOrders = orders.filter(po => !workspaceId || po.workspaceId === workspaceId);
    const scopedBills = bills.filter(b => !workspaceId || b.workspaceId === workspaceId);
    const scopedCredits = credits.filter(c => !workspaceId || c.workspaceId === workspaceId);
    return vendorScorecard({ vendors, orders: scopedOrders, bills: scopedBills, credits: scopedCredits, from, to, homeCurrency });
  }, [vendors, orders, bills, credits, workspaceId, from, to, valid, homeCurrency]);

  const partial = truncated.bills || failed.bills || truncated.vendorCredits || failed.vendorCredits || orders.length >= 500;
  const loading = loadingLedger || ordersLoading;
  const money = (cents: number, currency?: string) => formatCurrency(cents, currency || homeCurrency);

  return <section aria-label="Vendor scorecard" className="p-4 space-y-4 min-w-0">
    <h2>Vendor scorecard</h2>
    <p className="text-sm text-[var(--muted)]">Read-only. For each vendor: how often the first goods receipt came on or before the expected delivery date, which items changed price (unit cost, in each bill's own currency), and the returns sent back. Nothing is posted or changed here.</p>

    <div className="flex flex-wrap items-end gap-3" data-print-hide>
      <label className="flex flex-col gap-1">From
        <input aria-label="Scorecard from date" type="date" className={field} value={from} onChange={event => setChosenFrom(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1">To
        <input aria-label="Scorecard to date" type="date" className={field} value={to} readOnly />
      </label>
      <button type="button" className="btn-secondary min-h-11 px-3" disabled={!rows.length} onClick={() => downloadCsv(
        `vendor-scorecard-${from}-${to}.csv`, VENDOR_SCORECARD_CSV_HEADERS, vendorScorecardCsvRows(rows)
      )}>Export CSV</button>
    </div>

    {loading && <p role="status">Loading vendor history…</p>}
    {!valid && <p role="alert">Choose a valid end date on the report.</p>}
    {partial && <p role="alert">Some history is incomplete or failed to load. Figures here may leave out older orders, bills or credits.</p>}

    {rows.length > 0 && <ReportTableScroll><table className="w-full text-sm">
      <caption>Vendors from {from} to {to}</caption>
      <thead><tr>
        <th scope="col">Vendor</th><th scope="col" className="text-right">Orders with dates</th><th scope="col" className="text-right">On time</th>
        <th scope="col" className="text-right">Average days late</th><th scope="col">Price changes</th><th scope="col" className="text-right">Returns</th>
      </tr></thead>
      <tbody>{rows.map(row => <tr key={row.vendorId} className="border-t border-[var(--line)] align-top">
        <th scope="row" className="text-left"><bdi>{row.vendorName}</bdi></th>
        <td className="text-right tabular-nums">{row.orders.withDates}{row.orders.withDates ? ` (${percent(row.orders.onTimeRate)} on time)` : ''}</td>
        <td className="text-right tabular-nums">{row.orders.onTime} on time, {row.orders.late} late</td>
        <td className="text-right tabular-nums">{row.orders.averageDaysLate ?? 'Not measured'}</td>
        <td>{row.priceChanges.length ? <ul className="space-y-1">{row.priceChanges.map(p => <li key={`${p.itemId}-${p.currency}`}>
          <code>{p.itemId}</code> ({p.currency}): {money(p.firstUnitCents, p.currency)} to {money(p.lastUnitCents, p.currency)} per unit, {p.changes} change{p.changes === 1 ? '' : 's'}{p.changePercent !== undefined ? ` (${p.changePercent}%)` : ''}
        </li>)}</ul> : 'No price changes'}</td>
        <td className="text-right tabular-nums">{row.returns.credits ? `${row.returns.credits} credit${row.returns.credits === 1 ? '' : 's'}, ${row.returns.units} unit${row.returns.units === 1 ? '' : 's'}, ${money(row.returns.cents)}` : 'None'}</td>
      </tr>)}</tbody>
    </table></ReportTableScroll>}

    {!loading && rows.length === 0 && valid && <p>No vendors to show for this period.</p>}
  </section>;
}
