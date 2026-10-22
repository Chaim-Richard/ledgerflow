import type { Firestore } from '../db/firestore';
import { logger } from '../utils/logger';
import { postInvoiceLedger } from '../../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../../services/ledgerPost/billPosting';
import { postCreditNoteLedger, postVendorCreditLedger } from '../../services/ledgerPost/creditPosting';
import { loadPostingContext } from './postingContextLoader';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from '../../services/ledgerPost/postingCore';
import type { Transaction } from '../../types';

/**
 * L-94 step 1 (shadow): after an invoice, bill, credit note or vendor credit save commits (L94-SHADOW-MORE added the
 * last two; payments are not posted by the browser — POST /payments builds their entries on the server), the server rebuilds the entries the browser sent
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
  /** the day the browser counted as today for this save (it dates reversals into a closed period) */
  postingDay?: unknown;
}

const DAY_MS = 86_400_000;

/**
 * The day to rebuild with: the browser's, when it is a real date within one day of the server's own today (near
 * midnight a browser in another time zone is a day apart; that is not a difference in the entries); else the server's.
 */
export function agreedPostingDay(serverToday: string, browserDay: unknown): string {
  if (typeof browserDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(browserDay)) return serverToday;
  const gap = Math.abs(Date.parse(`${browserDay}T00:00:00Z`) - Date.parse(`${serverToday}T00:00:00Z`));
  return Number.isFinite(gap) && gap <= DAY_MS ? browserDay : serverToday;
}

export type ShadowCheckResult = { checked: false; reason: string } | { checked: true; matched: boolean; expected: string[]; sent: string[] };

type Builder = (id: string, data: Record<string, unknown>, workspaceId: string, uid: string, mutation: EntityMutation, context: LedgerPostContext) => Promise<unknown>;

/** Each document the browser posts through /transactions/bulk (its allowlist): the metadata key its entries carry and its builder. */
export const DOCUMENT_BUILDERS: Record<string, { key: string; post: Builder }> = {
  invoices: { key: 'invoiceId', post: (id, data, ws, uid, m, c) => postInvoiceLedger(id, data, ws, uid, m, c) },
  bills: { key: 'billId', post: (id, data, ws, uid, m, c) => postBillLedger(id, data, ws, uid, m, c) },
  creditNotes: { key: 'creditNoteId', post: (id, data, ws, uid, m, c) => postCreditNoteLedger(id, data, ws, uid, m, c) },
  vendorCredits: { key: 'vendorCreditId', post: (id, data, ws, uid, m, c) => postVendorCreditLedger(id, data, ws, uid, m, c) },
};

/** One comparable row per entry line: date, account, cents and labels (order of lines and entries ignored). */
export function postingFingerprint(txs: Array<Pick<Transaction, 'date' | 'lines'> | PostableTransaction>): string[] {
  return txs.flatMap(tx => (tx.lines || []).map(line => {
    const labels = Object.entries((line as { dimensions?: Record<string, string> }).dimensions || {}).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b));
    return `${String(tx.date || '').slice(0, 10)}|${line.accountId}|${line.amountCents}|${JSON.stringify(labels)}`;
  })).sort();
}

export async function shadowCheckDocumentPosting(db: Firestore, input: ShadowCheckInput): Promise<ShadowCheckResult> {
  const { workspaceId, uid, mutation, posted } = input;
  const builder = DOCUMENT_BUILDERS[mutation.collection];
  if (!builder || (mutation.action !== 'create' && mutation.action !== 'update')) return { checked: false, reason: 'not a save of a document that posts' };

  const [docSnap, wsSnap] = await Promise.all([
    db.collection(mutation.collection).doc(mutation.docId).get(),
    db.collection('workspaces').doc(workspaceId).get(),
  ]);
  const document = docSnap.data();
  const workspace = wsSnap.data();
  if (!document || !workspace) return { checked: false, reason: 'document or workspace not found' };

  // the document's entries as they were before this request (everything except what it just wrote); the save already
  // passed the server's own period check, so the builder must not refuse it again
  const context = await loadPostingContext(db, { workspaceId, uid, collection: mutation.collection, docId: mutation.docId, document, workspace, exclude: new Set(posted.map(tx => tx.id)), lockChecked: true });
  context.today = agreedPostingDay(context.today || new Date().toISOString().slice(0, 10), input.postingDay);
  await builder.post(mutation.docId, { ...document, id: mutation.docId }, workspaceId, uid, mutation, context);

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
