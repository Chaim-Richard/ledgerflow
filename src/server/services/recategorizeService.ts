import type { Firestore } from '../db/firestore';
import { FieldValue } from '../db/firestore';
import { assertPostingOpen, workspaceRole } from '../../lib/periodLock';
import { isCashAccount } from '../../lib/txFilters';
import type { ChartAccount, Transaction } from '../../types';
import { writeServerAuditLog } from './auditLogService';
import { isUpdatedAtMismatch } from '../routes/transactions/helpers';

/**
 * Recategorize entries (D-3 / K-39 rule actions; the contract AI #4 asked for): move the
 * non-bank side of bank entries to another account of the workspace. For each entry the caller
 * names its bank account; that must be a bank/cash account with a line on the entry. Every other
 * line is moved to the new account; amounts, currencies and rates, the bank lines and everything
 * else stay as they are. Moving to a bank account makes the entry a transfer (`isTransfer`,
 * `transferDetails`); moving to any other account clears both, on the entry and its lines.
 *
 * Writers only (owner, accountant, bookkeeper); the period lock applies to each entry's date; void
 * and certified entries are refused; `expectedUpdatedAt` catches an entry changed meanwhile. All
 * entries change in one database transaction or none do, with one audit line.
 */
export class RecategorizeError extends Error {
  constructor(readonly status: number, message: string, readonly entryId?: string) { super(message); }
}

export interface Recategorization { id: string; bankAccountId: string; toAccountId: string; expectedUpdatedAt?: string }

export const MAX_RECATEGORIZE = 500;
const WRITERS = ['owner', 'accountant', 'bookkeeper'];

/** The entry's lines with the non-bank side moved to `to`; pure (also used by tests). */
export function recategorizedLines(entry: Pick<Transaction, 'lines'>, bankAccountId: string, to: Pick<ChartAccount, 'id' | 'name'>, transfer: boolean) {
  return (entry.lines || []).map(line => {
    if (line.accountId === bankAccountId) return line;
    const moved: Record<string, unknown> = { ...line, accountId: to.id, accountName: to.name };
    if (transfer) moved.isTransfer = true;
    else delete moved.isTransfer;
    return moved;
  });
}

export async function recategorize(db: Firestore, input: { workspaceId: string; uid: string; email?: string; changes: Recategorization[] }) {
  const { workspaceId, uid, changes } = input;
  if (!changes.length) throw new RecategorizeError(400, 'Nothing to change');
  if (changes.length > MAX_RECATEGORIZE) throw new RecategorizeError(400, `At most ${MAX_RECATEGORIZE} entries at a time`);
  if (new Set(changes.map(c => c.id)).size !== changes.length) throw new RecategorizeError(400, 'The same entry is listed twice');

  return db.runTransaction(async t => {
    const ws = (await t.get(db.collection('workspaces').doc(workspaceId))).data();
    if (!ws) throw new RecategorizeError(404, 'Workspace not found');
    if (!WRITERS.includes(workspaceRole(ws as never, uid))) throw new RecategorizeError(403, 'Only owners, accountants and bookkeepers change entries');

    const accountIds = [...new Set(changes.flatMap(c => [c.bankAccountId, c.toAccountId]))];
    const accountSnaps = await t.getAll(...accountIds.map(id => db.collection('chartAccounts').doc(id)));
    const accounts = new Map<string, ChartAccount>();
    accountSnaps.forEach(s => { const a = s.data() as ChartAccount | undefined; if (a && a.workspaceId === workspaceId) accounts.set(s.id, { ...a, id: s.id }); });

    const entrySnaps = await t.getAll(...changes.map(c => db.collection('transactions').doc(c.id)));
    const writes: Array<{ ref: (typeof entrySnaps)[number]['ref']; data: Record<string, unknown> }> = [];
    changes.forEach((change, i) => {
      const snap = entrySnaps[i];
      const entry = snap.data() as Transaction | undefined;
      if (!entry || entry.workspaceId !== workspaceId) throw new RecategorizeError(404, `Entry ${change.id} is not in this workspace`, change.id);
      if (entry.status === 'void' || entry.status === 'certified') throw new RecategorizeError(409, `Entry ${change.id} is ${entry.status} and cannot change`, change.id);
      if (isUpdatedAtMismatch(change.expectedUpdatedAt, entry.updatedAt)) throw new RecategorizeError(409, `Entry ${change.id} was changed by someone else; reload and try again`, change.id);
      try { assertPostingOpen(entry.date, ws as never, uid); } catch (err) { throw new RecategorizeError(409, `Entry ${change.id}: ${err instanceof Error ? err.message : String(err)}`, change.id); }

      const bank = accounts.get(change.bankAccountId);
      if (!bank || !isCashAccount(bank)) throw new RecategorizeError(400, `Entry ${change.id}: the bank account named is not a bank or cash account of this workspace`, change.id);
      if (!(entry.lines || []).some(l => l.accountId === bank.id)) throw new RecategorizeError(400, `Entry ${change.id} has no line on ${bank.name}`, change.id);
      const to = accounts.get(change.toAccountId);
      if (!to || to.isArchived || to.archived) throw new RecategorizeError(400, `Entry ${change.id}: choose an active account of this workspace`, change.id);
      if (to.id === bank.id) throw new RecategorizeError(400, `Entry ${change.id}: the new account is its own bank account`, change.id);
      if (!(entry.lines || []).some(l => l.accountId !== bank.id)) throw new RecategorizeError(400, `Entry ${change.id} has nothing besides its bank lines`, change.id);

      const transfer = isCashAccount(to);
      const amountOnBank = (entry.lines || []).filter(l => l.accountId === bank.id).reduce((s, l) => s + (l.amountCents || 0), 0);
      writes.push({
        ref: snap.ref,
        data: {
          lines: recategorizedLines(entry, bank.id, to, transfer),
          ...(transfer
            ? { isTransfer: true, transferDetails: amountOnBank < 0 ? { fromAccountId: bank.id, toAccountId: to.id } : { fromAccountId: to.id, toAccountId: bank.id } }
            : { isTransfer: FieldValue.delete(), transferDetails: FieldValue.delete() }),
          updatedAt: new Date().toISOString(),
        },
      });
    });

    for (const w of writes) t.update(w.ref, w.data);
    const toNames = [...new Set(changes.map(c => accounts.get(c.toAccountId)?.name || c.toAccountId))];
    await writeServerAuditLog({
      workspaceId, uid, email: input.email, action: 'TRANSACTIONS_RECATEGORIZED', entityType: 'transactions', entityId: changes[0].id,
      details: { description: `Moved ${changes.length} ${changes.length === 1 ? 'entry' : 'entries'} to ${toNames.join(', ')}`, ids: changes.map(c => c.id), changes },
    }, { db, tx: t });
    return { changed: writes.length };
  });
}
