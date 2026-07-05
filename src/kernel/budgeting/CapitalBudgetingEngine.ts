export class CapitalBudgetingEngine {
  /**
   * Calculates the Payback Period in years based on uniform cash flows.
   */
  static calculatePaybackPeriod(initialInvestment: number, annualCashFlow: number): number {
    if (annualCashFlow <= 0) return Infinity;
    return initialInvestment / annualCashFlow;
  }

  /**
   * Calculates the Profitability Index (PI).
   */
  static calculateProfitabilityIndex(presentValueOfFutureCashFlows: number, initialInvestment: number): number {
    if (initialInvestment === 0) return Infinity;
    return presentValueOfFutureCashFlows / initialInvestment;
  }
}
