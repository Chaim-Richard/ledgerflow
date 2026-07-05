export class RetentionRatioEngine {
  /**
   * Calculates the Retention Ratio (Plowback Ratio).
   * Retention Ratio = (Net Income - Dividends) / Net Income
   */
  static calculateRetentionRatio(netIncome: number, dividends: number): number {
    if (netIncome === 0) return 0;
    return (netIncome - dividends) / netIncome;
  }
}
