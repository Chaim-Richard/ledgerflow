export class PriceMultiplesEngine {
  /**
   * Calculates Price-to-Earnings (P/E) Ratio.
   */
  static calculatePERatio(pricePerShare: number, earningsPerShare: number): number {
    if (earningsPerShare <= 0) return NaN; // Meaningless if EPS is zero or negative
    return pricePerShare / earningsPerShare;
  }

  /**
   * Calculates Price-to-Book (P/B) Ratio.
   */
  static calculatePBRatio(pricePerShare: number, bookValuePerShare: number): number {
    if (bookValuePerShare <= 0) return NaN;
    return pricePerShare / bookValuePerShare;
  }

  /**
   * Calculates Dividend Yield.
   */
  static calculateDividendYield(annualDividendPerShare: number, pricePerShare: number): number {
    if (pricePerShare === 0) return 0;
    return annualDividendPerShare / pricePerShare;
  }
}
