export class RuleOf72Engine {
  /**
   * Calculates approximate years to double an investment using the Rule of 72.
   * Rate should be a whole number percentage (e.g. 8 for 8%).
   */
  static calculateYearsToDouble(annualInterestRatePercentage: number): number {
    if (annualInterestRatePercentage <= 0) return Infinity;
    return 72 / annualInterestRatePercentage;
  }
}
