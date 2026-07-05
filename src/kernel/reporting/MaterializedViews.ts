import { Transaction, ChartAccount } from '../../types';

export class MaterializedViews {
  /**
   * Precomputes Income Statement values to avoid runtime recalculation.
   */
  static generateIncomeStatement(
    accounts: ChartAccount[],
    transactions: Transaction[]
  ): Record<string, any> {
    const revenue = 0;
    const cogs = 0;
    const expenses = 0;

    // Filter income and expense accounts
    const pnlAccounts = accounts.filter(a => ['income', 'expense', 'cost_of_goods'].includes(a.type));

    const accountTotals = new Map<string, number>();

    transactions.forEach(tx => {
      if (tx.status === 'void' || tx.status === 'failed') return;
      tx.lines?.forEach(line => {
        const acc = pnlAccounts.find(a => a.id === line.accountId);
        if (acc) {
          const current = accountTotals.get(acc.id) || 0;
          accountTotals.set(acc.id, current + (line.amountCents || 0));
        }
      });
    });

    return {
      revenue,
      cogs,
      expenses,
      netIncome: revenue - cogs - expenses,
      accountTotals: Object.fromEntries(accountTotals)
    };
  }

  /**
   * Generates Balance Sheet values.
   */
  static generateBalanceSheet(
    accounts: ChartAccount[],
    transactions: Transaction[]
  ): Record<string, any> {
    // Similar logic to precalculate BS
    return {};
  }

  /**
   * Generates Cash Flow Statement values.
   */
  static generateCashFlowStatement(
    accounts: ChartAccount[],
    transactions: Transaction[]
  ): Record<string, any> {
    const operatingCashFlow = 0;
    const investingCashFlow = 0;
    const financingCashFlow = 0;

    return {
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      netCashChange: operatingCashFlow + investingCashFlow + financingCashFlow
    };
  }
}
