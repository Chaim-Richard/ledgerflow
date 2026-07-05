export class LiquidityEngine {
  /**
   * Calculates the Current Ratio (Current Assets / Current Liabilities).
   */
  static calculateCurrentRatio(currentAssetsCents: number, currentLiabilitiesCents: number): number {
    if (currentLiabilitiesCents === 0) return Infinity; // Prevent division by zero
    return currentAssetsCents / currentLiabilitiesCents;
  }

  /**
   * Calculates the Quick Ratio (Cash & Equivalents + Marketable Securities + A/R) / Current Liabilities
   */
  static calculateQuickRatio(liquidAssetsCents: number, currentLiabilitiesCents: number): number {
    if (currentLiabilitiesCents === 0) return Infinity;
    return liquidAssetsCents / currentLiabilitiesCents;
  }

  /**
   * Calculates Working Capital
   */
  static calculateWorkingCapital(currentAssetsCents: number, currentLiabilitiesCents: number): number {
    return currentAssetsCents - currentLiabilitiesCents;
  }
}
