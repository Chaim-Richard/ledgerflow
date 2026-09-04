import { AlgorithmDefinition, AlgoResult } from './types';
import { Transaction } from '../../types';
import { formatCurrency, parseLocalDate } from '../../lib/utils';
import { isPostable } from '../../lib/txFilters';

export const BUDGET_VS_ACTUAL_ALGO: AlgorithmDefinition = {
  id: 'budget-vs-actual',
  name: 'Budget vs Actual Variance',
  domain: 'planning',
  tags: ['Reporting', 'Planning', 'Variance'],
  description: 'Compares budgeted amounts against actual posted ledger activity, computing variance and percentage completion.',
  requires: ['transactions', 'budgets', 'accounts'],
  inputs: [
    {
      kind: 'select',
      key: 'period',
      label: 'Budget Period',
      options: [
        { value: '2027', label: '2027 Annual' },
        { value: '2026', label: '2026 Annual' },
        { value: '2025', label: '2025 Annual' },
        { value: '2026-03', label: 'March 2026' }
      ],
      defaultValue: '2026'
    }
  ],
  compute: (transactions, accounts, inputs, context): AlgoResult => {
    const budgets = context?.budgets || [];
    const targetPeriod = inputs['period'] || '2026';
    
    // Filter budgets for the period
    const activeBudgets = budgets.filter((b: any) => b.period === targetPeriod && b.targetType === 'account');
    
    if (activeBudgets.length === 0) {
      return {
        metrics: [],
        charts: [],
        insights: [`No account-level budgets found for period "${targetPeriod}".`],
        rows: []
      };
    }

    const rows: any[] = [];
    const sourceTransactionIds = new Set<string>();
    let totalBudget = 0;
    let totalActual = 0;

    activeBudgets.forEach((budget: any) => {
      const accountId = budget.targetId;
      const account = accounts.find(a => a.id === accountId);
      
      // Calculate actuals
      let actualCents = 0;
      
      transactions.forEach(tx => {
        if (!isPostable(tx)) return;
        
        // Very rough period check: if budget is YYYY, match year. If YYYY-MM, match month.
        if (!tx.date.startsWith(targetPeriod)) return;

        tx.lines.forEach(e => {
          if (e.accountId === accountId) {
            const isDebitNormal = account ? ['asset', 'expense', 'cost_of_goods'].includes(account.type) : true;
            const debit = e.amountCents > 0 ? e.amountCents : 0;
            const credit = e.amountCents < 0 ? Math.abs(e.amountCents) : 0;
            
            actualCents += isDebitNormal ? (debit - credit) : (credit - debit);
            sourceTransactionIds.add(tx.id);
          }
        });
      });

      const budgetAmount = budget.amountCents;
      const variance = budgetAmount - actualCents;
      const variancePct = budgetAmount !== 0 ? (variance / budgetAmount) * 100 : 0;
      
      totalBudget += budgetAmount;
      totalActual += actualCents;

      rows.push({
        id: budget.id,
        account: account ? `${account.code} - ${account.name}` : accountId,
        budget: formatCurrency(budgetAmount),
        actual: formatCurrency(actualCents),
        variance: formatCurrency(variance),
        variancePct: `${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%`
      });
    });
    
    const totalVariance = totalBudget - totalActual;
    const totalVariancePct = totalBudget !== 0 ? (totalVariance / totalBudget) * 100 : 0;

    return {
      metrics: [
        { label: 'Total Budget', value: formatCurrency(totalBudget), color: 'text-indigo-400' },
        { label: 'Total Actuals', value: formatCurrency(totalActual), color: 'text-emerald-400' },
        { label: 'Net Variance', value: formatCurrency(totalVariance), color: totalVariance >= 0 ? 'text-emerald-500' : 'text-rose-500' }
      ],
      charts: [
        {
          config: {
            xKey: 'account',
            yKeys: [
              { key: 'budget', name: 'Budget', color: '#6366f1', type: 'bar' },
              { key: 'actual', name: 'Actual', color: '#10b981', type: 'bar' }
            ]
          },
          data: rows.map(r => ({
            account: r.account,
            budget: parseFloat(r.budget.replace(/[^0-9.-]+/g,"")),
            actual: parseFloat(r.actual.replace(/[^0-9.-]+/g,""))
          }))
        }
      ],
      insights: [
        `Overall budget completion is ${totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : 0}%.`,
        totalVariance >= 0 ? 'Currently operating within budget.' : 'Warning: Total actuals exceed budget.'
      ],
      rows,
      sourceTransactionIds: Array.from(sourceTransactionIds)
    };
  }
};
