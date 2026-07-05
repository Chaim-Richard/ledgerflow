export class QuickRatioEngine {
  /**
   * Strict Quick Ratio = (Cash + Cash Equivalents) / Current Liabilities
   */
  static calculateStrictQuickRatio(cashAndEquivalents: number, currentLiabilities: number): number {
    if (currentLiabilities === 0) return Infinity;
    return cashAndEquivalents / currentLiabilities;
  }
}
