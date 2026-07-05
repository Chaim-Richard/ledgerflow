export class SustainableGrowthRateEngine {
  /**
   * Calculates Sustainable Growth Rate (SGR).
   * SGR = ROE * Retention Ratio
   */
  static calculateSGR(roe: number, retentionRatio: number): number {
    return roe * retentionRatio;
  }
}
