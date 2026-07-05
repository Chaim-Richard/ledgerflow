export class BreakEvenEngine {
  /**
   * Calculates the break-even point in units.
   */
  static calculateBreakEvenUnits(fixedCostsCents: number, pricePerUnitCents: number, variableCostPerUnitCents: number): number {
    const contributionMargin = pricePerUnitCents - variableCostPerUnitCents;
    if (contributionMargin <= 0) return Infinity; // Cannot break even
    return Math.ceil(fixedCostsCents / contributionMargin);
  }

  /**
   * Calculates the margin of safety (Sales - Break Even Sales)
   */
  static calculateMarginOfSafety(actualSalesUnits: number, breakEvenUnits: number): number {
    return actualSalesUnits - breakEvenUnits;
  }
}
