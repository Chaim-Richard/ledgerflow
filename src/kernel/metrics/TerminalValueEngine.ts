export class TerminalValueEngine {
  /**
   * Calculates the Terminal Value using the Gordon Growth Model (Perpetuity Growth Model).
   * TV = (FCF * (1 + g)) / (WACC - g)
   */
  static calculateGordonGrowthTV(finalYearFCF: number, perpetualGrowthRate: number, wacc: number): number {
    if (wacc <= perpetualGrowthRate) throw new Error("WACC must be greater than the perpetual growth rate.");
    return (finalYearFCF * (1 + perpetualGrowthRate)) / (wacc - perpetualGrowthRate);
  }

  /**
   * Calculates the Terminal Value using the Exit Multiple Method.
   * TV = Financial Metric (e.g. EBITDA) * Exit Multiple
   */
  static calculateExitMultipleTV(metricAmount: number, exitMultiple: number): number {
    return metricAmount * exitMultiple;
  }
}
