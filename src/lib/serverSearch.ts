import { Transaction } from '../types';

/**
 * Generates search tokens from text fields for indexing and server-side fast matching.
 */
export function generateSearchTokens(...texts: (string | undefined | null)[]): string[] {
  const tokenSet = new Set<string>();

  for (const text of texts) {
    if (!text) continue;
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
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
  const qLower = query.toLowerCase().trim();

  return transactions.filter(tx => {
    if (tx.description?.toLowerCase().includes(qLower)) return true;
    if (tx.payee?.toLowerCase().includes(qLower)) return true;
    if (tx.id.toLowerCase().includes(qLower)) return true;
    if (tx.totalAmountCents.toString().includes(qLower)) return true;
    if (tx.lines?.some(l => l.accountName?.toLowerCase().includes(qLower) || l.description?.toLowerCase().includes(qLower))) return true;
    return false;
  });
}
