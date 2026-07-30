import { AlgorithmDefinition, AlgoResult } from './types';
import { ChartAccount, Transaction } from '../../types';

export const CURRENCY_EXPOSURE_ALGO: AlgorithmDefinition = {
  id: 'treasury_1',
  name: 'Foreign Exchange (FX) Exposure',
  domain: 'treasury',
  tags: ['FX', 'Currency', 'Risk', 'Treasury'],
  description: 'Calculates net exposure to foreign currencies by identifying transactions or accounts holding non-base currency balances, highlighting FX risk.',
  inputs: [
    { key: 'shockPct', label: 'Simulated FX Shock (%)', min: 1, max: 25, step: 1, defaultValue: 10 }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    const shockPct = (inputs.shockPct ?? 10) / 100;
    
    // Attempt to identify FX transactions. 
    // In our simplified ledger, we can check for lines with custom exchange rates or accounts with a specific currency tag.
    const fxBalances: Record<string, number> = {};
    let totalBaseExposure = 0;

    transactions.forEach(tx => {
       tx.lines.forEach(line => {
          // If transaction or line has an exchange rate !== 1, it's an FX transaction
          const isFx = (tx as any).exchangeRate && (tx as any).exchangeRate !== 1;
          const currencyCode = (tx as any).currency || 'USD'; // Assuming base is USD
          
          if (isFx && currencyCode !== 'USD') {
             if (!fxBalances[currencyCode]) fxBalances[currencyCode] = 0;
             fxBalances[currencyCode] += line.amountCents; // Raw foreign amount if known, or base equivalent
             totalBaseExposure += Math.abs(line.amountCents);
          }
       });
    });

    if (totalBaseExposure === 0) {
      return {
        metrics: [{ label: 'FX Exposure', value: '$0' }],
        charts: [],
        insights: ['No foreign currency transactions detected. Entity operates purely in base currency with 0% FX risk.']
      };
    }

    const shockImpact = totalBaseExposure * shockPct;

    return {
      metrics: [
        { label: 'Total FX Exposure', value: `$${(totalBaseExposure / 100).toLocaleString()}`, color: 'orange' },
        { label: 'Potential Shock Loss', value: `-$${(shockImpact / 100).toLocaleString()}`, color: 'red' }
      ],
      charts: [
        {
          config: {
             xKey: 'currency',
             yKeys: [{ key: 'exposure', name: 'Exposure (Base)', color: '#f59e0b', type: 'bar' }]
          },
          data: Object.keys(fxBalances).map(k => ({ currency: k, exposure: Math.abs(fxBalances[k] / 100) }))
        }
      ],
      insights: [
        `Entity has $${(totalBaseExposure / 100).toLocaleString()} exposed to non-base currencies.`,
        `A ${inputs.shockPct}% adverse move in FX rates would result in a $${(shockImpact / 100).toLocaleString()} realized loss.`,
        `Consider implementing forward contracts or natural hedging to mitigate currency concentration.`
      ]
    };
  }
};
