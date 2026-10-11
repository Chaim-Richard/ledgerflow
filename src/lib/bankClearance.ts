/**
 * Bank clearance summary (CB-24): for one bank account, each entry on it in a period and whether the
 * bank has cleared it (a matched bank line, dated the day it cleared; or the entry marked
 * reconciled), and, at the end of the period, what is still outstanding: money in not yet on the
 * statement and money out not yet taken. The book balance less the deposits outstanding plus the
 * payments outstanding is what the bank should show.
 */
import type { BankStatementLine, Transaction } from '../types';
import { isPostable, lineAmount } from './txFilters';
import { reversedTransactionIds } from './postingCheck';

export interface ClearanceRow {
  id: string;
  date: string;
  description: string;
  /** on this account: positive in, negative out */
  amountCents: number;
  /** the bank line's day, or '' when marked reconciled without one; null when not cleared */
  clearedOn: string | null;
}

export interface ClearanceSummary {
  rows: ClearanceRow[];
  bookBalanceCents: number;
  outstandingInCents: number;
  outstandingOutCents: number;
  /** what the bank should show at the end: book − deposits outstanding + payments outstanding */
  bankBalanceCents: number;
}

export function bankClearance(accountId: string, transactions: Transaction[], bankLines: BankStatementLine[], from: string, to: string): ClearanceSummary {
  const reversed = reversedTransactionIds(transactions);
  const clearedBy = new Map<string, string>();
  for (const l of bankLines) {
    if (l.status !== 'matched' || !l.matchedTransactionId) continue;
    const day = String(l.date || '').slice(0, 10);
    const before = clearedBy.get(l.matchedTransactionId);
    if (!before || day < before) clearedBy.set(l.matchedTransactionId, day);
  }
  const live = transactions.filter(t => isPostable(t) && !reversed.has(t.id) && !t.metadata?.isReversal && !t.reversalEventId);
  const onAccount = live.flatMap(t => {
    const cents = (t.lines || []).filter(l => l.accountId === accountId).reduce((s, l) => s + lineAmount(l, t), 0);
    if (cents === 0) return [];
    const clearedOn = clearedBy.get(t.id) ?? (t.status === 'reconciled' ? '' : null);
    return [{ id: t.id, date: String(t.date || '').slice(0, 10), description: String(t.description || ''), amountCents: cents, clearedOn }];
  });
  const upToEnd = onAccount.filter(r => r.date <= to);
  // outstanding at the end: not cleared, or cleared only after it
  const outstanding = upToEnd.filter(r => r.clearedOn === null || (r.clearedOn !== '' && r.clearedOn > to));
  const bookBalanceCents = upToEnd.reduce((s, r) => s + r.amountCents, 0);
  const outstandingInCents = outstanding.filter(r => r.amountCents > 0).reduce((s, r) => s + r.amountCents, 0);
  const outstandingOutCents = -outstanding.filter(r => r.amountCents < 0).reduce((s, r) => s + r.amountCents, 0);
  return {
    rows: upToEnd.filter(r => r.date >= from).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    bookBalanceCents, outstandingInCents, outstandingOutCents,
    bankBalanceCents: bookBalanceCents - outstandingInCents + outstandingOutCents,
  };
}
