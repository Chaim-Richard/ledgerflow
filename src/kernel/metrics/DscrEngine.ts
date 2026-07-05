export class DscrEngine {
  /**
   * Calculates Debt Service Coverage Ratio (DSCR).
   * DSCR = Net Operating Income / Total Debt Service
   */
  static calculateDSCR(netOperatingIncome: number, totalDebtService: number): number {
    if (totalDebtService === 0) return Infinity;
    return netOperatingIncome / totalDebtService;
  }
}
