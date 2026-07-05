export class TreynorRatioEngine {
  /**
   * Calculates the Treynor Ratio.
   * Treynor = (Portfolio Return - Risk Free Rate) / Beta
   */
  static calculateTreynorRatio(portfolioReturn: number, riskFreeRate: number, portfolioBeta: number): number {
    if (portfolioBeta === 0) return Infinity;
    return (portfolioReturn - riskFreeRate) / portfolioBeta;
  }
}
