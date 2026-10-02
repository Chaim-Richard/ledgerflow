import { resolveAccountRole } from '../accountUtils';
import { AlgorithmDefinition, AlgoResult } from './types';

export const INTEREST_RATE_SENSITIVITY_ALGO: AlgorithmDefinition = {
  id: 'treasury_2',
  name: 'Interest Rate Sensitivity (Gap Analysis)',
  domain: 'treasury',
  tags: ['Interest', 'Rates', 'Treasury', 'Risk', 'Debt'],
  description: 'Evaluates the impact of a sudden change in interest rates on net interest income based on variable-rate assets and liabilities.',
  inputs: [
    { key: 'rateShockBps', label: 'Rate Shock (Basis Points)', min: -500, max: 500, step: 25, defaultValue: 100 }
  ],
  compute: (ctx, inputs: { "rateShockBps": number; [key: string]: unknown }): AlgoResult => {
    const { accounts } = ctx;
    const rateShock = (inputs.rateShockBps ?? 100) / 10000;

    // For this simple simulation, we look for accounts that might be rate-sensitive
    let rsa = 0; // Rate Sensitive Assets
    let rsl = 0; // Rate Sensitive Liabilities

    accounts.forEach(acc => {
      const type = (acc.type || '').toLowerCase();
      const name = (acc.name || '').toLowerCase();
      const bal = acc.balanceCents || 0;

      // Simplistic identification of variable rate items
      const role = resolveAccountRole(acc);
      if (type === 'asset' && (role === 'cash' || name.includes('market') || name.includes('variable'))) {
         rsa += bal;
      } else if (type === 'liability' && (name.includes('variable') || name.includes('line of credit') || name.includes('revolver'))) {
         rsl += Math.abs(bal);
      }
    });

    if (rsa === 0 && rsl === 0) {
      return {
        metrics: [{ label: 'Status', value: 'No Rate-Sensitive Items Found' }],
        charts: [],
        insights: ['No variable-rate assets (e.g., cash sweeps) or liabilities (e.g., revolvers) were identified on the balance sheet.']
      };
    }

    const gap = rsa - rsl;
    const nmiImpact = gap * rateShock;

    const chartData = [
       { Category: 'Rate Sensitive Assets', Balance: rsa / 100 },
       { Category: 'Rate Sensitive Liab', Balance: -rsl / 100 },
       { Category: 'Net Gap', Balance: gap / 100 }
    ];

    let impactColor = 'gray';
    let impactTrend = 'neutral';
    if (nmiImpact > 0) { impactColor = 'green'; impactTrend = 'positive'; }
    else if (nmiImpact < 0) { impactColor = 'red'; impactTrend = 'negative'; }

    return {
      metrics: [
        { label: 'Net Interest Gap', value: `$${(gap / 100).toLocaleString()}` },
        { label: 'Net Income Impact (Annualized)', value: `$${(nmiImpact / 100).toLocaleString()}`, color: impactColor, trend: impactTrend }
      ],
      charts: [
        {
          config: {
            xKey: 'Category',
            yKeys: [{ key: 'Balance', name: 'Balance ($)', color: '#6366f1', type: 'bar' }]
          },
          data: chartData
        }
      ],
      insights: [
        `The entity has a Net Interest Gap of $${(gap / 100).toLocaleString()}, meaning it is ${gap > 0 ? 'asset-sensitive' : 'liability-sensitive'}.`,
        `A ${inputs.rateShockBps} bps (${rateShock * 100}%) parallel shift in interest rates would impact annualized Net Interest Income by $${(nmiImpact / 100).toLocaleString()}.`,
        nmiImpact < 0 ? 'Consider entering interest rate swaps or caps to hedge against rising rates on variable debt.' : 'Entity is positioned to benefit from this rate movement.'
      ]
    };
  }
};
