export class LtvEngine {
  /**
   * Calculates Loan-to-Value (LTV) Ratio.
   */
  static calculateLTV(loanAmount: number, appraisedValue: number): number {
    if (appraisedValue === 0) return Infinity;
    return loanAmount / appraisedValue;
  }
}
