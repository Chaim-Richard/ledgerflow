export class BookValueEngine {
  /**
   * Calculates Book Value Per Share (BVPS).
   * BVPS = (Total Equity - Preferred Equity) / Common Shares Outstanding
   */
  static calculateBVPS(totalEquity: number, preferredEquity: number, sharesOutstanding: number): number {
    if (sharesOutstanding === 0) return 0;
    return (totalEquity - preferredEquity) / sharesOutstanding;
  }
}
