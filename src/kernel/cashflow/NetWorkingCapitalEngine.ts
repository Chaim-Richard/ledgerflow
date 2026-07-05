export class NetWorkingCapitalEngine {
  /**
   * Calculates Net Working Capital (NWC).
   * NWC = Current Assets - Current Liabilities
   */
  static calculateNWC(currentAssets: number, currentLiabilities: number): number {
    return currentAssets - currentLiabilities;
  }
}
