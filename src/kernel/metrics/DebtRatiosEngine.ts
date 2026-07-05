export class DebtRatiosEngine {
  /**
   * Calculates Debt-to-Equity Ratio = Total Liabilities / Total Shareholders' Equity
   */
  static calculateDebtToEquity(totalLiabilities: number, totalEquity: number): number {
    if (totalEquity === 0) return Infinity;
    return totalLiabilities / totalEquity;
  }

  /**
   * Calculates Debt Ratio = Total Liabilities / Total Assets
   */
  static calculateDebtRatio(totalLiabilities: number, totalAssets: number): number {
    if (totalAssets === 0) return 0;
    return totalLiabilities / totalAssets;
  }

  /**
   * Calculates Interest Coverage Ratio = EBIT / Interest Expense
   */
  static calculateInterestCoverage(ebit: number, interestExpense: number): number {
    if (interestExpense === 0) return Infinity;
    return ebit / interestExpense;
  }
}
