import { Transaction, ChartAccount } from '../../types';
import { AlgorithmDefinition } from './types';

// Calculates running safe-to-spend balance based on virtual envelopes
export function calculateSafeToSpend(transactions: Transaction[], taxRate: number = 0.30) {
    let revenue = 0;
    let expenses = 0;
    let rawCash = 0;

    transactions.forEach(t => {
        if (t.totalAmountCents > 0) {
            revenue += t.totalAmountCents;
            rawCash += t.totalAmountCents;
        } else {
            expenses += Math.abs(t.totalAmountCents);
            rawCash -= Math.abs(t.totalAmountCents);
        }
    });

    const netProfit = Math.max(0, revenue - expenses);
    const estimatedTax = netProfit * taxRate;
    const safeToSpend = rawCash - estimatedTax;

    return { revenue, expenses, netProfit, estimatedTax, rawCash, safeToSpend };
}

export const TAX_SET_ASIDE_ALGO: AlgorithmDefinition = {
  id: 'tax_set_aside',
  domain: 'planning',
  name: 'Virtual Tax Envelopes (Safe-to-Spend)',
  description: 'Maintains a running marginal tax estimate on YTD net profit to calculate a true "Safe to Spend" number.',
  inputs: [
    { key: 'taxRate', label: 'Marginal Tax Rate (%)', min: 10, max: 50, step: 1, defaultValue: 30 }
  ],
  compute: (transactions, accounts, inputs) => {
    const start = performance.now();
    const result = calculateSafeToSpend(transactions, inputs.taxRate / 100);
    const ms = performance.now() - start;

    return {
      metrics: [
        { label: 'Raw Cash Balance', value: `$${(result.rawCash/100).toFixed(2)}` },
        { label: 'Est. Tax Liability', value: `$${(result.estimatedTax/100).toFixed(2)}`, color: 'text-red-400' },
        { label: 'Safe to Spend', value: `$${(result.safeToSpend/100).toFixed(2)}`, color: 'text-emerald-400' },
        { label: 'Execution Time', value: `${ms.toFixed(2)} ms` }
      ],
      charts: [
          {
             data: [
                 { name: 'Raw Cash', value: result.rawCash / 100 },
                 { name: 'Tax Reserve', value: result.estimatedTax / 100 },
                 { name: 'Safe to Spend', value: result.safeToSpend / 100 }
             ],
             config: { xKey: 'name', yKeys: [{ key: 'value', color: '#3b82f6', name: 'Amount ($)', type: 'bar' }] }
          }
      ],
      insights: [
        `Calculated tax liability of $${(result.estimatedTax/100).toFixed(2)} on a net profit of $${(result.netProfit/100).toFixed(2)}.`,
        'By surfacing "Safe to Spend" instead of "Cash Balance", we remove the biggest anxiety of self-employment.',
        'This virtual envelope pattern can be extended to payroll and rent reserves.'
      ]
    };
  }
};
