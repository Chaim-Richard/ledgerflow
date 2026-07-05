export class EoqEngine {
  /**
   * Calculates the Economic Order Quantity (EOQ).
   * EOQ = sqrt((2 * Demand * Ordering Cost) / Holding Cost)
   */
  static calculateEOQ(annualDemand: number, costPerOrder: number, annualHoldingCostPerUnit: number): number {
    if (annualHoldingCostPerUnit <= 0) return Infinity;
    return Math.sqrt((2 * annualDemand * costPerOrder) / annualHoldingCostPerUnit);
  }

  /**
   * Calculates the Reorder Point.
   */
  static calculateReorderPoint(leadTimeDemand: number, safetyStock: number): number {
    return leadTimeDemand + safetyStock;
  }
}
