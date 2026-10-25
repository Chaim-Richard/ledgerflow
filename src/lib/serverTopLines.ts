/**
 * L-123 step 4a: screens that list single transaction lines (not totals) while the loaded list is capped. A list of
 * the largest lines over a range cannot be built from per-account sums, and the capped list (newest first) may miss
 * lines dated on or before its oldest loaded day, so the whole list is read from the server
 * (GET /api/v1/balances/top-lines, `topLinesOver` in src/server/services/balanceService.ts).
 */
import type { Transaction } from '../types';
import type { TopLineItem } from './reportGenerators';
import { isPostable, transactionDate } from './txFilters';

export interface TopLines { topExpenses: TopLineItem[]; topIncome: TopLineItem[] }
export interface ServerTopLines extends TopLines { workspaceId: string; from: string; to: string; limit: number }

/**
 * Whether the loaded list may be missing lines of a range starting `from`: it is capped, and the range starts on or
 * before the oldest loaded day (`openingCutoff`). A range with no start reaches back to the first entry.
 */
export function linesNeedServer(capped: boolean, cutoff: string, from: string | undefined): boolean {
  return capped && !!cutoff && (!from || from <= cutoff);
}

/** A cheap signature (FNV-1a) of the loaded entries dated `from` on: id, update time, whether it posts, status, date, metadata, lines. */
export function rangeRevision(transactions: Transaction[], from: string): string {
  let h = 0x811c9dc5;
  const mix = (text: string) => { for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } };
  for (const tx of transactions) {
    if (!tx || typeof tx !== 'object' || transactionDate(tx) < from) continue;
    mix(`${tx.id}|${isPostable(tx) ? 'p' : 'n'}|${String((tx as { updatedAt?: unknown }).updatedAt ?? '')}|${tx.status}|${tx.date}|${tx.description ?? ''}|${tx.payee ?? ''}|`);
    mix(JSON.stringify([tx.metadata ?? null, tx.lines || []]));
  }
  return (h >>> 0).toString(36);
}
