export class VarianceEngine {
  /**
   * Calculates absolute and percentage variance between actuals and budget.
   */
  static calculateVariance(actualCents: number, budgetCents: number): { absoluteVariance: number, percentageVariance: number, isFavorable: boolean } {
    const absoluteVariance = actualCents - budgetCents;
    const percentageVariance = budgetCents === 0 ? 0 : (absoluteVariance / budgetCents) * 100;
    
    // For expenses, negative variance (actual < budget) is favorable.
    // For income, positive variance (actual > budget) is favorable.
    // This assumes actuals are absolute numbers. Let's return just the math, caller decides if favorable.
    // Assuming standard expense model for now:
    const isFavorable = absoluteVariance <= 0;

    return {
      absoluteVariance,
      percentageVariance,
      isFavorable
    };
  }

  static analyzeTrend(variances: number[]): 'IMPROVING' | 'WORSENING' | 'STABLE' {
    if (variances.length < 2) return 'STABLE';
    const recent = variances[variances.length - 1];
    const previous = variances[variances.length - 2];
    
    // Using simple delta
    if (recent < previous) return 'IMPROVING'; // Lower variance usually better for costs
    if (recent > previous) return 'WORSENING';
    return 'STABLE';
  }
}
