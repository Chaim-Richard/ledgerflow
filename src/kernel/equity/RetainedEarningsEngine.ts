export class RetainedEarningsEngine {
  /**
   * Calculates Ending Retained Earnings.
   * Ending RE = Beginning RE + Net Income - Dividends
   */
  static calculateEndingRetainedEarnings(beginningRE: number, netIncome: number, dividends: number): number {
    return beginningRE + netIncome - dividends;
  }
}
