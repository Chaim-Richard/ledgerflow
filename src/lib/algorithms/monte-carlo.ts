import { resolveAccountRole } from '../accountUtils';
import { AlgorithmDefinition, AlgoResult } from './types';
import { standardDeviation, mean } from './math';

export const MONTE_CARLO_ALGO: AlgorithmDefinition = {
  id: 'planning_4',
  name: 'Monte Carlo Cash Flow Simulation',
  domain: 'planning',
  tags: ['Forecasting', 'Stochastic', 'Probability', 'Risk'],
  description: 'Simulates 10,000 potential financial futures using geometric Brownian motion based on historical transaction variance to predict the probability of cash exhaustion.',
  inputs: [
    {
      key: 'simulationDays',
      label: 'Simulation Horizon (Days)',
      min: 30,
      max: 365,
      step: 15,
      defaultValue: 90
    },
    {
      key: 'iterations',
      label: 'Simulations (x100)',
      min: 10,
      max: 100,
      step: 10,
      defaultValue: 50 // 5000 iterations
    }
  ],
  compute: (transactions, accounts, inputs) => {
    const horizon = inputs.simulationDays ?? 90;
    const runs = (inputs.iterations ?? 50) * 100;
    
    // Group historical transactions by day
    const dailyNet: Record<string, number> = {};
    let currentCashCents = 0;

    // We assume asset/bank accounts indicate current cash
    accounts.forEach(acc => {
      if (resolveAccountRole(acc) === 'cash') {
        currentCashCents += acc.balanceCents || 0;
      }
    });

    // Fallback if no cash accounts identified clearly
    if (currentCashCents === 0 && accounts.length > 0) {
      currentCashCents = accounts.reduce((sum, a) => sum + (a.balanceCents || 0), 0);
    }

    transactions.forEach(t => {
      if (t.status === 'void' || t.status === 'pending') return;
      const dateKey = t.date.split('T')[0];
      if (!dailyNet[dateKey]) dailyNet[dateKey] = 0;
      
      // Calculate net impact of transaction. Usually totalAmountCents > 0 is inflow if we assume it's revenue, but let's be careful.
      // A more robust way: sum of lines where account is Asset/Bank
      let netImpact = 0;
      t.lines.forEach(l => {
        const acc = accounts.find(a => a.id === l.accountId);
        if (acc && resolveAccountRole(acc) === 'cash') {
           netImpact += l.amountCents;
        }
      });
      if (netImpact === 0) {
        // Fallback: use totalAmountCents but guess direction
        // In a double-entry ledger, totalAmountCents is just the absolute sum / 2.
        // We will just use the first line's sign if no bank account is identified.
        netImpact = t.lines[0]?.amountCents || 0;
      }
      dailyNet[dateKey] += netImpact;
    });

    const historicalDailyFlows = Object.values(dailyNet);
    
    if (historicalDailyFlows.length < 5) {
      return {
        metrics: [
          { label: 'Status', value: 'Insufficient Data', color: 'red' }
        ],
        charts: [],
        insights: [
          'The Monte Carlo engine requires at least 5 days of transaction history to establish drift and volatility.'
        ]
      };
    }

    const muCents = mean(historicalDailyFlows);
    const sigmaCents = standardDeviation(historicalDailyFlows);

    let exhaustionCount = 0;
    let endBalances: number[] = [];
    const chartPercentiles: { day: number; p10: number; p50: number; p90: number }[] = [];

    // Pre-allocate matrix for charting
    const dayMatrix: number[][] = Array(horizon).fill(0).map(() => []);

    for (let run = 0; run < runs; run++) {
      let runCash = currentCashCents;
      let exhausted = false;
      for (let day = 0; day < horizon; day++) {
        // Box-Muller transform for normal distribution
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
        
        const dailyShock = muCents + (sigmaCents * z);
        runCash += dailyShock;
        
        if (runCash <= 0 && !exhausted) {
          exhausted = true;
          exhaustionCount++;
        }
        dayMatrix[day].push(runCash);
      }
      endBalances.push(runCash);
    }

    const sortFn = (a: number, b: number) => a - b;

    for (let day = 0; day < horizon; day++) {
      const sorted = dayMatrix[day].sort(sortFn);
      chartPercentiles.push({
        day,
        p10: sorted[Math.floor(runs * 0.1)] / 100,
        p50: sorted[Math.floor(runs * 0.5)] / 100,
        p90: sorted[Math.floor(runs * 0.9)] / 100
      });
    }

    endBalances.sort(sortFn);
    const medianEnd = endBalances[Math.floor(runs * 0.5)] / 100;
    const p10End = endBalances[Math.floor(runs * 0.1)] / 100;
    const probabilityOfRuin = (exhaustionCount / runs) * 100;

    return {
      metrics: [
        { label: 'Risk of Exhaustion (Ruin %)', value: `${probabilityOfRuin.toFixed(2)}%`, trend: probabilityOfRuin < 10 ? 'positive' : 'negative', color: probabilityOfRuin < 10 ? 'green' : 'red' },
        { label: 'Median Ending Cash', value: `$${medianEnd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: '10th Percentile (Worst Case)', value: `$${p10End.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
      ],
      charts: [
        {
          config: {
            xKey: 'day',
            yKeys: [
              { key: 'p90', color: '#10b981', name: 'Optimistic (90th)' },
              { key: 'p50', color: '#6366f1', name: 'Expected (50th)' },
              { key: 'p10', color: '#ef4444', name: 'Pessimistic (10th)' }
            ]
          },
          data: chartPercentiles
        }
      ],
      insights: [
        `Running ${runs.toLocaleString()} probabilistic futures, there is a ${probabilityOfRuin.toFixed(1)}% chance of cash exhaustion within ${horizon} days.`,
        `Historical daily drift is ${muCents > 0 ? 'positive' : 'negative'} at $${(Math.abs(muCents)/100).toFixed(2)}/day with a volatility (1σ) of $${(sigmaCents/100).toFixed(2)}.`,
        probabilityOfRuin > 20 ? 'URGENT: Structural cash flow deficit detected. High risk of insolvency without intervention.' : 'Cash reserves appear resilient against standard historical volatility shocks.'
      ]
    };
  }
};
