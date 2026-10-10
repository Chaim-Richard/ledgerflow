import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { formatCurrency } from '../../lib/utils';
import type { RecordType } from '../../lib/recordLinks';

const COLLECTION: Record<string, 'invoices' | 'bills' | 'transactions' | 'accounts' | 'inventory'> = { invoice: 'invoices', bill: 'bills', transaction: 'transactions', account: 'accounts', item: 'inventory' };

/** The records of one kind to choose from, newest first, with what the list shows for each. */
export function useRecordChoices(type: RecordType | '', currency: string): Array<{ id: string; label: string }> {
  useLedgerCollections(...(type ? [COLLECTION[type]] : []));
  const invoices = useLedgerStore(s => s.invoices), bills = useLedgerStore(s => s.bills), transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts), items = useLedgerStore(s => s.inventory);
  const money = (c?: number) => formatCurrency(Number(c) || 0, currency);
  const byDate = <T extends { date?: string }>(list: T[]) => [...list].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 300);
  if (type === 'invoice') return byDate(invoices || []).map(i => ({ id: i.id, label: `Invoice ${i.number || i.id} · ${i.customerName || ''} · ${money(i.amountCents)}` }));
  if (type === 'bill') return byDate(bills || []).map(b => ({ id: b.id, label: `Bill ${b.number || b.id} · ${b.vendorName || ''} · ${money(b.amountCents)}` }));
  if (type === 'transaction') return byDate(transactions || []).map(t => ({ id: t.id, label: `Entry ${t.date} · ${t.description || ''}` }));
  if (type === 'account') return (accounts || []).map(a => ({ id: a.id, label: `Account ${a.code ? `${a.code} ` : ''}${a.name}` }));
  if (type === 'item') return (items || []).map(i => ({ id: i.id, label: `Item ${i.name}` }));
  return [];
}
