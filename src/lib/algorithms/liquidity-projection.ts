import { AlgorithmDefinition, buildHelper } from './types';
import { getRevenueTxs, getExpenseTxs } from '../stats-helpers';

export const liquidityProjection: AlgorithmDefinition = {
  id: '4',
  name: 'Liquidity Projection Vector',
  description: 'Forward-looking cash velocity computations based on moving averages.',
  inputs: [
    { key: 'months', label: 'Projection Months', min: 1, max: 24, step: 1, defaultValue: 6 },
    { key: 'burnRate', label: 'Assumed Monthly Burn ($)', min: 1000, max: 1000000, step: 1000, defaultValue: 50000 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    // A simplified projection model
    let startingCash = 0;
    const cashAccounts = accounts.filter(a => a.type === 'asset' || (a.name || '').toLowerCase().includes('cash')).map(a => a.id);
    txs.forEach(t => t.lines?.forEach(l => {
       if (cashAccounts.includes(l.accountId)) {
           startingCash += l.amountCents;
       }
    }));
    startingCash = startingCash / 100;
    if (startingCash < 0) startingCash = 0;

    const data = [];
    let currentCash = startingCash;
    
    for (let i = 1; i <= inputs.months; i++) {
       currentCash -= inputs.burnRate;
       data.push({ period: `Month ${i}`, cash: Math.max(0, currentCash) });
    }

    const runway = startingCash / inputs.burnRate;

    return {
      metrics: [
        { label: 'Current Liquidity', value: `$${startingCash.toLocaleString()}`, color: 'emerald' },
        { label: 'Estimated Runway', value: `${runway.toFixed(1)} Months`, color: runway > 6 ? 'emerald' : 'rose' }
      ],
      charts: [{ data, config: { xKey: 'period', yKeys: [{ key: 'cash', color: '#3b82f6', name: 'Projected Cash Reserve', type: 'line' }] } }],
      insights: [
        runway > inputs.months 
          ? `Liquidity is projected to sustain operations beyond the ${inputs.months} month target.`
          : `Warning: Projected cash out within the projection window.`
      ]
    };
  })
};
