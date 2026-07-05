export class DiscountFactorEngine {
  /**
   * Calculates the Discount Factor (DF) for a given rate and period.
   * DF = 1 / (1 + r)^n
   */
  static calculateDiscountFactor(rate: number, period: number): number {
    return 1 / Math.pow(1 + rate, period);
  }

  /**
   * Calculates the Present Value of an Annuity factor (PVIFA).
   */
  static calculatePVIFA(rate: number, periods: number): number {
    if (rate === 0) return periods;
    return (1 - Math.pow(1 + rate, -periods)) / rate;
  }
}
