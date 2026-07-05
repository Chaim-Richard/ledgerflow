export class BonusEngine {
  /**
   * Calculates a performance bonus based on achieving a target.
   */
  static calculatePerformanceBonus(actualMetric: number, targetMetric: number, baseBonusCents: number, payoutMultiplier: number = 1.0): number {
    if (actualMetric < targetMetric) return 0;
    const overagePercentage = (actualMetric - targetMetric) / targetMetric;
    return Math.round(baseBonusCents + (baseBonusCents * overagePercentage * payoutMultiplier));
  }
}
