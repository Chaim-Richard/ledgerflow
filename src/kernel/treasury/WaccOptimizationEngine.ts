export class WaccOptimizationEngine {
  /**
   * Finds the debt weight that minimizes WACC, given an array of scenarios.
   */
  static findOptimalCapitalStructure(scenarios: { debtWeight: number, costOfEquity: number, costOfDebt: number, taxRate: number }[]): { optimalDebtWeight: number, minWacc: number } {
    let minWacc = Infinity;
    let optimalDebtWeight = 0;

    for (const s of scenarios) {
      const equityWeight = 1 - s.debtWeight;
      const wacc = (equityWeight * s.costOfEquity) + (s.debtWeight * s.costOfDebt * (1 - s.taxRate));
      if (wacc < minWacc) {
        minWacc = wacc;
        optimalDebtWeight = s.debtWeight;
      }
    }

    return { optimalDebtWeight, minWacc };
  }
}
