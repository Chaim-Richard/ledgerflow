export class OcfEngine {
  /**
   * Calculates Operating Cash Flow (OCF) using the indirect method.
   * OCF = Net Income + Non-Cash Expenses - Increase in Working Capital
   */
  static calculateOCF(netIncome: number, nonCashExpenses: number, increaseInWorkingCapital: number): number {
    return netIncome + nonCashExpenses - increaseInWorkingCapital;
  }

  /**
   * Calculates Free Cash Flow to Firm (FCFF).
   * FCFF = OCF - Capital Expenditures
   */
  static calculateFCFF(ocf: number, capex: number): number {
    return ocf - capex;
  }
}
