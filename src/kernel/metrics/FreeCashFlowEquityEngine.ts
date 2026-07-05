export class FreeCashFlowEquityEngine {
  /**
   * Calculates Free Cash Flow to Equity (FCFE).
   * FCFE = Net Income + Non-Cash Charges - Working Capital Inv - Fixed Capital Inv + Net Borrowing
   */
  static calculateFCFE(netIncome: number, nonCashCharges: number, workingCapitalInv: number, fixedCapitalInv: number, netBorrowing: number): number {
    return netIncome + nonCashCharges - workingCapitalInv - fixedCapitalInv + netBorrowing;
  }
}
