import type { Firestore } from '../db/firestore';
import { logger } from '../utils/logger';
import { postInvoiceLedger } from '../../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../../services/ledgerPost/billPosting';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from '../../services/ledgerPost/postingCore';
import type { Bill, ChartAccount, InventoryItem, Invoice, Transaction, Workspace } from '../../types';

/**
 * L-94 step 1 (shadow): after an invoice or bill save commits, the server rebuilds the entries the browser sent
 * with the same builder (postingCore, no browser code) from what is in the database, and compares them: the same
 * dates, accounts, amounts and labels. A difference is logged, never refused yet — the logs of the first testers
 * show whether the browser and the server ever disagree before step 1 starts refusing
 * (docs/design/L-94-server-postings.md). It never changes the save, and its own failure is only logged.
 */
export interface ShadowCheckInput {
  workspaceId: string;
  uid: string;
  mutation: EntityMutation;
  /** the entries this request wrote, as written */
  posted: Array<Pick<Transaction, 'id' | 'date' | 'lines'>>;
}

export type ShadowCheckResult = { checked: false; reason: string } | { checked: true; matched: boolean; expected: string[]; sent: string[] };

const DOCUMENT_KEY: Record<string, 'invoiceId' | 'billId'> = { invoices: 'invoiceId', bills: 'billId' };

/** The workspace's today (YYYY-MM-DD) in its time zone, else UTC. */
function todayIn(timezone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = (type: string) => parts.find(p => p.type === type)?.value;
    if (get('year') && get('month') && get('day')) return `${get('year')}-${get('month')}-${get('day')}`;
  } catch { /* an unknown time zone: UTC below */ }
  return new Date().toISOString().slice(0, 10);
}

/** One comparable row per entry line: date, account, cents and labels (order of lines and entries ignored). */
export function postingFingerprint(txs: Array<Pick<Transaction, 'date' | 'lines'> | PostableTransaction>): string[] {
  return txs.flatMap(tx => (tx.lines || []).map(line => {
    const labels = Object.entries((line as { dimensions?: Record<string, string> }).dimensions || {}).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b));
    return `${String(tx.date || '').slice(0, 10)}|${line.accountId}|${line.amountCents}|${JSON.stringify(labels)}`;
  })).sort();
}

export async function shadowCheckDocumentPosting(db: Firestore, input: ShadowCheckInput): Promise<ShadowCheckResult> {
  const { workspaceId, uid, mutation, posted } = input;
  const key = DOCUMENT_KEY[mutation.collection];
  if (!key || (mutation.action !== 'create' && mutation.action !== 'update')) return { checked: false, reason: 'not an invoice or bill save' };

  const [docSnap, wsSnap, chart, entries] = await Promise.all([
    db.collection(mutation.collection).doc(mutation.docId).get(),
    db.collection('workspaces').doc(workspaceId).get(),
    db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get(),
    db.collection('transactions').where('workspaceId', '==', workspaceId).where(`metadata.${key}`, '==', mutation.docId).get(),
  ]);
  const document = docSnap.data();
  const workspace = wsSnap.data();
  if (!document || !workspace) return { checked: false, reason: 'document or workspace not found' };

  // the document's entries as they were before this request: everything except what it just wrote
  const postedIds = new Set(posted.map(tx => tx.id));
  const before = entries.docs.map(d => ({ ...d.data(), id: d.id }) as Transaction).filter(tx => !postedIds.has(tx.id));

  // the stock items an invoice sells, for its cost of goods
  const itemIds = mutation.collection === 'invoices'
    ? [...new Set(((document.items || []) as Array<{ itemId?: string }>).map(l => l.itemId).filter((id): id is string => Boolean(id)))]
    : [];
  const inventory = (await Promise.all(itemIds.map(async id => {
    const snap = await db.collection('inventory').doc(id).get();
    const item = snap.data();
    return item && item.workspaceId === workspaceId ? ({ ...item, id } as InventoryItem) : null;
  }))).filter((i): i is InventoryItem => i !== null);

  const context: LedgerPostContext = {
    accounts: chart.docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount),
    workspaces: [{ ...workspace, id: workspaceId } as Workspace],
    transactions: before,
    inventory,
    // the save already passed the server's own period check; the builder must not refuse it again
    lockDate: null,
    uid,
    today: todayIn(workspace.timezone as string | undefined),
    capture: [],
  };
  const data = { ...document, id: mutation.docId };
  if (mutation.collection === 'invoices') await postInvoiceLedger(mutation.docId, data as Partial<Invoice>, workspaceId, uid, mutation, context);
  else await postBillLedger(mutation.docId, data as Partial<Bill>, workspaceId, uid, mutation, context);

  const expected = postingFingerprint(context.capture!.flatMap(c => c.txs));
  const sent = postingFingerprint(posted);
  return { checked: true, matched: JSON.stringify(expected) === JSON.stringify(sent), expected, sent };
}

/** Runs the shadow check and logs what it found; never throws (the save has already committed). */
export async function logShadowCheck(db: Firestore, input: ShadowCheckInput): Promise<void> {
  try {
    const result = await shadowCheckDocumentPosting(db, input);
    if (!result.checked) return;
    if (result.matched) {
      logger.info('L-94 shadow: the server rebuilt the same entries', { workspaceId: input.workspaceId, collection: input.mutation.collection, docId: input.mutation.docId, lines: result.sent.length });
      return;
    }
    const missing = result.expected.filter(r => !result.sent.includes(r));
    const extra = result.sent.filter(r => !result.expected.includes(r));
    logger.warn('L-94 shadow: the browser sent other entries than the server rebuilt', {
      workspaceId: input.workspaceId, collection: input.mutation.collection, docId: input.mutation.docId, uid: input.uid,
      missingOnBrowser: missing.slice(0, 20), extraFromBrowser: extra.slice(0, 20),
    });
  } catch (err) {
    logger.warn('L-94 shadow: could not rebuild the entries', { workspaceId: input.workspaceId, collection: input.mutation.collection, docId: input.mutation.docId, error: err instanceof Error ? err.message : String(err) });
  }
}
