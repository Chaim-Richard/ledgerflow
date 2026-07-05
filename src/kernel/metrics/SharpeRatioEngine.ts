export class SharpeRatioEngine {
  /**
   * Calculates the Sharpe Ratio.
   * Sharpe = (Portfolio Return - Risk Free Rate) / Standard Deviation of Portfolio Return
   */
  static calculateSharpeRatio(portfolioReturn: number, riskFreeRate: number, standardDeviation: number): number {
    if (standardDeviation === 0) return Infinity;
    return (portfolioReturn - riskFreeRate) / standardDeviation;
  }
}
