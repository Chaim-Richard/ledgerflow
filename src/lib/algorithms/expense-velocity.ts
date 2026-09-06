import { AlgorithmDefinition, AlgoResult } from './types';

export const EXPENSE_VELOCITY_ALGO: AlgorithmDefinition = {
  id: 'ops_velocity',
  name: 'Expense Velocity (Spike Detector)',
  domain: 'operations',
  tags: ['Cash', 'Spikes', 'Operations', 'Monitoring'],
  description: 'Calculates the trailing 7-day moving average of expenses to detect sudden spikes in cash outflow velocity before the end-of-month reporting cycle.',
  inputs: [
    {
      key: 'spikeThresholdPct',
      label: 'Spike Alert Threshold (%)',
      min: 10,
      max: 300,
      step: 10,
      defaultValue: 50
    },
    {
      key: 'movingAverageDays',
      label: 'Moving Avg (Days)',
      min: 3,
      max: 30,
      step: 1,
      defaultValue: 7
    }
  ],
  compute: (ctx, inputs): AlgoResult => {
    const { transactions } = ctx;
    const threshold = (inputs['spikeThresholdPct'] ?? 50) / 100;
    const windowDays = Math.max(1, inputs['movingAverageDays'] ?? 7);
    
    // 1. Group daily outgoing cash
    const dailyExpenses: Record<string, number> = {};
    
    transactions.forEach(tx => {
      // Look for negative impact (expenses)
      // Standardize around totalAmountCents for simplicity here (assuming absolute value or outgoing)
      if (tx.totalAmountCents === 0) return;
      
      const dateKey = tx.date.substring(0, 10);
      if (!dailyExpenses[dateKey]) dailyExpenses[dateKey] = 0;
      
      // If we only want expenses, we could check if it hits expense accounts.
      // For this simplified algo, we\'ll just look at all transaction sizes to find absolute velocity spikes.
      dailyExpenses[dateKey] += Math.abs(tx.totalAmountCents);
    });
    
    // Sort dates
    const sortedDates = Object.keys(dailyExpenses).sort();
    if (sortedDates.length < windowDays) {
       return {
          metrics: [],
          charts: [],
          insights: ['Not enough transaction history to establish a baseline moving average.']
       };
    }
    
    // Calculate moving average and spikes
    const chartData = [];
    let recentSpikes = 0;
    let maxVelocity = 0;
    let currentVelocity = 0;
    
    // Start from the window end
    for (let i = windowDays; i < sortedDates.length; i++) {
      const targetDate = sortedDates[i];
      const targetVolume = dailyExpenses[targetDate];
      
      // Calculate average of previous `windowDays`
      let sum = 0;
      for (let j = 1; j <= windowDays; j++) {
        sum += dailyExpenses[sortedDates[i - j]];
      }
      const movingAvg = sum / windowDays;
      
      const velocityRatio = movingAvg > 0 ? (targetVolume - movingAvg) / movingAvg : 0;
      
      if (velocityRatio > threshold) {
        recentSpikes++;
      }
      
      if (targetVolume > maxVelocity) {
        maxVelocity = targetVolume;
      }
      
      currentVelocity = targetVolume;
      
      chartData.push({
        Date: targetDate.substring(5), // MM-DD
        'Daily Volume': parseFloat((targetVolume / 100).toFixed(2)),
        'Avg': parseFloat((movingAvg / 100).toFixed(2))
      });
    }
    
    const insights = [];
    insights.push(`Analyzed daily expense velocity across ${sortedDates.length} days of history.`);
    if (recentSpikes > 0) {
      insights.push(`Detected ${recentSpikes} instances where daily volume spiked more than ${inputs['spikeThresholdPct'] ?? 50}% above the trailing ${windowDays}-day average.`);
    } else {
      insights.push(`Expense velocity is stable. No anomalous spikes detected above the ${inputs['spikeThresholdPct'] ?? 50}% threshold.`);
    }

    return {
      metrics: [
        { label: 'Recent Spikes', value: recentSpikes, color: recentSpikes > 0 ? 'text-amber-500' : 'text-slate-500' },
        { label: 'Max Daily Velocity', value: `$${(maxVelocity / 100).toLocaleString()}` },
        { label: 'Latest Velocity', value: `$${(currentVelocity / 100).toLocaleString()}` }
      ],
      charts: [
        {
          config: {
            xKey: 'Date',
            yKeys: [
              { key: 'Daily Volume', name: 'Actual Daily Volume ($)', color: '#94a3b8', type: 'bar' },
              { key: 'Avg', name: `${windowDays}-Day Moving Avg ($)`, color: '#6366f1', type: 'line' }
            ]
          },
          data: chartData
        }
      ],
      insights
    };
  }
};
