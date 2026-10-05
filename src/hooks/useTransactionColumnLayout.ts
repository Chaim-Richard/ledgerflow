import { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { normalizeColumnLayout, readColumnLayout } from '../lib/columnLayout';
import type { ColumnLayout } from '../lib/columnLayout';
import { readHiddenColumns } from '../lib/transactionColumns';

export function useTransactionColumnLayout() {
  const uid = useAuthStore(state => state.user?.uid) || 'guest';
  const key = `lf_tx_layout_${uid}`;
  const hiddenKey = `lf_tx_hidden_columns_${uid}`;
  const load = () => ({ key, layout: readColumnLayout(key), hidden: readHiddenColumns(hiddenKey) });
  const [stored, setStored] = useState(load);
  const current = stored.key === key ? stored : load();
  if (stored.key !== key) setStored(current);
  const persistLayout = (layout: ColumnLayout) => {
    const next = normalizeColumnLayout(layout);
    setStored({ ...current, layout: next });
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Kept for this visit when storage is blocked. */ }
  };
  return {
    layout: current.layout, hiddenColumns: current.hidden,
    setColumnWidth: (id: string, width: number) => persistLayout({ ...current.layout, widths: { ...current.layout.widths, [id]: width } }),
    moveColumn: (id: string, direction: -1 | 1) => {
      const order = [...current.layout.order];
      const from = order.indexOf(id), to = from + direction;
      if (from < 1 || from >= order.length - 1 || to < 1 || to >= order.length - 1) return;
      [order[from], order[to]] = [order[to], order[from]];
      persistLayout({ ...current.layout, order });
    },
    resetColumnLayout: () => persistLayout(normalizeColumnLayout(null)),
    toggleColumnVisibility: (id: string) => {
      const next = new Set(current.hidden);
      if (next.has(id)) next.delete(id); else next.add(id);
      setStored({ ...current, hidden: next });
      try { localStorage.setItem(hiddenKey, JSON.stringify([...next])); } catch { /* Kept for this visit. */ }
    },
  };
}
