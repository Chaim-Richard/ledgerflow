import { Transaction } from '../types';

export interface ReceiptMatchTarget {
  id: string;
  vendorName: string;
  date: string;
  totalAmountCents: number;
}

export interface MatchScoreResult {
  transaction: Transaction;
  score: number; // 0.0 - 1.0
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

/**
 * Scores and identifies matching transactions for an ingested document or receipt.
 */
export function scoreReceiptMatches(
  receipt: ReceiptMatchTarget,
  candidates: Transaction[]
): MatchScoreResult[] {
  const results: MatchScoreResult[] = [];

  const receiptDateMs = new Date(receipt.date).getTime();

  for (const tx of candidates) {
    if (tx.deletedAt || tx.status === 'void') continue;

    let points = 0;
    const reasons: string[] = [];

    // Exact amount match (+50 points)
    if (tx.totalAmountCents === receipt.totalAmountCents) {
      points += 50;
      reasons.push('Exact amount match');
    }

    // Date proximity match (+30 points for same day, +20 for within 3 days)
    const txDateMs = new Date(tx.date).getTime();
    const diffDays = Math.abs((txDateMs - receiptDateMs) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      points += 30;
      reasons.push('Same date');
    } else if (diffDays <= 3) {
      points += 20;
      reasons.push(`Date within ${Math.round(diffDays)} day(s)`);
    }

    // Vendor / Description match (+20 points)
    const descLower = (tx.description || '').toLowerCase();
    const vendorLower = (receipt.vendorName || '').toLowerCase();

    if (vendorLower && descLower && (descLower.includes(vendorLower) || vendorLower.includes(descLower))) {
      points += 20;
      reasons.push('Vendor/Merchant name match');
    }

    const score = Math.min(1.0, points / 100);
    const confidence = score >= 0.8 ? 'high' : (score >= 0.5 ? 'medium' : 'low');

    if (score >= 0.4) {
      results.push({
        transaction: tx,
        score,
        confidence,
        reasons
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
