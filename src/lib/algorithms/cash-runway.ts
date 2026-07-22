import { AlgorithmDefinition, AlgoResult } from './types';

export const CASH_RUNWAY_ALGO: AlgorithmDefinition = {
  id: 'planning_runway',
  name: 'Runway & Burn Rate Predictor',
  domain: 'planning',
  tags: ['Forecasting', 'Cash', 'Burn', 'Survival'],
  description: 'Calculates the current cash position against the moving average monthly burn rate to predict the "Zero Cash Date" (Runway in months).',
  inputs: [
    {
      key: 'burnWindowMonths',
      label: 'Trailing Burn Window (Months)',
      min: 1,
      max: 12,
      step: 1,
      defaultValue: 3
    }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    const burnWindowMonths = inputs['burnWindowMonths'] || 3;
    
    // 1. Calculate current cash position (sum of all Cash/Bank accounts)
    const cashAccounts = accounts.filter(a => ['asset', 'bank', 'cash'].includes(a.type.toLowerCase()));
    const cashAccountIds = new Set(cashAccounts.map(a => a.id));
    
    let currentCashCents = 0;
    
    // Also track monthly burn
    // Group transactions by YYYY-MM
    const monthlyNet: Record<string, number> = {};
    
    transactions.forEach(tx => {
      let netCashImpact = 0;
      if (tx.lines && tx.lines.length > 0) {
        tx.lines.forEach(l => {
          if (cashAccountIds.has(l.accountId)) {
            netCashImpact += l.amountCents;
          }
        });
      }
      currentCashCents += netCashImpact;
      
      // Track monthly flow for non-transfer operating expenses
      // A true burn rate calculation should isolate operating expenses vs revenue.
      // For simplicity in this algo, we look at the net cash flow per month.
      const monthKey = tx.date.substring(0, 7); // YYYY-MM
      if (!monthlyNet[monthKey]) monthlyNet[monthKey] = 0;
      monthlyNet[monthKey] += netCashImpact;
    });
    
    // 2. Calculate average burn over the requested window
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyNet).sort();
    // Take the last N months, excluding the current incomplete month if desired, 
    // but for simplicity we'll just take the last N available months.
    const recentMonths = sortedMonths.slice(-burnWindowMonths);
    
    let totalBurn = 0;
    let burnMonthsCount = 0;
    
    recentMonths.forEach(m => {
      const netFlow = monthlyNet[m];
      if (netFlow < 0) { // Only count months where we LOST cash towards burn rate
        totalBurn += Math.abs(netFlow);
        burnMonthsCount++;
      }
    });
    
    const avgMonthlyBurnCents = burnMonthsCount > 0 ? (totalBurn / burnMonthsCount) : 0;
    
    // 3. Compute Runway
    let runwayMonths = -1; // -1 means infinite/profitable
    if (avgMonthlyBurnCents > 0 && currentCashCents > 0) {
      runwayMonths = currentCashCents / avgMonthlyBurnCents;
    }
    
    // Format values
    const cashFormatted = `$${(currentCashCents / 100).toLocaleString()}`;
    const burnFormatted = avgMonthlyBurnCents > 0 ? `$${(avgMonthlyBurnCents / 100).toLocaleString()}/mo` : '$0/mo';
    
    let runwayText = 'Infinite (Profitable)';
    let runwayColor = 'text-emerald-500';
    
    if (runwayMonths !== -1) {
      runwayText = `${runwayMonths.toFixed(1)} Months`;
      if (runwayMonths < 3) runwayColor = 'text-rose-500';
      else if (runwayMonths < 6) runwayColor = 'text-amber-500';
      else runwayColor = 'text-blue-500';
    } else if (currentCashCents <= 0) {
      runwayText = 'Out of Cash';
      runwayColor = 'text-rose-500';
    }

    const insights = [];
    insights.push(`Current liquid cash position is ${cashFormatted} across ${cashAccounts.length} cash accounts.`);
    if (burnMonthsCount > 0) {
      insights.push(`Based on the last ${burnWindowMonths} months of data, the average monthly burn rate is ${burnFormatted}.`);
    } else {
      insights.push(`The company has generated positive net cash flow over the last ${burnWindowMonths} months. No active burn rate.`);
    }
    
    if (runwayMonths > 0 && runwayMonths < 3) {
      insights.push(`CRITICAL: Cash runway is critically short (${runwayMonths.toFixed(1)} months). Immediate capital injection or expense reduction required.`);
    }

    // Prepare chart data
    const chartData = recentMonths.map(m => ({
      Month: m,
      'Net Flow': parseFloat((monthlyNet[m] / 100).toFixed(2))
    }));

    return {
      metrics: [
        { label: 'Current Cash', value: cashFormatted },
        { label: 'Avg Monthly Burn', value: burnFormatted, color: 'text-amber-500' },
        { label: 'Estimated Runway', value: runwayText, color: runwayColor }
      ],
      charts: [
        {
          config: {
            xKey: 'Month',
            yKeys: [
              { key: 'Net Flow', name: 'Net Cash Flow', color: '#6366f1', type: 'bar' }
            ]
          },
          data: chartData
        }
      ],
      insights
    };
  }
};
