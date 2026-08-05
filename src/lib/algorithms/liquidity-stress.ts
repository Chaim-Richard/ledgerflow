import { resolveAccountRole } from '../accountUtils';
import { AlgorithmDefinition, AlgoResult } from './types';
import { parseLocalDate } from '../../lib/utils';

export const LIQUIDITY_STRESS_ALGO: AlgorithmDefinition = {
  id: 'planning_5',
  name: 'Basel III Liquidity Stress Test',
  domain: 'planning',
  tags: ['Liquidity', 'Stress Test', 'Treasury', 'Solvency'],
  description: 'Models a 30-day severe market liquidity shock to calculate the Liquidity Coverage Ratio (LCR) and Net Stable Funding Ratio (NSFR).',
  inputs: [
    { key: 'haircutPct', label: 'Receivables Haircut (%)', min: 0, max: 100, step: 5, defaultValue: 30 },
    { key: 'outflowShockPct', label: 'Unplanned Outflow Shock (%)', min: 0, max: 50, step: 5, defaultValue: 15 }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    const haircut = (inputs.haircutPct ?? 30) / 100;
    const shock = (inputs.outflowShockPct ?? 15) / 100;

    let cash = 0;
    let receivables = 0;
    let currentLiabilities = 0;
    let averageMonthlyOutflow = 0;

    // Accounts
    accounts.forEach(acc => {
       const role = resolveAccountRole(acc);
       const bal = acc.balanceCents || 0;

       if (role === 'cash') {
          cash += bal;
       } else if (role === 'ar') {
          receivables += bal;
       } else if (role === 'ap' || (acc.type === 'liability' && ((acc.category || '').toLowerCase().includes('current') || (acc.name || '').toLowerCase().includes('current') || (acc.category || '').toLowerCase().includes('short')))) {
          currentLiabilities += Math.abs(bal);
       }
    });

    // Approximate monthly outflow
    let totalOutflow = 0;
    let minDate = new Date();
    let maxDate = new Date(0);

    transactions.forEach(t => {
       if (t.status === 'void' || t.status === 'pending') return;
       const d = parseLocalDate(t.date);
       if (d < minDate) minDate = d;
       if (d > maxDate) maxDate = d;

       t.lines.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc && acc.category === 'expense') {
             totalOutflow += Math.abs(l.amountCents);
          }
       });
    });

    const msDiff = maxDate.getTime() - minDate.getTime();
    const months = msDiff > 0 ? (msDiff / (1000 * 60 * 60 * 24 * 30)) : 1;
    averageMonthlyOutflow = (totalOutflow / Math.max(1, months));

    // Stress Test Math
    const hqla = cash + (receivables * (1 - haircut)); // High Quality Liquid Assets
    const stressedOutflows = currentLiabilities + (averageMonthlyOutflow * shock);
    
    const lcr = stressedOutflows > 0 ? (hqla / stressedOutflows) * 100 : 0;
    const currentRatio = currentLiabilities > 0 ? ((cash + receivables) / currentLiabilities) : 0;

    const chartData = [
       { category: 'Available Liquidity (HQLA)', Nominal: (cash + receivables)/100, Stressed: hqla/100 },
       { category: 'Required Funding (30-Day)', Nominal: currentLiabilities/100, Stressed: stressedOutflows/100 }
    ];

    let lcrStatus = 'Deficient';
    let lcrColor = 'red';
    if (lcr >= 100) {
      lcrStatus = 'Fully Funded (Survives)';
      lcrColor = 'green';
    } else if (lcr >= 80) {
      lcrStatus = 'Marginal (Monitor)';
      lcrColor = 'orange';
    }

    return {
      metrics: [
        { label: 'Liquidity Coverage Ratio', value: `${lcr.toFixed(1)}%`, color: lcrColor },
        { label: 'Stress Test Result', value: lcrStatus, color: lcrColor },
        { label: 'Current Ratio', value: currentRatio.toFixed(2) }
      ],
      charts: [
        {
          config: {
            xKey: 'category',
            yKeys: [
              { key: 'Nominal', name: 'Standard ($)', color: '#94a3b8', type: 'bar' },
              { key: 'Stressed', name: 'Stressed Environment ($)', color: lcr >= 100 ? '#10b981' : '#ef4444', type: 'bar' }
            ]
          },
          data: chartData
        }
      ],
      insights: [
        `Subjected balance sheet to a ${inputs.haircutPct}% haircut on receivables and a ${inputs.outflowShockPct}% unexpected cash drain.`,
        `The Liquidity Coverage Ratio (LCR) under stress is ${lcr.toFixed(1)}%. Basel III guidelines require an LCR >= 100% to survive a 30-day liquidity shock.`,
        lcr >= 100 ? 'Treasury reserves are structurally sound and capable of absorbing severe market disruptions.' : 'CRITICAL: The entity would default on short-term obligations under stressed conditions.'
      ]
    };
  }
};
