import { normalizeSearchText } from './textNormalization';
import { Transaction } from '../types';

/**
 * Generates search tokens from text fields for indexing and server-side fast matching.
 */
export function generateSearchTokens(...texts: (string | undefined | null)[]): string[] {
  const tokenSet = new Set<string>();

  for (const text of texts) {
    if (!text) continue;
    const words = normalizeSearchText(text).replace(/[^\p{L}\p{M}\p{N}\s]/gu, '').split(/\s+/);
    for (const word of words) {
      if (word.length >= 2) {
        tokenSet.add(word);
        // Add prefix tokens for prefix matching
        for (let i = 2; i <= word.length; i++) {
          tokenSet.add(word.substring(0, i));
        }
      }
    }
  }

  return Array.from(tokenSet);
}

/**
 * Filter transactions by search query matching payee, description, and line notes.
 */
export function searchTransactions(transactions: Transaction[], query: string): Transaction[] {
  if (!query || !query.trim()) return transactions;
  const qLower = normalizeSearchText(query).trim();

  return transactions.filter(tx => {
    if (normalizeSearchText(tx.description).includes(qLower)) return true;
    if (normalizeSearchText(tx.payee).includes(qLower)) return true;
    if (normalizeSearchText(tx.id).includes(qLower)) return true;
    if (tx.totalAmountCents.toString().includes(qLower)) return true;
    if (tx.lines?.some(l => normalizeSearchText(l.accountName).includes(qLower) || normalizeSearchText(l.description).includes(qLower))) return true;
    return false;
  });
}
