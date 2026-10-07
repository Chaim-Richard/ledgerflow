/**
 * Stock history (W-02) of one item, on Inventory: every change to its quantity on hand, oldest
 * first, with why it changed (sold, sale undone, bought, opening stock, adjusted, counted), the
 * change, the quantity after, its value, and the entry it belongs to. Read-only: the server writes
 * the history with each change (src/server/services/stockMoveService.ts). When the history does not
 * end at the quantity on hand it says so (the same rule as the nightly check).
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from '../../lib/db/firestore';
import { useDialog } from '../../hooks/useDialog';
import { useUIStore } from '../../stores/useUIStore';
import { orderedMoves, STOCK_MOVE_LABEL, stockHistoryProblem, type StockMove } from '../../lib/stockMoves';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { InventoryItem } from '../../types';

export default function StockHistoryDialog({ item, workspaceId, currency, onClose }: { item: InventoryItem; workspaceId: string; currency: string; onClose: () => void }) {
  const { dialogProps, titleId } = useDialog(onClose, true);
  const openRecord = useUIStore(s => s.openRecord);
  const [moves, setMoves] = useState<StockMove[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getDocs(query(collection(db, 'stockMoves'), where('workspaceId', '==', workspaceId), where('itemId', '==', item.id)))
      .then(snap => { if (live) setMoves(orderedMoves(snap.docs.map(d => ({ ...(d.data() as StockMove), id: d.id })))); })
      .catch(err => { if (live) { setError(err instanceof Error ? err.message : String(err)); setMoves([]); } });
    return () => { live = false; };
  }, [workspaceId, item.id]);

  const problem = moves ? stockHistoryProblem(item, moves) : null;
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  return (
    <div {...dialogProps} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-[var(--line)]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <h2 id={titleId} className="text-lg font-bold text-[var(--text)]">Stock history: <bdi>{item.name}</bdi></h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)]">
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <p className="text-xs text-[var(--muted)]">{item.quantityAtHand} on hand now. Every change below was recorded with the entry it belongs to.</p>
          {error && <p role="alert" className="text-xs text-rose-600">The history could not be loaded: {error}</p>}
          {problem && <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">{problem}. Count the stock to set it right.</p>}
          {moves === null ? <p className="text-xs text-[var(--muted)]">Loading…</p> : moves.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No recorded changes yet (changes are recorded from 7 Oct 2026 on).</p>
          ) : (
            <table className="w-full text-xs">
              <caption className="sr-only">Changes to the stock of {item.name}, oldest first</caption>
              <thead>
                <tr className="text-[var(--muted)] border-b border-[var(--line)]">
                  <th scope="col" className="text-left font-semibold py-1">Date</th>
                  <th scope="col" className="text-left font-semibold py-1">What</th>
                  <th scope="col" className="text-right font-semibold py-1">Change</th>
                  <th scope="col" className="text-right font-semibold py-1">On hand after</th>
                  <th scope="col" className="text-right font-semibold py-1">Value</th>
                  <th scope="col" className="py-1"><span className="sr-only">Entry</span></th>
                </tr>
              </thead>
              <tbody>
                {moves.map(m => (
                  <tr key={m.id || m.seq} className="border-b border-[var(--line)]/50">
                    <td className="py-1">{formatDate(m.date)}</td>
                    <td className="py-1">{STOCK_MOVE_LABEL[m.kind] || m.kind}</td>
                    <td className={`py-1 text-right font-mono ${m.quantity < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>{signed(m.quantity)}</td>
                    <td className="py-1 text-right font-mono">{m.quantityAfter}</td>
                    <td className="py-1 text-right font-mono">{formatCurrency(m.valueCents, currency)}</td>
                    <td className="py-1 text-right">
                      {m.transactionId && (
                        <button type="button" onClick={() => { onClose(); openRecord({ type: 'transaction', id: String(m.transactionId) }); }} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          Entry<span className="sr-only"> of {formatDate(m.date)}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
