import { db, getIdToken } from '../../firebase';
import { doc, getDoc } from '../../lib/db/firestore';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Transaction, Invoice, InventoryItem } from '../../types';
import { postingToday, registerPostingHost } from './postingCore';
import { getLocalDateISO } from '../../lib/utils';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from './postingCore';

// The browser's side of posting (L-94 step 0): the pure helpers are in postingCore.ts; this file
// gives them the screen's data (the stores) and the one call that sends entries to the server, and
// registers both as the posting host when it is imported (LedgerPostService imports it).
export * from './postingCore';

/**
 * The items an invoice sells, for cost of goods sold: the loaded inventory, plus any item on the
 * invoice that isn't loaded yet (inventory loads only once a screen needs it:
 * src/lib/ledgerCollections.ts), read from the database.
 */
async function loadInventoryFromStore(invoiceData: Partial<Invoice>): Promise<InventoryItem[]> {
  const loaded = useLedgerStore.getState().inventory || [];
  const known = new Set(loaded.map(i => i.id));
  const missing = [...new Set((invoiceData.items || []).map(l => l.itemId).filter((id): id is string => Boolean(id) && !known.has(id as string)))];
  if (!missing.length) return loaded;
  const fetched = await Promise.all(missing.map(async id => {
    const snap = await getDoc(doc(db, 'inventory', id)).catch(() => null);
    return snap?.exists() ? ({ id: snap.id, ...snap.data() } as InventoryItem) : null;
  }));
  return [...loaded, ...fetched.filter((i): i is InventoryItem => i !== null)];
}

/**
 * Send transactions array to Server API endpoint (/api/v1/transactions/bulk) atomically.
 */
/** Documents whose entries the server builds (L94-STEP2, L94-STEP2B): /transactions/bulk takes none of them. */
const SERVER_POSTED = new Set(['invoices', 'bills', 'creditNotes', 'vendorCredits']);

async function sendToServer(
  txs: PostableTransaction[],
  workspaceId: string,
  entityMutation?: EntityMutation,
  context?: LedgerPostContext
) {
  // L-94 step 2: an invoice, bill, credit note or vendor credit is saved or deleted by the server, which builds its
  // entries itself; the lines built here are not sent (they served the checks the browser shows before saving: the
  // closing date, the accounts)
  if (entityMutation && SERVER_POSTED.has(entityMutation.collection)) {
    return postDocumentToServer(workspaceId, entityMutation, context);
  }
  // Ids are chosen here so the entries added to the local store below carry the same ids as the
  // server copies; a quick second edit can then link its reversals to them.
  txs = (txs || []).map(tx => (tx.id ? tx : { ...tx, id: crypto.randomUUID() }));
  const token = await getIdToken().catch(() => null);
  const idempotencyKey = context?.idempotencyKey || (txs.length > 0 ? txs[0].id : null) || crypto.randomUUID();
  const response = await fetch('/api/v1/transactions/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    // the day this posting counted as today, so the server's check rebuilds it with the same day (L-94)
    body: JSON.stringify({ transactions: txs, workspaceId, entityMutation, postingDay: postingToday(context) })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Server rejected transaction posting');
  }
  if (Array.isArray(data.warnings)) data.warnings.forEach((w: unknown) => toast.warning(String(w)));

  // INT-2: the server says this save had already happened (an earlier save of the same posting); the
  // entries built here were not written, so they are not added to the local list either
  if (data.replayed) return;
  // AUD-15: the entries as the server wrote them (its ids, owner, checks and stamps), not the ones sent; an answer
  // without that list (a server from before AUD-15, during a deploy) leaves the sent ones as before
  putWrittenEntries(workspaceId, Array.isArray(data.transactions) ? data.transactions as Transaction[] : (txs as unknown as Transaction[]));
}

/**
 * The saved entries go into the screen's list at once (this host runs only in the browser): only while the workspace
 * they were saved in is still open, and by id — an entry the live updates already brought in, or a retried save, is
 * replaced, never shown twice (BUG-05, AUD-15).
 */
function putWrittenEntries(workspaceId: string, written: Transaction[]) {
  if (written.length === 0 || useAuthStore.getState().currentWorkspaceId !== workspaceId) return;
  const store = useLedgerStore.getState();
  const posted = new Set(written.map(tx => tx.id));
  store.setTransactions([...written, ...(store.transactions || []).filter(tx => !posted.has(tx.id))]);
}

/** POST /api/v1/documents/:type/:id/post: the document only; the entries the server wrote go into the screen's list. */
async function postDocumentToServer(workspaceId: string, entityMutation: EntityMutation, context?: LedgerPostContext) {
  const token = await getIdToken().catch(() => null);
  const response = await fetch(`/api/v1/documents/${entityMutation.collection}/${encodeURIComponent(entityMutation.docId)}/post`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': context?.idempotencyKey || crypto.randomUUID(),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ workspaceId, action: entityMutation.action, ...(entityMutation.action === 'delete' ? {} : { data: entityMutation.data || {} }), postingDay: postingToday(context) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Server rejected the save');
  if (Array.isArray(data.warnings)) data.warnings.forEach((w: unknown) => toast.warning(String(w)));
  if (data.replayed) return;
  putWrittenEntries(workspaceId, Array.isArray(data.transactions) ? data.transactions as Transaction[] : []);
}

registerPostingHost({
  accounts: () => useLedgerStore.getState().accounts || [],
  transactions: () => useLedgerStore.getState().transactions || [],
  invoices: () => useLedgerStore.getState().invoices || [],
  workspaces: () => useAuthStore.getState().workspaces || [],
  lockDate: () => useLedgerStore.getState().lockDate,
  lockException: () => useLedgerStore.getState().lockException,
  loadInventory: loadInventoryFromStore,
  today: () => getLocalDateISO(),
  uid: () => useAuthStore.getState().user?.uid,
  send: sendToServer,
});
