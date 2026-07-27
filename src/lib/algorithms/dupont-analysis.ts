import { AlgorithmDefinition, AlgoResult } from './types';

export const DUPONT_ANALYSIS_ALGO: AlgorithmDefinition = {
  id: 'valuation_3',
  name: 'DuPont ROE Decomposition',
  domain: 'valuation',
  tags: ['DuPont', 'ROE', 'Profitability', 'Efficiency', 'Leverage'],
  description: 'Deconstructs Return on Equity (ROE) into Profit Margin, Asset Turnover, and Financial Leverage to identify the core drivers of shareholder return.',
  inputs: [],
  compute: (transactions, accounts, inputs): AlgoResult => {
    let revenue = 0;
    let netIncome = 0;
    let totalAssets = 0;
    let equity = 0;

    // Use accounts for assets and equity
    accounts.forEach(acc => {
      const cat = (acc.category || '').toLowerCase();
      const type = (acc.type || '').toLowerCase();
      const bal = acc.balanceCents || 0;

      if (cat === 'asset') {
        totalAssets += bal;
      } else if (cat === 'equity' || type.includes('retained')) {
        equity += Math.abs(bal);
      }
    });

    // Approximate revenue and net income from transactions
    transactions.forEach(tx => {
       if (tx.status === 'void' || tx.status === 'pending') return;
       tx.lines.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc) {
             const cat = (acc.category || '').toLowerCase();
             if (cat === 'revenue' || acc.type === 'income') {
                revenue += Math.abs(l.amountCents);
                netIncome += Math.abs(l.amountCents);
             } else if (cat === 'expense' || cat === 'cost_of_goods') {
                netIncome -= Math.abs(l.amountCents);
             }
          }
       });
    });

    if (equity === 0 || totalAssets === 0) {
      return {
        metrics: [{ label: 'Status', value: 'Insufficient Balance Sheet' }],
        charts: [],
        insights: ['DuPont analysis requires non-zero Total Assets and Equity balances to compute leverage and turnover.']
      };
    }

    // DuPont Factors
    const profitMargin = revenue > 0 ? (netIncome / revenue) : 0;
    const assetTurnover = totalAssets > 0 ? (revenue / totalAssets) : 0;
    const equityMultiplier = equity > 0 ? (totalAssets / equity) : 0;
    
    // ROE = Profit Margin * Asset Turnover * Equity Multiplier
    const roe = profitMargin * assetTurnover * equityMultiplier;

    const chartData = [
       { Component: 'Profit Margin', Value: parseFloat((profitMargin * 100).toFixed(2)) },
       { Component: 'Asset Turnover', Value: parseFloat((assetTurnover * 100).toFixed(2)) },
       { Component: 'Equity Multiplier', Value: parseFloat((equityMultiplier * 100).toFixed(2)) }
    ];

    let roeColor = 'text-gray-500';
    let roeTrend = 'neutral';
    if (roe > 0.15) { roeColor = 'text-green-500'; roeTrend = 'positive'; }
    else if (roe < 0.05) { roeColor = 'text-red-500'; roeTrend = 'negative'; }
    else { roeColor = 'text-blue-500'; }

    return {
      metrics: [
        { label: 'Return on Equity (ROE)', value: `${(roe * 100).toFixed(2)}%`, color: roeColor, trend: roeTrend },
        { label: 'Net Profit Margin', value: `${(profitMargin * 100).toFixed(2)}%` },
        { label: 'Asset Turnover', value: `${assetTurnover.toFixed(2)}x` },
        { label: 'Equity Multiplier (Leverage)', value: `${equityMultiplier.toFixed(2)}x` }
      ],
      charts: [
        {
          config: {
            xKey: 'Component',
            yKeys: [{ key: 'Value', name: 'Driver Magnitude', color: '#10b981', type: 'bar' }]
          },
          data: chartData
        }
      ],
      insights: [
        `Return on Equity (ROE) stands at ${(roe * 100).toFixed(2)}%.`,
        `Decomposition shows a Profit Margin of ${(profitMargin * 100).toFixed(2)}%, Asset Turnover of ${assetTurnover.toFixed(2)}x, and Financial Leverage of ${equityMultiplier.toFixed(2)}x.`,
        equityMultiplier > 2 ? 'Note: High Equity Multiplier (>2.0x) indicates significant reliance on debt financing to drive ROE.' : 'Leverage is conservative, suggesting ROE is driven primarily by operational efficiency rather than debt.'
      ]
    };
  }
};
