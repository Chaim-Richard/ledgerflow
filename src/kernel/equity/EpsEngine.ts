export class EpsEngine {
  /**
   * Calculates Basic Earnings Per Share (EPS).
   * EPS = (Net Income - Preferred Dividends) / Weighted Average Shares Outstanding
   */
  static calculateBasicEPS(netIncome: number, preferredDividends: number, weightedAverageShares: number): number {
    if (weightedAverageShares === 0) return 0;
    return (netIncome - preferredDividends) / weightedAverageShares;
  }

  /**
   * Calculates Diluted Earnings Per Share (EPS).
   */
  static calculateDilutedEPS(netIncome: number, preferredDividends: number, weightedAverageShares: number, dilutiveShares: number): number {
    const totalShares = weightedAverageShares + dilutiveShares;
    if (totalShares === 0) return 0;
    return (netIncome - preferredDividends) / totalShares;
  }
}
