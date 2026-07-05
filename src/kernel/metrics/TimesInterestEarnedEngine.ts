export class TimesInterestEarnedEngine {
  /**
   * Calculates Times Interest Earned (TIE) Ratio.
   * TIE = EBIT / Interest Expense
   */
  static calculateTIE(ebit: number, interestExpense: number): number {
    if (interestExpense === 0) return Infinity;
    return ebit / interestExpense;
  }
}
