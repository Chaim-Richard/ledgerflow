import React from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { useCollection } from '../../hooks/useCollection';
import type { PurchaseOrder } from '../../types';
import { backorders, shortages } from '../../lib/backorders';

const qty = (n: number) => String(Math.round(n * 100) / 100);
const th = 'font-semibold py-1 px-2';

/**
 * Backorders (W-08): the sales orders' item lines still to deliver, oldest first, against stock on
 * hand; what each is short, and what is already ordered from vendors (src/lib/backorders.ts). Above,
 * each short item in all, to know what to buy.
 */
export default function BackordersReportView() {
  const { loading } = useLedgerCollections('estimates', 'transactions', 'inventory');
  const estimates = useLedgerStore(s => s.estimates);
  const transactions = useLedgerStore(s => s.transactions);
  const inventory = useLedgerStore(s => s.inventory);
  const { data: purchaseOrders, loading: loadingOrders } = useCollection<PurchaseOrder>('purchaseOrders', { limit: 1000 });
  const rows = backorders(estimates || [], transactions || [], inventory || [], purchaseOrders || []);
  const short = shortages(rows);

  return (
    <section aria-labelledby="backorders-title" className="space-y-6">
      <div>
        <h2 id="backorders-title" className="text-lg font-bold text-[var(--text)]">Backorders</h2>
        <p className="text-sm text-[var(--muted)]">Items sold on orders and not delivered yet, oldest order first, against the stock on hand. Nothing is reserved.</p>
      </div>
      {(loading || loadingOrders) && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <table className="w-full text-sm">
          <caption className="text-left font-semibold text-[var(--text)] pb-1">Short items ({short.length})</caption>
          <thead><tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]"><th scope="col" className={`text-left ${th}`}>Item</th><th scope="col" className={`text-right ${th}`}>Short</th><th scope="col" className={`text-right ${th}`}>On order from vendors</th><th scope="col" className={`text-right ${th}`}>Still to buy</th></tr></thead>
          <tbody>
            {short.length === 0 && <tr><td colSpan={4} className="py-2 px-2 text-[var(--muted)]">Stock on hand covers every order.</td></tr>}
            {short.map(s => (
              <tr key={s.itemId} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{s.item}</bdi></th>
                <td className="text-right font-mono py-1 px-2">{qty(s.short)}</td>
                <td className="text-right font-mono py-1 px-2">{qty(s.onOrder)}</td>
                <td className="text-right font-mono py-1 px-2">{qty(Math.max(0, s.short - s.onOrder))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <table className="w-full text-sm">
          <caption className="text-left font-semibold text-[var(--text)] pb-1">Order lines to deliver ({rows.length})</caption>
          <thead><tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
            <th scope="col" className={`text-left ${th}`}>Order</th><th scope="col" className={`text-left ${th}`}>Customer</th><th scope="col" className={`text-left ${th}`}>Item</th>
            <th scope="col" className={`text-right ${th}`}>To deliver</th><th scope="col" className={`text-right ${th}`}>From stock</th><th scope="col" className={`text-right ${th}`}>Short</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-2 px-2 text-[var(--muted)]">No order is waiting for goods.</td></tr>}
            {rows.map(r => (
              <tr key={`${r.orderId}-${r.itemId}-${r.left}`} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-mono font-normal py-1 px-2">{r.number}</th>
                <td className="py-1 px-2"><bdi>{r.customerName}</bdi></td>
                <td className="py-1 px-2"><bdi>{r.item}</bdi></td>
                <td className="text-right font-mono py-1 px-2">{qty(r.left)}</td>
                <td className="text-right font-mono py-1 px-2">{qty(r.covered)}</td>
                <td className={`text-right font-mono py-1 px-2 ${r.short > 0 ? 'font-semibold text-rose-600' : ''}`}>{r.short > 0 ? qty(r.short) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
