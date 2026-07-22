import { Transaction, ChartAccount } from '../../types';

export class MaterializedViews {
  /**
   * Precomputes Income Statement values to avoid runtime recalculation.
   */
  static generateIncomeStatement(
    accounts: ChartAccount[],
    transactions: Transaction[]
  ): Record<string, any> {
    let revenue = 0;
    let cogs = 0;
    let expenses = 0;

    const accountTotals = new Map<string, number>();

    const incomeAccounts = accounts.filter(a => a.type === 'income');
    const cogsAccounts = accounts.filter(a => (a.type as string) === 'cost_of_goods');
    const expenseAccounts = accounts.filter(a => a.type === 'expense');

    transactions.forEach(tx => {
      if (tx.status === 'void' || tx.status === 'failed') return;
      tx.lines?.forEach(line => {
        const amt = line.amountCents || 0;
        if (amt === 0) return;

        const current = accountTotals.get(line.accountId) || 0;
        accountTotals.set(line.accountId, current + amt);

        if (incomeAccounts.some(a => a.id === line.accountId)) {
          revenue += amt < 0 ? Math.abs(amt) : -amt; // Typically credit balance
        } else if (cogsAccounts.some(a => a.id === line.accountId)) {
          cogs += amt > 0 ? amt : -Math.abs(amt); // Typically debit balance
        } else if (expenseAccounts.some(a => a.id === line.accountId)) {
          expenses += amt > 0 ? amt : -Math.abs(amt); // Typically debit balance
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
    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    const assetAccounts = accounts.filter(a => ['bank', 'asset', 'accounts_receivable', 'other_current_asset', 'fixed_asset'].includes(a.type as string));
    const liabilityAccounts = accounts.filter(a => ['liability', 'accounts_payable', 'credit_card', 'other_current_liability', 'long_term_liability'].includes(a.type as string));
    const equityAccounts = accounts.filter(a => ['equity'].includes(a.type as string));

    const accountTotals = new Map<string, number>();

    transactions.forEach(tx => {
      if (tx.status === 'void' || tx.status === 'failed') return;
      tx.lines?.forEach(line => {
        const amt = line.amountCents || 0;
        if (amt === 0) return;
        
        const current = accountTotals.get(line.accountId) || 0;
        accountTotals.set(line.accountId, current + amt);

        if (assetAccounts.some(a => a.id === line.accountId)) {
          assets += amt; // Debit balance
        } else if (liabilityAccounts.some(a => a.id === line.accountId)) {
          liabilities += -amt; // Credit balance
        } else if (equityAccounts.some(a => a.id === line.accountId)) {
          equity += -amt; // Credit balance
        }
      });
    });

    return {
      assets,
      liabilities,
      equity,
      totalLiabilitiesAndEquity: liabilities + equity,
      accountTotals: Object.fromEntries(accountTotals)
    };
  }

  /**
   * Generates Cash Flow Statement values.
   */
  static generateCashFlowStatement(
    accounts: ChartAccount[],
    transactions: Transaction[]
  ): Record<string, any> {
    let operatingCashFlow = 0;
    let investingCashFlow = 0;
    let financingCashFlow = 0;

    const bankAccounts = accounts.filter(a => (a.type as string) === 'bank');
    
    transactions.forEach(tx => {
      if (tx.status === 'void' || tx.status === 'failed') return;
      
      let cashImpact = 0;
      let isOperating = false;
      let isInvesting = false;
      let isFinancing = false;

      tx.lines?.forEach(line => {
        if (bankAccounts.some(a => a.id === line.accountId)) {
          cashImpact += line.amountCents || 0;
        } else {
          const acc = accounts.find(a => a.id === line.accountId);
          if (acc) {
            if (['income', 'expense', 'cost_of_goods', 'accounts_receivable', 'accounts_payable'].includes(acc.type)) isOperating = true;
            if (['fixed_asset', 'other_asset'].includes(acc.type)) isInvesting = true;
            if (['equity', 'long_term_liability'].includes(acc.type)) isFinancing = true;
          }
        }
      });

      if (cashImpact !== 0) {
        if (isOperating) operatingCashFlow += cashImpact;
        else if (isInvesting) investingCashFlow += cashImpact;
        else if (isFinancing) financingCashFlow += cashImpact;
        else operatingCashFlow += cashImpact; // default to operating
      }
    });

    return {
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      netCashChange: operatingCashFlow + investingCashFlow + financingCashFlow
    };
  }
}
