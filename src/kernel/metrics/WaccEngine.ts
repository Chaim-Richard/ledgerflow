export class WaccEngine {
  /**
   * Calculates the Weighted Average Cost of Capital (WACC).
   * E = Market value of the firm's equity
   * D = Market value of the firm's debt
   * V = E + D
   * Re = Cost of equity
   * Rd = Cost of debt
   * T = Corporate tax rate
   */
  static calculateWACC(equityValue: number, debtValue: number, costOfEquity: number, costOfDebt: number, taxRate: number): number {
    const totalValue = equityValue + debtValue;
    if (totalValue === 0) return 0;
    
    const equityWeight = equityValue / totalValue;
    const debtWeight = debtValue / totalValue;
    
    return (equityWeight * costOfEquity) + (debtWeight * costOfDebt * (1 - taxRate));
  }
}
