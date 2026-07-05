export class HedgingEngine {
  /**
   * Calculates the required forward contract size to fully hedge a foreign currency exposure.
   */
  static calculateForwardHedge(exposureForeignAmount: number, forwardRate: number): number {
    return exposureForeignAmount * forwardRate;
  }

  /**
   * Calculates the mark-to-market (MTM) value of an existing forward contract.
   */
  static calculateMTM(contractedForwardRate: number, currentForwardRate: number, notionalForeignAmount: number): number {
    // If you bought foreign currency forward, you gain if the current forward rate is higher.
    return (currentForwardRate - contractedForwardRate) * notionalForeignAmount;
  }

  /**
   * Calculates effective exchange rate achieved via an options collar (Call strike + Put strike).
   */
  static calculateCollarEffectiveRate(spotRate: number, floorRate: number, capRate: number): number {
    if (spotRate < floorRate) return floorRate;
    if (spotRate > capRate) return capRate;
    return spotRate;
  }
}
