export class PricingEngine {
  /**
   * Calculates selling price based on cost plus markup percentage.
   */
  static calculateCostPlusPricing(costCents: number, markupPercentage: number): number {
    return Math.round(costCents * (1 + markupPercentage / 100));
  }

  /**
   * Calculates selling price based on target gross margin percentage.
   */
  static calculateTargetMarginPricing(costCents: number, marginPercentage: number): number {
    if (marginPercentage >= 100) throw new Error("Margin cannot be 100% or greater");
    return Math.round(costCents / (1 - marginPercentage / 100));
  }
}
