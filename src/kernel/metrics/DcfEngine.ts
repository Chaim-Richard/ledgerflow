export class DcfEngine {
  /**
   * Calculates the Firm Value using Discounted Cash Flow (DCF) analysis.
   */
  static calculateFirmValue(cashFlows: number[], wacc: number, terminalValue: number, numPeriods: number): number {
    let firmValue = 0;
    
    // Discount explicit forecast period cash flows
    for (let t = 1; t <= cashFlows.length; t++) {
       firmValue += cashFlows[t - 1] / Math.pow(1 + wacc, t);
    }
    
    // Discount terminal value (discounted back from the final period)
    const discountedTV = terminalValue / Math.pow(1 + wacc, numPeriods);
    
    return firmValue + discountedTV;
  }
}
