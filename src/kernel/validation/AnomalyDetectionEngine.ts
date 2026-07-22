import { Transaction } from '../../types';

export class AnomalyDetectionEngine {
  /**
   * Detects transactions that are statistical outliers based on historical mean and standard deviation.
   */
  static detectAmountOutliers(transactions: Transaction[], zScoreThreshold: number = 3.5): (Transaction & { zScore: number })[] {
    if (transactions.length < 2) return [];

    const amounts = transactions.map(tx => tx.totalAmountCents).sort((a, b) => a - b);
    
    // Calculate Median
    const getMedian = (arr: number[]) => {
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };
    const median = getMedian(amounts);

    // Calculate MAD (Median Absolute Deviation)
    const absoluteDeviations = amounts.map(amount => Math.abs(amount - median)).sort((a, b) => a - b);
    const mad = getMedian(absoluteDeviations);

    if (mad === 0) return []; // Cannot compute modified z-score if MAD is 0

    const anomalies: (Transaction & { zScore: number })[] = [];
    for (const tx of transactions) {
        // Modified Z-Score Formula: 0.6745 * (x - median) / MAD
        const zScore = (0.6745 * Math.abs(tx.totalAmountCents - median)) / mad;
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
