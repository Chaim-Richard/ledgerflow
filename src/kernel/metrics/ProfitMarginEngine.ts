export class ProfitMarginEngine {
  /**
   * Calculates Pre-Tax Profit Margin.
   * Pre-Tax Margin = Earnings Before Tax (EBT) / Revenue
   */
  static calculatePreTaxMargin(ebt: number, revenue: number): number {
    if (revenue === 0) return 0;
    return ebt / revenue;
  }
}
