export class EquityMultiplierEngine {
  /**
   * Calculates Equity Multiplier.
   * EM = Total Assets / Total Shareholders' Equity
   */
  static calculateEquityMultiplier(totalAssets: number, totalEquity: number): number {
    if (totalEquity === 0) return Infinity;
    return totalAssets / totalEquity;
  }
}
