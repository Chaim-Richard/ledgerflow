/**
 * L94-STEP2B: entries that name a document (an invoice's cost of goods, a credit note's return) are made by the server's
 * own posting, never sent by the browser to /transactions/bulk. Tests of what the shared commit does with them
 * (stock moves, the delivery guard) call it as the server does — ledgerBulkCommit.ts — and get the status and body the
 * route would answer with.
 */
import type { Firestore } from '../../server/db/pgFirestore';
import { BulkRefusal, commitLedgerBulk, type BulkRequest } from '../../server/services/ledgerBulkCommit';
import { LedgerPostingError } from '../../server/services/cogsStockService';

export async function commitAsServer(db: Firestore, uid: string, request: BulkRequest, idempotencyKey?: string): Promise<{ status: number; body: Record<string, any> }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    // a copy, as a request body is: the commit fills fields of the entries it is given (their owner, workspace)
    const { body } = await commitLedgerBulk(db as never, { uid }, JSON.parse(JSON.stringify(request)), { idempotencyKey });
    return { status: 200, body };
  } catch (e) {
    if (e instanceof BulkRefusal) return { status: e.status, body: e.body };
    return { status: e instanceof LedgerPostingError ? e.status : 400, body: { error: e instanceof Error ? e.message : String(e) } };
  }
}
