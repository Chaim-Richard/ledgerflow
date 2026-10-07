import { db, getIdToken } from '../../firebase';
import { doc, getDoc } from '../../lib/db/firestore';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { ChartAccount, Transaction, TransactionLine, Workspace, Invoice, InventoryItem } from '../../types';
import type { LineAccountWeight } from '../../kernel/templates/TransactionTemplates';
import { isLockedDate } from '../../lib/periodLock';

// What every posting needs (F-11, moved from LedgerPostService): the data to post against, the
// period-lock check, account lookup and the one call that sends entries to the server.

export interface EntityMutation {
  collection: string;
  docId: string;
  action: 'create' | 'update' | 'delete';
  data?: Record<string, unknown>;
}

export interface LedgerPostContext {
  accounts?: ChartAccount[];
  lockDate?: string | null;
  transactions?: Transaction[];
  workspaces?: Workspace[];
  inventory?: InventoryItem[];
  idempotencyKey?: string;
  bypassPost?: boolean;
  uid?: string;
}

export type PostableTransaction = Omit<Partial<Transaction>, 'lines' | 'status' | 'type'> & {
  uid: string;
  workspaceId: string;
  date: string;
  description: string;
  totalAmountCents: number;
  currency?: string;
  status?: Transaction['status'] | string;
  type?: Transaction['type'] | string;
  lines: TransactionLine[];
};

export function getAccounts(context?: LedgerPostContext): ChartAccount[] {
  return context?.accounts || useLedgerStore.getState().accounts || [];
}

export function getLockDate(context?: LedgerPostContext): string | null {
  if (context && context.lockDate !== undefined) return context.lockDate;
  return useLedgerStore.getState().lockDate;
}

export function getTransactions(context?: LedgerPostContext): Transaction[] {
  return context?.transactions || useLedgerStore.getState().transactions || [];
}

export function getWorkspaces(context?: LedgerPostContext): Workspace[] {
  return context?.workspaces || useAuthStore.getState().workspaces || [];
}

/**
 * The items an invoice sells, for cost of goods sold: the caller's list, else the loaded
 * inventory, plus any item on the invoice that isn't loaded yet (inventory loads only once a
 * screen needs it: src/lib/ledgerCollections.ts), read from the database.
 */
