import { AlgorithmDefinition, AlgoResult } from './types';

export const ALTMAN_Z_SCORE_ALGO: AlgorithmDefinition = {
  id: 'valuation_2',
  name: 'Altman Z-Score (Solvency Risk)',
  domain: 'finance',
  tags: ['Solvency', 'Risk', 'Bankruptcy', 'Z-Score'],
  description: 'Calculates the Altman Z-Score to predict the probability of bankruptcy or severe financial distress based on balance sheet and income statement ratios.',
  inputs: [],
  compute: (transactions, accounts, inputs) => {
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let currentAssets = 0;
    let currentLiabilities = 0;
    let retainedEarnings = 0;
    let equity = 0;

    accounts.forEach(acc => {
      const type = acc.type?.toLowerCase() || '';
      const cat = acc.category?.toLowerCase() || '';
      const name = acc.name?.toLowerCase() || '';
      const bal = acc.balanceCents || 0;

      if (type === 'asset') {
        totalAssets += bal;
        if (cat.includes('current') || name.includes('current') || cat.includes('bank') || name.includes('bank') || cat.includes('cash') || name.includes('cash') || cat.includes('receivable') || name.includes('receivable')) {
          currentAssets += bal;
        }
      } else if (type === 'liability') {
        totalLiabilities += Math.abs(bal); // liabilities usually negative in credit-normal, but let's take absolute
        if (cat.includes('current') || name.includes('current') || cat.includes('payable') || name.includes('payable') || cat.includes('short') || name.includes('short')) {
          currentLiabilities += Math.abs(bal);
        }
      } else if (type === 'equity') {
        equity += Math.abs(bal);
        if (cat.includes('retained') || name.includes('retained')) {
          retainedEarnings += Math.abs(bal);
        }
      }
    });

    // Approximate EBIT from transactions
    let ebit = 0;
    transactions.forEach(t => {
      if (t.status === 'void' || t.status === 'pending') return;
      // Net revenue minus operating expenses (excluding interest/taxes). 
      // We'll approximate this by summing P&L impact.
      t.lines.forEach(l => {
        const acc = accounts.find(a => a.id === l.accountId);
        if (acc) {
          const cat = acc.category?.toLowerCase() || '';
          const type = acc.type?.toLowerCase() || '';
          if (cat === 'revenue') {
             ebit += Math.abs(l.amountCents);
          } else if (cat === 'expense' && !type.includes('tax') && !type.includes('interest')) {
             ebit -= Math.abs(l.amountCents);
          }
        }
      });
    });

    if (totalAssets === 0) {
      return {
        metrics: [
          { label: 'Z-Score', value: 'N/A' }
        ],
        charts: [],
        insights: ['Total Assets are zero. Altman Z-Score requires a capitalized balance sheet to calculate meaningful solvency metrics.']
      };
    }

    const workingCapital = currentAssets - currentLiabilities;
    const t1 = workingCapital / totalAssets;
    const t2 = retainedEarnings / totalAssets;
    const t3 = ebit / totalAssets;
    // For T4 we need Market Value of Equity / Total Liabilities. 
    // We'll use Book Value of Equity for private companies formula: Z' = 0.717T1 + 0.847T2 + 3.107T3 + 0.420T4 + 0.998T5 (where T5 is Sales / Total Assets)
    // Actually the standard private model: Z' = 6.56(T1) + 3.26(T2) + 6.72(T3) + 1.05(T4)
    const t4 = totalLiabilities === 0 ? 1 : equity / totalLiabilities;
    
    const zScore = (6.56 * t1) + (3.26 * t2) + (6.72 * t3) + (1.05 * t4);

    let zone = 'Unknown';
    let color = 'gray';
    let trend = 'neutral';
    
    if (zScore > 2.9) {
      zone = 'Safe Zone';
      color = 'green';
      trend = 'positive';
    } else if (zScore > 1.23 && zScore <= 2.9) {
      zone = 'Grey Zone';
      color = 'orange';
      trend = 'neutral';
    } else {
      zone = 'Distress Zone';
      color = 'red';
      trend = 'negative';
    }

    return {
      metrics: [
        { label: 'Altman Z-Score', value: zScore.toFixed(2), trend, color },
        { label: 'Risk Zone', value: zone, color },
        { label: 'Working Capital / Assets', value: (t1 * 100).toFixed(1) + '%' },
        { label: 'EBIT / Assets', value: (t3 * 100).toFixed(1) + '%' }
      ],
      charts: [],
      insights: [
        `The entity scored ${zScore.toFixed(2)}, placing it in the ${zone}.`,
        zone === 'Distress Zone' ? 'CRITICAL: The Z-Score indicates a high statistical probability of insolvency or bankruptcy within the next 24 months based on current balance sheet ratios.' : 
        zone === 'Safe Zone' ? 'The balance sheet shows strong solvency characteristics, indicating very low risk of financial distress.' :
        'The entity is in the Grey Zone, indicating mixed financial signals. Close monitoring of working capital and EBIT is recommended.',
        `Working capital constitutes ${(t1 * 100).toFixed(1)}% of total assets, which is a key driver of short-term liquidity.`
      ]
    };
  }
};
