/**
 * CE-06: review flags for transfers between a workspace's own bank/cash accounts.
 * A one-sided statement match is evidence of missing *confirmation*, not proof
 * that money failed to arrive. Neither guesses matching pairs nor posts entries.
 */
import type { BankStatementLine, ChartAccount, Transaction } from '../types';
import { isPostable, isTransferTransaction, lineAmount } from './txFilters';
import { resolveAccountRole } from './accountUtils';
import { reversedTransactionIds } from './postingCheck';
import { validCustomReportPeriod } from './reportCustomPeriod';

export type TransferIssueKind = 'one-bank-side-matched' | 'one-ledger-side' | 'unequal-cash-lines';
export interface TransferIssue {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  fromAccount: string;
  toAccount: string;
  kind: TransferIssueKind;
  status: string;
}
export function oneSidedTransfers(accounts: readonly ChartAccount[], transactions: readonly Transaction[], bankLines: readonly BankStatementLine[], asOf: string): TransferIssue[] {
  if (!validCustomReportPeriod({ startDate: asOf, endDate: asOf })) throw new Error('Choose a valid end date.');
  const banks = new Map(accounts.filter(a => !a.isArchived && resolveAccountRole(a) === 'cash').map(a => [a.id, a.name]));
  const reversed = reversedTransactionIds([...transactions]);
  const byTx = new Map<string, Set<string>>();
  for (const line of bankLines) {
    if (line.status !== 'matched' || !line.matchedTransactionId || !line.accountId || line.date.slice(0, 10) > asOf || !banks.has(line.accountId)) continue;
    const matched = byTx.get(line.matchedTransactionId) || new Set<string>();
    matched.add(line.accountId); byTx.set(line.matchedTransactionId, matched);
  }
  const issues: TransferIssue[] = [];
  for (const tx of transactions) {
    if (!isPostable(tx) || !isTransferTransaction(tx) || reversed.has(tx.id) || tx.reversalEventId || tx.metadata?.isReversal || tx.date.slice(0, 10) > asOf) continue;
    const amounts = new Map<string, number>();
    for (const line of tx.lines || []) if (banks.has(line.accountId))
      amounts.set(line.accountId, (amounts.get(line.accountId) || 0) + lineAmount(line, tx));
    const cash = [...amounts].filter(([, cents]) => cents !== 0);
    if (cash.length === 0) continue;
    const outgoing = cash.filter(([, cents]) => cents < 0), incoming = cash.filter(([, cents]) => cents > 0);
    const from = outgoing[0]?.[0] || tx.transferDetails?.fromAccountId || '';
    const to = incoming[0]?.[0] || tx.transferDetails?.toAccountId || '';
    const amountCents = outgoing.length ? -outgoing.reduce((sum, [, cents]) => sum + cents, 0)
      : incoming.reduce((sum, [, cents]) => sum + cents, 0);
    let kind: TransferIssueKind | null = null, status = '';
    if (outgoing.length === 0 || incoming.length === 0) {
      kind = 'one-ledger-side';
      status = 'Only one bank/cash side appears on the posted ledger entry. Review in-transit and counterpart accounts.';
    } else if (Math.abs(outgoing.reduce((sum, [, n]) => sum + n, 0)) !== incoming.reduce((sum, [, n]) => sum + n, 0)) {
      kind = 'unequal-cash-lines';
      status = 'The bank/cash sides do not net to zero in base currency. Review exchange and clearing entries.';
    } else {
      const matched = byTx.get(tx.id) || new Set<string>();
      const hasOut = outgoing.some(([id]) => matched.has(id));
      const hasIn = incoming.some(([id]) => matched.has(id));
      if (hasOut !== hasIn) {
        kind = 'one-bank-side-matched';
        status = hasOut ? 'Outgoing side has a matched statement line; incoming side not confirmed.' : 'Incoming side has a matched statement line; outgoing side not confirmed.';
      }
    }
    if (kind) issues.push({ id: tx.id, date: tx.date.slice(0, 10), description: tx.description, amountCents, fromAccount: banks.get(from) || from || 'Unknown', toAccount: banks.get(to) || to || 'Unknown', kind, status });
  }
  return issues.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