export async function loadInventory(invoiceData: Partial<Invoice>, context?: LedgerPostContext): Promise<InventoryItem[]> {
  if (context?.inventory) return context.inventory;
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
 * New postings are recorded in the base currency. The amounts are converted once
 * (document amount × the document's rate) before they get here, so the entry and every line
 * carry rate 1; otherwise lineAmount() would apply the rate a second time. The document's own
 * currency and rate are kept in metadata. Reversals keep the rates of what they reverse.
 */
export function inBaseCurrency<T extends { currency?: string; exchangeRate?: number; lines: TransactionLine[]; metadata?: Record<string, unknown> }>(
  tx: T, workspaceId: string, context?: LedgerPostContext,
): T {
  const baseCurrency = getWorkspaces(context).find(w => w.id === workspaceId)?.currency || 'USD';
  return {
    ...tx,
    currency: baseCurrency,
    exchangeRate: 1,
    metadata: { ...(tx.metadata || {}), documentCurrency: tx.currency || baseCurrency, documentExchangeRate: tx.exchangeRate || 1 },
    lines: tx.lines.map(l => ({ ...l, exchangeRate: 1 })),
  };
}

/**
 * Period Lock Guard
 */
export function verifyLockDate(dateStr: string, context?: LedgerPostContext): void {
  if (!dateStr) return;
  const lockDate = getLockDate(context);
  const exception = context && context.lockDate !== undefined ? null : useLedgerStore.getState().lockException;
  if (isLockedDate(dateStr, lockDate, exception)) {
    throw new Error(`Period is locked on or before ${lockDate}. Cannot post or modify transaction on ${dateStr}.`);
  }
}

/**
 * The day to reverse a document's earlier entry when the document is edited, voided or deleted: the
 * earlier entry's own date while that day is open, so its month nets to the corrected amount (dated
 * today, the old amount stayed in the document's month next to the new one and the month's reports
 * were wrong; found by the main-path test, DA-08); today when that day is closed, so closed books are
 * corrected in the current period instead.
 */
export function reversalDate(originalDate: string | undefined, today: string, context?: LedgerPostContext): string {
  if (!originalDate) return today;
  const day = originalDate.slice(0, 10);
  const exception = context && context.lockDate !== undefined ? null : useLedgerStore.getState().lockException;
  return isLockedDate(day, getLockDate(context), exception) ? today : day;
}

/** Workspace mapping first, then the first chart account matching the predicate. */
export function findAccount(
  accounts: ChartAccount[],
  workspaceMappings: Record<string, string>,
  keys: string[],
  predicate: (a: ChartAccount) => boolean
): { id: string; name: string } | undefined {
  for (const key of keys) {
    const mappedId = workspaceMappings[key.toLowerCase()];
    const acc = mappedId ? accounts.find(a => a.id === mappedId) : undefined;
    if (acc) return { id: acc.id, name: acc.name };
  }
  const found = accounts.find(predicate);
  return found ? { id: found.id, name: found.name } : undefined;
}

/**
 * Resolve specific accounts using workspace mappings first, then CHART fallbacks, or throw loudly.
 */
export function resolveAccount(
  accounts: ChartAccount[],
  workspaceMappings: Record<string, string>,
  keys: string[],
  predicate: (a: ChartAccount) => boolean,
  errorName: string
): { id: string; name: string } {
  const found = findAccount(accounts, workspaceMappings, keys, predicate);
  if (found) return found;

  // 3. Fail loudly instead of using fake fallback IDs
  throw new Error(`Missing ${errorName} account. Please set up a ${errorName} account in Chart of Accounts or Workspace Settings.`);
}

/**
 * The account chosen on each document line (by id, or by name for lines typed by hand), so
 * revenue / cost goes where the user put it (L-115). A line without a usable account uses the
 * document's default account. Returns undefined when there are no lines.
 */
export function lineAccounts(
  lines: Array<{ accountId?: string; amountCents?: number; dimensions?: Record<string, string> }> | undefined,
  accounts: ChartAccount[],
  fallback: { id: string; name: string },
  usable: (a: ChartAccount) => boolean
): LineAccountWeight[] | undefined {
  if (!Array.isArray(lines) || lines.length === 0) return undefined;
  return lines.map(line => {
    const key = String(line.accountId || '').trim();
    const account = key ? accounts.find(a => a.id === key) || accounts.find(a => (a.name || '').toLowerCase() === key.toLowerCase()) : undefined;
    // the line's labels (BF-09), without empty ones
    const labels = Object.fromEntries(Object.entries(line.dimensions || {})
      .filter(([k, v]) => k && typeof v === 'string' && v.trim() !== '').map(([k, v]) => [k, v.trim()]));
    return {
      account: account && usable(account) ? { id: account.id, name: account.name } : fallback,
      weightCents: Number(line.amountCents) || 0,
      ...(Object.keys(labels).length > 0 ? { dimensions: labels } : {}),
    };
  });
}

/**
 * Send transactions array to Server API endpoint (/api/v1/transactions/bulk) atomically.
 */
export async function postTxsServerApi(
  txs: PostableTransaction[], 
  workspaceId: string, 
  entityMutation?: EntityMutation, 
  context?: LedgerPostContext
) {
  if ((!txs || txs.length === 0) && !entityMutation) return;

  // Server-side bypass: if context has a bypassPost flag or if we are executing server-side,
  // we can return or process directly. But in default environments:
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
    body: JSON.stringify({ transactions: txs, workspaceId, entityMutation })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Server rejected transaction posting');
  }
  if (Array.isArray(data.warnings)) data.warnings.forEach((w: unknown) => toast.warning(String(w)));

  // Immediately update client Zustand store state if available
  try {
    const store = useLedgerStore.getState();
    if (store && store.setTransactions) {
      const currentTxs = store.transactions || [];
      store.setTransactions([...(txs as unknown as Transaction[]), ...currentTxs]);
    }
  } catch (e) {
    // Fallback if useLedgerStore or DOM APIs are unavailable (e.g. Server-Side Execution)
  }
}
