export class EnterpriseValueEngine {
  /**
   * Calculates Enterprise Value (EV).
   * EV = Market Capitalization + Total Debt - Cash and Cash Equivalents
   */
  static calculateEV(marketCap: number, totalDebt: number, cashAndEquivalents: number): number {
    return marketCap + totalDebt - cashAndEquivalents;
  }
}
