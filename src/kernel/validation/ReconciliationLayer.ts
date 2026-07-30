import { parseLocalDate } from "../../lib/utils";
export interface ReconciliationState {
  accountId: string;
  bookBalanceCents: number;
  bankBalanceCents: number;
  differenceCents: number;
  status: 'RECONCILED' | 'PARTIALLY_RECONCILED' | 'UNRECONCILED' | 'STALE';
  lastReconciledAt?: string;
}

export class ReconciliationLayer {
  static getReconciliationStatus(
    accountId: string,
    bookBalanceCents: number,
    bankBalanceCents: number,
    lastReconciledAt?: string
  ): ReconciliationState {
    const differenceCents = bookBalanceCents - bankBalanceCents;
    let status: 'RECONCILED' | 'PARTIALLY_RECONCILED' | 'UNRECONCILED' | 'STALE' = 'UNRECONCILED';

    if (differenceCents === 0 && bookBalanceCents !== 0) {
      status = 'RECONCILED';
    } else if (Math.abs(differenceCents) > 0 && Math.abs(differenceCents) < Math.abs(bookBalanceCents * 0.1)) {
      status = 'PARTIALLY_RECONCILED';
    }

    if (lastReconciledAt) {
      const daysSinceReconciliation = (new Date().getTime() - new Date(lastReconciledAt).getTime()) / (1000 * 3600 * 24);
      if (daysSinceReconciliation > 30) {
        status = 'STALE';
      }
    }

    return {
      accountId,
      bookBalanceCents,
      bankBalanceCents,
      differenceCents,
      status,
      lastReconciledAt: lastReconciledAt || new Date().toISOString()
    };
  }

  static suggestMatches(
    bankTransactions: { id: string; amountCents: number; date: string }[],
    bookTransactions: { id: string; amountCents: number; date: string }[]
  ): Array<{ bankTxId: string; bookTxId: string; confidence: number }> {
    const matches: Array<{ bankTxId: string; bookTxId: string; confidence: number }> = [];

    bankTransactions.forEach(bankTx => {
      bookTransactions.forEach(bookTx => {
        let confidence = 0;
        
        // Exact amount match is strongest signal
        if (bankTx.amountCents === bookTx.amountCents) {
          confidence += 0.6;
          
          const daysDiff = Math.abs((parseLocalDate(bankTx.date).getTime() - parseLocalDate(bookTx.date).getTime()) / (1000 * 3600 * 24));
          
          if (daysDiff === 0) confidence += 0.4;
          else if (daysDiff <= 3) confidence += 0.2;
          else if (daysDiff <= 7) confidence += 0.1;
        }

        if (confidence > 0.5) {
          matches.push({ bankTxId: bankTx.id, bookTxId: bookTx.id, confidence });
        }
      });
    });

    // Sort by highest confidence
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}
