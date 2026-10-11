import React from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { useCollection } from '../../hooks/useCollection';
import type { PurchaseOrder } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { billedNotReceived, deliveredNotInvoiced, receivedNotBilled, totalsByCurrency } from '../../lib/unbilledGoods';

const qty = (n: number) => String(Math.round(n * 100) / 100);
const th = 'font-semibold py-1 px-2';

/**
 * Goods not yet billed (CB-18, CB-19, CB-17): goods delivered to customers that are not invoiced yet,
 * goods received from vendors whose order has no bill yet, and goods billed by vendors that have not
 * arrived, each at its order's price (src/lib/unbilledGoods.ts). Income to invoice, costs still to
 * come, and goods paid for but still to come.
 */
export default function GoodsNotBilledReportView() {
  const { loading } = useLedgerCollections('estimates', 'invoices', 'transactions', 'bills');
  const bills = useLedgerStore(s => s.bills);
  const { data: purchaseOrders, loading: loadingOrders } = useCollection<PurchaseOrder>('purchaseOrders', { limit: 1000 });
  const home = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  const estimates = useLedgerStore(s => s.estimates);
  const invoices = useLedgerStore(s => s.invoices);
  const transactions = useLedgerStore(s => s.transactions);
  const sold = deliveredNotInvoiced(estimates || [], invoices || [], transactions || []);
  const bought = receivedNotBilled(purchaseOrders || []);
  const prepaid = billedNotReceived(purchaseOrders || [], bills || []);
  const totals = (rows: Array<{ currency?: string; valueCents: number }>) => totalsByCurrency(rows, home).map(t => formatCurrency(t.cents, t.currency)).join(' + ');

  return (
    <section aria-labelledby="goods-not-billed-title" className="space-y-6">
      <div>
        <h2 id="goods-not-billed-title" className="text-lg font-bold text-[var(--text)]">Goods not yet billed</h2>
        <p className="text-sm text-[var(--muted)]">Goods that left or came in before their invoice or bill, at each order's price.</p>
      </div>
      {(loading || loadingOrders) && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <table className="w-full text-sm">
          <caption className="text-left font-semibold text-[var(--text)] pb-1">Delivered, not invoiced{sold.length > 0 ? `: ${totals(sold)}` : ''}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
              <th scope="col" className={`text-left ${th}`}>Order</th>
              <th scope="col" className={`text-left ${th}`}>Customer</th>
              <th scope="col" className={`text-left ${th}`}>Line</th>
              <th scope="col" className={`text-right ${th}`}>Delivered</th>
              <th scope="col" className={`text-right ${th}`}>Invoiced</th>
              <th scope="col" className={`text-right ${th}`}>To invoice</th>
              <th scope="col" className={`text-right ${th}`}>Value</th>
            </tr>
          </thead>
          <tbody>
            {sold.length === 0 && <tr><td colSpan={7} className="py-2 px-2 text-[var(--muted)]">Nothing delivered is waiting for its invoice.</td></tr>}
            {sold.map(r => (
              <tr key={`${r.orderId}-${r.description}-${r.delivered}`} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-mono font-normal py-1 px-2">{r.number}</th>
                <td className="py-1 px-2"><bdi>{r.customerName}</bdi></td>
                <td className="py-1 px-2"><bdi>{r.description}</bdi></td>
                <td className="text-right font-mono py-1 px-2">{qty(r.delivered)}</td>
                <td className="text-right font-mono py-1 px-2">{qty(r.invoiced)}</td>
                <td className="text-right font-mono py-1 px-2">{qty(r.units)}</td>
                <td className="text-right font-mono py-1 px-2">{formatCurrency(r.valueCents, r.currency || home)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <table className="w-full text-sm">
          <caption className="text-left font-semibold text-[var(--text)] pb-1">Received, not billed{bought.length > 0 ? `: ${totals(bought)}` : ''}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
              <th scope="col" className={`text-left ${th}`}>Purchase order</th>
              <th scope="col" className={`text-left ${th}`}>Vendor</th>
              <th scope="col" className={`text-left ${th}`}>Line</th>
              <th scope="col" className={`text-right ${th}`}>Received</th>
              <th scope="col" className={`text-right ${th}`}>Value</th>
            </tr>
          </thead>
          <tbody>
            {bought.length === 0 && <tr><td colSpan={5} className="py-2 px-2 text-[var(--muted)]">Nothing received is waiting for its bill.</td></tr>}
            {bought.map(r => (
              <tr key={`${r.orderId}-${r.description}-${r.received}`} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-mono font-normal py-1 px-2">{r.number}</th>
                <td className="py-1 px-2"><bdi>{r.vendorName}</bdi></td>
                <td className="py-1 px-2"><bdi>{r.description}</bdi></td>
                <td className="text-right font-mono py-1 px-2">{qty(r.received)}</td>
                <td className="text-right font-mono py-1 px-2">{formatCurrency(r.valueCents, r.currency || home)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <table className="w-full text-sm">
          <caption className="text-left font-semibold text-[var(--text)] pb-1">Billed, not received{prepaid.length > 0 ? `: ${totals(prepaid)}` : ''}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
              <th scope="col" className={`text-left ${th}`}>Purchase order</th>
              <th scope="col" className={`text-left ${th}`}>Vendor</th>
              <th scope="col" className={`text-left ${th}`}>Line</th>
              <th scope="col" className={`text-right ${th}`}>Billed</th>
              <th scope="col" className={`text-right ${th}`}>Received</th>
              <th scope="col" className={`text-right ${th}`}>Still to come</th>
              <th scope="col" className={`text-right ${th}`}>Value</th>
            </tr>
          </thead>
          <tbody>
            {prepaid.length === 0 && <tr><td colSpan={7} className="py-2 px-2 text-[var(--muted)]">Nothing billed is waiting to arrive (bills made from an order since 10 Oct are counted).</td></tr>}
            {prepaid.map(r => (
              <tr key={`${r.orderId}-${r.description}-${r.billed}`} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-mono font-normal py-1 px-2">{r.number}</th>
                <td className="py-1 px-2"><bdi>{r.vendorName}</bdi></td>
                <td className="py-1 px-2"><bdi>{r.description}</bdi></td>
                <td className="text-right font-mono py-1 px-2">{qty(r.billed)}</td>
                <td className="text-right font-mono py-1 px-2">{qty(r.received)}</td>
                <td className="text-right font-mono py-1 px-2">{qty(r.units)}</td>
                <td className="text-right font-mono py-1 px-2">{formatCurrency(r.valueCents, r.currency || home)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
