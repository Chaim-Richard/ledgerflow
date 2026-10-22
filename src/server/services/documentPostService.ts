import crypto from 'crypto';
import type { Firestore } from '../db/firestore';
import type { RequestUser } from '../auth/requestUser';
import { postInvoiceLedger } from '../../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../../services/ledgerPost/billPosting';
import { postCreditNoteLedger, postVendorCreditLedger } from '../../services/ledgerPost/creditPosting';
import { deletePostings } from '../../services/ledgerPost/deletePostings';
import { isPostable } from '../../lib/txFilters';
import type { EntityMutation, LedgerPostContext } from '../../services/ledgerPost/postingCore';
import type { Bill, CreditNote, Invoice, Transaction, VendorCredit } from '../../types';
import { DOCUMENT_ENTRY_KEY, loadPostingContext, todayIn } from './postingContextLoader';
import { assertPostingOpen } from '../../lib/periodLock';
import { BulkRefusal, commitLedgerBulk } from './ledgerBulkCommit';

/**
 * L-94 step 2 (docs/design/L-94-server-postings.md): an invoice or bill is saved and its entries are built **here**,
 * from the document and what the database holds (the chart, the workspace's mappings and closing date, the document's
 * earlier entries to reverse, the stock it sells), by the same builders the browser used (postingCore, no browser
 * code). The browser sends only the document; it cannot send or change entry lines. The save then goes through the
 * very same commit as POST /transactions/bulk (ledgerBulkCommit.ts): role and closing date at commit, the
 * idempotency key, one live posting per document (INT-2 — a save built from entries that changed meanwhile is
 * refused with 409, never posted twice), the order limit, stock moves, the schema and approval, in ONE transaction.
 * L94-STEP2B: credit notes and vendor credits too, and deleting any of the four (its live entries reversed, built here).
 */
export type PostedDocumentType = 'invoices' | 'bills' | 'creditNotes' | 'vendorCredits';

const NAMES: Record<PostedDocumentType, string> = { invoices: 'invoice', bills: 'bill', creditNotes: 'credit note', vendorCredits: 'vendor credit' };

export interface DocumentPostInput {
  collection: PostedDocumentType;
  docId: string;
  workspaceId: string;
  action: 'create' | 'update' | 'delete';
  /** create: the whole document; update: the changed fields; delete: nothing */
  data: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface DocumentPostResult {
  body: Record<string, unknown>;
  /** the entries as written (empty for a replay or a document that posts nothing) */
  transactions: Transaction[];
  cogsPendingReason?: string;
}

export async function postDocument(db: Firestore, user: RequestUser, input: DocumentPostInput): Promise<DocumentPostResult> {
  const { collection, docId, workspaceId, action } = input;
  const hashOf = { collection, docId, workspaceId, action, data: input.data };
  const mutationOf = (data?: Record<string, unknown>): EntityMutation => ({ collection, docId, action, ...(data ? { data } : {}) });

  if (user.developerWorkspaceId && user.developerWorkspaceId !== workspaceId) {
    throw new BulkRefusal(403, { error: `Forbidden: API key is scoped strictly to workspace ${user.developerWorkspaceId}` });
  }
  const workspace = (await db.collection('workspaces').doc(workspaceId).get()).data();
  if (!workspace || (workspace.uid !== user.uid && !(Array.isArray(workspace.members) && workspace.members.includes(user.uid)) && !user.admin)) {
    throw new BulkRefusal(403, { error: 'Not a member' });
  }
  // the same key again: the first answer (or 409 for another request under that key), decided by the commit
  if (input.idempotencyKey && (await db.collection('idempotencyKeys').doc(`${workspaceId}_${input.idempotencyKey}`).get()).exists) {
    const { body } = await commitLedgerBulk(db, user, { workspaceId, entityMutation: mutationOf(input.data) }, { idempotencyKey: input.idempotencyKey, hashOf });
    return { body, transactions: [] };
  }

  const existing = (await db.collection(collection).doc(docId).get()).data();
  if (existing && existing.workspaceId !== workspaceId) throw new BulkRefusal(403, { error: `Forbidden: Entity ${docId} does not belong to authorized workspace.` });
  // as /transactions/bulk: the save merges into what is saved (an update of a document not saved yet makes it); a
  // second live posting of the same document is refused at commit (INT-2)

  const document: Record<string, unknown> = { ...(existing || {}), ...(action === 'delete' ? {} : input.data), id: docId, workspaceId };
  // the closing date with the server's own rule (a reopened day included), as the browser checked it before sending: a
  // save by the document's date; a delete by the date of each entry it reverses. The entries' dates are checked again at commit
  const context: LedgerPostContext = await loadPostingContext(db, { workspaceId, uid: user.uid, collection, docId, document, workspace, lockChecked: true });
  const key = DOCUMENT_ENTRY_KEY[collection];
  const dates = action === 'delete'
    ? (context.transactions || []).filter(tx => tx.metadata?.[key] === docId && isPostable(tx) && !tx.metadata?.isReversal).map(tx => String(tx.date))
    : [String(document.date || todayIn(workspace.timezone as string | undefined))];
  try {
    for (const date of dates) assertPostingOpen(date, workspace as never, user.uid);
  } catch (err) {
    throw new BulkRefusal(409, { error: err instanceof Error ? err.message : String(err) });
  }
  const mutation = mutationOf(action === 'delete' ? undefined : input.data);
  let cogsPendingReason: string | undefined;
  try {
    if (action === 'delete') await deletePostings(docId, key as 'invoiceId', workspaceId, mutation, context);
    else if (collection === 'invoices') cogsPendingReason = (await postInvoiceLedger(docId, document as Partial<Invoice>, workspaceId, user.uid, mutation, context)).cogsPendingReason;
    else if (collection === 'bills') await postBillLedger(docId, document as Partial<Bill>, workspaceId, user.uid, mutation, context);
    else if (collection === 'creditNotes') await postCreditNoteLedger(docId, document as Partial<CreditNote>, workspaceId, user.uid, mutation, context);
    else await postVendorCreditLedger(docId, document as Partial<VendorCredit>, workspaceId, user.uid, mutation, context);
  } catch (err) {
    throw new BulkRefusal(400, { error: err instanceof Error ? err.message : String(err) });
  }
  const captured = context.capture || [];
  if (captured.length !== 1) throw new BulkRefusal(500, { error: `The ${NAMES[collection]} could not be posted (built ${captured.length} saves)` });
  const transactions = captured[0].txs.map(tx => ({ ...tx, id: tx.id || crypto.randomUUID() })) as unknown as Transaction[];
  const result = await commitLedgerBulk(db, user, { workspaceId, transactions, entityMutation: captured[0].entityMutation || mutation }, { idempotencyKey: input.idempotencyKey, hashOf });
  return { body: result.body, transactions: result.committed && !result.body.replayed ? result.transactions : [], ...(cogsPendingReason ? { cogsPendingReason } : {}) };
}
