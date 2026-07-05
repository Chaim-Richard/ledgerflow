export class AltmanZScoreEngine {
  /**
   * Calculates the Altman Z-Score for public manufacturing companies.
   * Z = 1.2A + 1.4B + 3.3C + 0.6D + 1.0E
   * A = Working Capital / Total Assets
   * B = Retained Earnings / Total Assets
   * C = EBIT / Total Assets
   * D = Market Value of Equity / Book Value of Total Liabilities
   * E = Sales / Total Assets
   */
  static calculatePublicManufacturingZScore(
    workingCapital: number,
    retainedEarnings: number,
    ebit: number,
    marketValueEquity: number,
    totalLiabilities: number,
    sales: number,
    totalAssets: number
  ): number {
    if (totalAssets === 0 || totalLiabilities === 0) return 0;
    
    const A = workingCapital / totalAssets;
    const B = retainedEarnings / totalAssets;
    const C = ebit / totalAssets;
    const D = marketValueEquity / totalLiabilities;
    const E = sales / totalAssets;

    return (1.2 * A) + (1.4 * B) + (3.3 * C) + (0.6 * D) + (1.0 * E);
  }
}
