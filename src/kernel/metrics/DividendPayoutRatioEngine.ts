export class DividendPayoutRatioEngine {
  /**
   * Calculates the Dividend Payout Ratio.
   * DPR = Total Dividends / Net Income
   */
  static calculateDividendPayoutRatio(totalDividends: number, netIncome: number): number {
    if (netIncome === 0) return 0;
    return totalDividends / netIncome;
  }
}
