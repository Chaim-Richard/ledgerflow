import { AlgorithmDefinition, buildHelper } from './types';
import { getExpenseTxs } from '../stats-helpers';

export const multidimensionalMatrix: AlgorithmDefinition = {
  id: '1',
  name: 'Multidimensional Matrix',
  description: 'Dynamic pivot mapping of transactional vectors by category.',
  inputs: [{ key: 'sensitivity', label: 'Sensitivity Threshold ($)', min: 0, max: 10000, step: 100, defaultValue: 50 }],
  compute: buildHelper((txs, accounts, inputs) => {
    const expenses = getExpenseTxs(txs, accounts);
    const cats: Record<string, number> = {};
    expenses.forEach(t => {
      t.lines?.forEach((l: any) => {
        if (Math.abs(l.amountCents) > inputs.sensitivity * 100) {
           cats[l.category || 'Uncategorized'] = (cats[l.category || 'Uncategorized'] || 0) + Math.abs(l.amountCents);
        }
      });
    });
    const data = Object.keys(cats).map(c => ({ category: c, amount: cats[c] / 100 })).sort((a,b) => b.amount - a.amount).slice(0, 10);
    return {
      metrics: [{ label: 'Dimensional Categories', value: data.length }],
      charts: [{ data, config: { xKey: 'category', yKeys: [{ key: 'amount', color: '#10b981', name: 'Total ($)' }] } }],
      insights: ['Expense vectors pivot reliably across mapped dimensional categories.']
    };
  })
};
