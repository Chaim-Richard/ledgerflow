import { toast } from 'sonner';
import { getIdToken } from '../firebase';
import { useLedgerStore } from '../stores/useLedgerStore';

/**
 * Undo a bill's (K-17) or invoice's (K-16) spread over months: the server voids its entries (refused
 * once one of its months is closed). The schedule is cleared on screen at once too, because
 * re-posting the document (Void right after) reads it from the store before the live update arrives.
 */
export async function undoSpreadRequest(kind: 'bill' | 'invoice', workspaceId: string, documentId: string): Promise<boolean> {
  const token = await getIdToken().catch(() => null);
  const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/${kind === 'bill' ? 'bills' : 'invoices'}/${encodeURIComponent(documentId)}/spread/undo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: '{}',
  }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res?.ok) {
    toast.error(data?.message || 'The spread could not be undone');
    return false;
  }
  if (kind === 'bill') {
    useLedgerStore.setState(st => ({ bills: (st.bills || []).map(x => (x.id === documentId ? { ...x, prepaidSchedule: undefined } : x)) }));
  } else {
    useLedgerStore.setState(st => ({ invoices: (st.invoices || []).map(x => (x.id === documentId ? { ...x, revenueSchedule: undefined } : x)) }));
  }
  return true;
}
