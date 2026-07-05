export class CostVolumeProfitEngine {
  /**
   * Calculates Target Profit in Units.
   */
  static calculateTargetProfitUnits(fixedCosts: number, targetProfit: number, pricePerUnit: number, variableCostPerUnit: number): number {
    const cm = pricePerUnit - variableCostPerUnit;
    if (cm <= 0) return Infinity;
    return Math.ceil((fixedCosts + targetProfit) / cm);
  }

  /**
   * Calculates Degree of Operating Leverage (DOL) = Contribution Margin / Operating Income
   */
  static calculateOperatingLeverage(sales: number, variableCosts: number, fixedCosts: number): number {
    const cm = sales - variableCosts;
    const operatingIncome = cm - fixedCosts;
    if (operatingIncome === 0) return Infinity;
    return cm / operatingIncome;
  }
}
