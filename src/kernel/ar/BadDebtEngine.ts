export class BadDebtEngine {
  /**
   * Calculates the Allowance for Doubtful Accounts using the Percentage of Receivables method.
   */
  static calculateAllowanceForDoubtfulAccounts(totalAccountsReceivable: number, estimatedUncollectiblePercentage: number): number {
    return Math.round(totalAccountsReceivable * (estimatedUncollectiblePercentage / 100));
  }

  /**
   * Calculates Bad Debt Expense required to adjust the current allowance.
   */
  static calculateBadDebtExpense(targetAllowance: number, currentAllowanceBalance: number): number {
    return targetAllowance - currentAllowanceBalance;
  }
}
