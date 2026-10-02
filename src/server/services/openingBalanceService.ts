import type { Firestore } from '../db/firestore';
import { FieldValue } from '../db/firestore';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import { isOpeningBalanceEquity, OPENING_BALANCE_TYPE, openingEntry, type OpeningEntry } from '../../lib/openingBalances';
import { workspaceRole } from '../../lib/periodLock';
import type { ChartAccount } from '../../types';
import { writeServerAuditLog } from './auditLogService';

/**
 * First-run setup (L-19, BO-03): post the opening balances as one balanced entry and mark the
 * workspace's setup as done; or mark it done without balances ("start from zero"). Owners and
 * accountants; one database transaction with the audit entry. Opening balances are recorded
 * once: to change them, reverse the entry in the ledger and enter them again.
 */

export class SetupError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'SetupError';
  }
}

const SETUP_ROLES = ['owner', 'accountant'];
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export interface OpeningBalancesInput {
  workspaceId: string;
  uid: string;
  email?: string;
  date: string;
  balances: Array<{ accountId: string; amountCents: number }>;
}

export async function recordOpeningBalances(db: Firestore, input: OpeningBalancesInput): Promise<OpeningEntry & { transactionId: string | null }> {
  if (!DAY.test(input.date)) throw new SetupError(400, 'The start date must be YYYY-MM-DD');
  const wsRef = db.collection('workspaces').doc(input.workspaceId);
  return db.runTransaction(async (t) => {
    const workspace = (await t.get(wsRef)).data();
    if (!workspace) throw new SetupError(404, 'Workspace not found');
    if (!SETUP_ROLES.includes(workspaceRole(workspace, input.uid))) throw new SetupError(403, 'Only owners and accountants set up the books');
    const accounts = (await t.get(db.collection('chartAccounts').where('workspaceId', '==', input.workspaceId))).docs.map(d => ({ ...d.data(), id: d.id }) as ChartAccount);
    const equity = accounts.find(a => isOpeningBalanceEquity(a) && !a.isArchived);
    if (!equity) throw new SetupError(400, 'Add an "Opening Balance Equity" account (equity) to the chart of accounts first');

    const existing = (await t.get(db.collection('transactions').where('workspaceId', '==', input.workspaceId).where('metadata.type', '==', OPENING_BALANCE_TYPE))).docs
      .map(d => d.data()).filter(tx => !tx.reversalEventId && tx.status !== 'void');
    if (existing.length) throw new SetupError(409, 'Opening balances are already recorded. To change them, reverse that entry in the ledger first.');

    let entry: OpeningEntry;
    try {
      entry = openingEntry(accounts, input.balances, equity);
    } catch (err) {
      throw new SetupError(400, err instanceof Error ? err.message : String(err));
    }

    let transactionId: string | null = null;
    if (entry.lines.length) {
      let prepared;
      try {
        prepared = await TransactionValidator.validateAndPrepare({
          id: db.collection('transactions').doc().id, workspaceId: input.workspaceId, uid: input.uid,
          date: input.date, description: 'Opening balances', currency: workspace.currency || 'USD', exchangeRate: 1,
          status: 'completed', type: 'actual', lines: entry.lines, metadata: { type: OPENING_BALANCE_TYPE },
        }, { workspaceId: input.workspaceId, user: { uid: input.uid }, wsData: workspace }, undefined, t);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new SetupError(/Period Locked/i.test(message) ? 409 : 400, message);
      }
      t.create(db.collection('transactions').doc(prepared.id), { ...prepared, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transactionId = prepared.id;
    }
    const now = new Date().toISOString();
    t.update(wsRef, { setupCompletedAt: now, openingBalanceDate: input.date, updatedAt: now });
    await writeServerAuditLog({
      workspaceId: input.workspaceId, uid: input.uid, email: input.email || '', action: 'OPENING_BALANCES_RECORDED',
      entityType: 'workspace', entityId: input.workspaceId,
      details: { description: `Opening balances on ${input.date}: ${entry.lines.length} lines, ${entry.equityCents} cents to Opening Balance Equity`, transactionId },
    }, { db, tx: t });
    return { ...entry, transactionId };
  });
}

/** "Start from zero" / "Skip": setup done without opening balances. */
export async function completeSetup(db: Firestore, input: { workspaceId: string; uid: string }): Promise<void> {
  const ref = db.collection('workspaces').doc(input.workspaceId);
  const workspace = (await ref.get()).data();
  if (!workspace) throw new SetupError(404, 'Workspace not found');
  if (!SETUP_ROLES.includes(workspaceRole(workspace, input.uid))) throw new SetupError(403, 'Only owners and accountants set up the books');
  if (!workspace.setupCompletedAt) await ref.update({ setupCompletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}
