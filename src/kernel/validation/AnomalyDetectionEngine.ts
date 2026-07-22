import { Transaction } from '../../types';

export class AnomalyDetectionEngine {
  /**
   * Detects transactions that are statistical outliers based on historical mean and standard deviation.
   */
  static detectAmountOutliers(transactions: Transaction[], zScoreThreshold: number = 3.0): (Transaction & { zScore: number })[] {
    if (transactions.length < 2) return [];

    const amounts = transactions.map(tx => tx.totalAmountCents);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return []; // All amounts are the same

    const anomalies: (Transaction & { zScore: number })[] = [];
    for (const tx of transactions) {
        const zScore = Math.abs(tx.totalAmountCents - mean) / stdDev;
        if (zScore > zScoreThreshold) {
            anomalies.push({ ...tx, zScore });
        }
    }
    return anomalies;
  }

  /**
   * Detects duplicate transaction references.
   */
  static detectDuplicateReferences(transactions: Transaction[]): Transaction[] {
    const seenRefs = new Set<string>();
    const duplicates: Transaction[] = [];

    for (const tx of transactions) {
      const ref = tx.metadata?.reference;
      if (ref) {
        if (seenRefs.has(ref)) {
          duplicates.push(tx);
        } else {
          seenRefs.add(ref);
        }
      }
    }
    return duplicates;
  }
}
