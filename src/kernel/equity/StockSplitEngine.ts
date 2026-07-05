export class StockSplitEngine {
  /**
   * Calculates new share count and par value after a stock split (e.g. 2 for 1).
   */
  static calculateSplit(currentShares: number, currentParValue: number, splitRatioNumerator: number, splitRatioDenominator: number): { newShares: number, newParValue: number } {
    const factor = splitRatioNumerator / splitRatioDenominator;
    return {
      newShares: currentShares * factor,
      newParValue: currentParValue / factor
    };
  }
}
