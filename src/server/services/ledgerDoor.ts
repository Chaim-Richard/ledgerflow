/**
 * AU-6, one door to the ledger. Every server write of a ledger entry (a `transactions` record)
 * should go through `ledgerWrite`, which checks what every entry must satisfy wherever it comes
 * from: it belongs to a workspace, its lines balance (debits = credits) in whole cents, and its
 * total matches its lines. Writers still outside the door are counted by the bug-pattern scanner
 * (`server-direct-ledger-write`), and `src/tests/bug-patterns.test.ts` refuses any new one, so the
 * count only goes down as writers move here.
 */
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';
import type { Transaction } from '../../types';

export class LedgerDoorError extends Error {
  status = 400;
}

/** Throws a LedgerDoorError when a full entry could not be a valid ledger entry. */
export function checkLedgerEntry(entry: Record<string, unknown>): void {
  if (typeof entry.workspaceId !== 'string' || !entry.workspaceId) throw new LedgerDoorError('A ledger entry needs its workspace');
  const lines = entry.lines as Array<{ amountCents?: unknown }> | undefined;
  if (!Array.isArray(lines) || lines.length === 0) return; // header-only records (drafts, voids) carry no lines
  for (const l of lines) {
    if (!Number.isInteger(l.amountCents)) throw new LedgerDoorError('Ledger amounts are whole cents');
  }
  DoubleEntryValidator.validateJournalEntry(entry as unknown as Transaction);
  const debits = lines.reduce((sum, l) => sum + Math.max(0, Number(l.amountCents)), 0);
  const total = entry.totalAmountCents;
  if (typeof total === 'number' && total !== 0 && Math.abs(total) !== debits) {
    throw new LedgerDoorError(`The entry total (${total}) does not match its lines (${debits})`);
  }
}

interface Writable { set(ref: unknown, data: Record<string, unknown>, options?: unknown): unknown }
interface RefLike { set(data: Record<string, unknown>, options?: unknown): Promise<unknown> }

/** Checks a full ledger entry, then writes it — inside a transaction `t` when given. */
export async function ledgerWrite(t: Writable | null, ref: RefLike, entry: Record<string, unknown>): Promise<void> {
  checkLedgerEntry(entry);
  if (t) t.set(ref, entry);
  else await ref.set(entry);
}

interface Creatable { create(ref: unknown, data: Record<string, unknown>): unknown }

/** Checks a new ledger entry, then creates it inside the transaction `t` (fails if it exists). */
export function ledgerCreate(t: Creatable, ref: unknown, entry: Record<string, unknown>): void {
  checkLedgerEntry(entry);
  t.create(ref, entry);
}

/** The header fields a posted entry may change after posting; amounts and lines never change in place. */
export const LEDGER_MARK_FIELDS = new Set(['status', 'voidedReason', 'voidedAt', 'reversalEventId', 'updatedAt']);

interface Updatable { update(ref: unknown, data: Record<string, unknown>): unknown }

/** Marks an existing entry (void, reversed by…) inside `t`; refuses any change to its amounts or lines. */
export function ledgerMark(t: Updatable, ref: unknown, patch: Record<string, unknown>): void {
  for (const key of Object.keys(patch)) {
    if (!LEDGER_MARK_FIELDS.has(key)) throw new LedgerDoorError(`A posted entry cannot change "${key}" in place; post a correcting entry instead`);
  }
  t.update(ref, patch);
}
