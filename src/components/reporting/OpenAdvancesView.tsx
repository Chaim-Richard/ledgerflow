import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDataNeedsStore } from '../../stores/useDataNeedsStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { openAdvances, type AgeBucket, type PaymentDirection } from '../../lib/advancePayments';
import { formatCurrency } from '../../lib/utils';
import ReportTableScroll from './ReportTableScroll';

const BUCKETS: AgeBucket[] = ['0-30', '31-60', '61-90', '90+'];

/**
 * Open advances (CA-09): customer deposits (or vendor prepayments) not yet applied to an invoice or
 * bill, oldest first, with their age at the end of the period and totals per contact. Applying one
 * is on the customer's or vendor's page ("Apply to invoices/bills").
 */
export default function OpenAdvancesView({ endDate = '' }: { startDate?: string; endDate?: string }) {
  const [direction, setDirection] = useState<PaymentDirection>('received');
  const payments = useLedgerStore(s => s.payments);
  const truncated = useLedgerStore(s => s.truncatedCollections);
  const failed = useDataNeedsStore(s => s.failed);
  const home = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  const { loading } = useLedgerCollections('payments');
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : '';
  const result = useMemo(() => (asOf && !loading ? openAdvances(payments || [], direction, asOf) : null), [asOf, loading, payments, direction]);
  const title = direction === 'received' ? 'Open customer deposits' : 'Open vendor prepayments';
  const money = (cents: number, currency?: string) => formatCurrency(cents, currency || home);

  return (
    <section aria-label="Open advances" className="p-4 space-y-4 min-w-0">
      <h2>{title}</h2>
      <p>
        As of {asOf || '—'}. Money {direction === 'received' ? 'customers paid' : 'paid to vendors'} before an {direction === 'received' ? 'invoice' : 'bill'} and not applied yet, oldest first.
        Apply it on the {direction === 'received' ? "customer's" : "vendor's"} page (&quot;Apply to {direction === 'received' ? 'invoices' : 'bills'}&quot;).
      </p>
      <label className="flex items-center gap-2 text-sm">
        Show
        <select aria-label="Which advances" value={direction} onChange={e => setDirection(e.target.value as PaymentDirection)} className="px-2 py-1 border border-[var(--line)] rounded bg-[var(--panel)]">
          <option value="received">Customer deposits</option>
          <option value="made">Vendor prepayments</option>
        </select>
      </label>
      {loading && <p role="status">Loading payments…</p>}
      {(truncated.payments || failed.payments) && <p role="alert">Loaded payment history is incomplete or failed. These figures are provisional.</p>}
      {result && (
        <>
          <ReportTableScroll>
            <table className="w-full text-sm">
              <caption>{title} as of {asOf}</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-left">{direction === 'received' ? 'Customer' : 'Vendor'}</th>
                  <th scope="col" className="text-left">Payment</th>
                  <th scope="col" className="text-left">Date</th>
                  <th scope="col" className="text-right">Paid</th>
                  <th scope="col" className="text-right">Applied</th>
                  <th scope="col" className="text-right">Still open</th>
                  <th scope="col" className="text-right">Days waiting</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 && <tr><td colSpan={7}>Nothing open: every advance is applied.</td></tr>}
                {result.rows.map(r => (
                  <tr key={r.paymentId}>
                    <td><bdi>{r.partyName}</bdi></td>
                    <td>{r.number}</td>
                    <td>{r.date}</td>
                    <td className="text-right tabular-nums">{money(r.amountCents, r.currency)}</td>
                    <td className="text-right tabular-nums">{money(r.appliedCents, r.currency)}</td>
                    <td className="text-right tabular-nums font-semibold">{money(r.openCents, r.currency)}</td>
                    <td className={`text-right tabular-nums ${r.bucket === '90+' ? 'text-rose-600 font-semibold' : ''}`}>{r.ageDays}</td>
                  </tr>
                ))}
              </tbody>
              {Object.keys(result.totals).length > 0 && (
                <tfoot>
                  {Object.entries(result.totals).map(([currency, cents]) => (
                    <tr key={currency || 'home'}>
                      <th scope="row" colSpan={5} className="text-left">Total still open{Object.keys(result.totals).length > 1 ? ` (${currency || home})` : ''}</th>
                      <td className="text-right tabular-nums font-bold">{money(cents, currency)}</td>
                      <td />
                    </tr>
                  ))}
                </tfoot>
              )}
            </table>
          </ReportTableScroll>
          {result.rows.length > 0 && (
            <p className="text-sm text-[var(--muted)]">
              By age: {BUCKETS.map(b => `${b} days ${result.rows.filter(r => r.bucket === b).length}`).join(' · ')}.
              {' '}Most open: {result.byParty.slice(0, 3).map(p => `${p.partyName} ${money(p.openCents, p.currency)}`).join(', ')}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
