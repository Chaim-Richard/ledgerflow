export class FinancialRatiosEngine {
  /**
   * Gross Profit Margin = (Revenue - COGS) / Revenue
   */
  static calculateGrossMargin(revenueCents: number, cogsCents: number): number {
    if (revenueCents === 0) return 0;
    return (revenueCents - cogsCents) / revenueCents;
  }

  /**
   * Net Profit Margin = Net Income / Revenue
   */
  static calculateNetMargin(netIncomeCents: number, revenueCents: number): number {
    if (revenueCents === 0) return 0;
    return netIncomeCents / revenueCents;
  }

  /**
   * Return on Assets (ROA) = Net Income / Total Assets
   */
  static calculateROA(netIncomeCents: number, totalAssetsCents: number): number {
    if (totalAssetsCents === 0) return 0;
    return netIncomeCents / totalAssetsCents;
  }

  /**
   * Return on Equity (ROE) = Net Income / Shareholder's Equity
   */
  static calculateROE(netIncomeCents: number, totalEquityCents: number): number {
    if (totalEquityCents === 0) return 0;
    return netIncomeCents / totalEquityCents;
  }
}
