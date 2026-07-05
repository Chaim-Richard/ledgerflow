export class EarningsYieldEngine {
  /**
   * Calculates Earnings Yield.
   * Earnings Yield = EPS / Stock Price
   */
  static calculateEarningsYield(eps: number, stockPrice: number): number {
    if (stockPrice === 0) return 0;
    return eps / stockPrice;
  }
}
