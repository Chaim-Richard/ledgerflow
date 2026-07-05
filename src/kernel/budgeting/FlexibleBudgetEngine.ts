export class FlexibleBudgetEngine {
  /**
   * Calculates flexible budget allowance for overhead.
   * Total Allowance = Fixed Cost + (Variable Rate * Actual Activity Level)
   */
  static calculateFlexibleBudget(fixedCostsCents: number, variableRatePerUnitCents: number, actualUnits: number): number {
    return fixedCostsCents + (variableRatePerUnitCents * actualUnits);
  }
}
