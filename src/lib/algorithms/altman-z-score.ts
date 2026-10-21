import { AlgorithmDefinition } from './types';
import { isPostable, lineAmount } from '../../lib/txFilters';

export const ALTMAN_Z_SCORE_ALGO: AlgorithmDefinition = {
  id: 'valuation_2',
  name: 'Altman Z-Score (Solvency Risk)',
  domain: 'finance',
  tags: ['Solvency', 'Risk', 'Bankruptcy', 'Z-Score'],
  description: 'Calculates the Altman Z-Score to predict the probability of bankruptcy or severe financial distress based on balance sheet and income statement ratios.',
  inputs: [],
  compute: (ctx, _inputs) => {
    const { transactions, accounts, accounting } = ctx;
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let currentAssets = 0;
    let currentLiabilities = 0;
    let retainedEarnings = 0;
    let equity = 0;

    accounts.forEach(acc => {
      const cat = acc.category?.toLowerCase() || '';
      const name = acc.name?.toLowerCase() || '';
      const bal = acc.balanceCents || 0;

      if (accounting.isAsset(acc.id)) {
        totalAssets += bal;
        if (accounting.isCash(acc.id) || accounting.isAR(acc.id) || cat.includes('current') || name.includes('current')) {
          currentAssets += bal;
        }
      } else if (accounting.isLiability(acc.id)) {
        totalLiabilities += Math.abs(bal);
        if (accounting.isAP(acc.id) || cat.includes('current') || name.includes('current') || cat.includes('short') || name.includes('short')) {
          currentLiabilities += Math.abs(bal);
        }
      } else if (accounting.isEquity(acc.id)) {
        const eqVal = -bal;
        equity += eqVal;
        if (cat.includes('retained') || name.includes('retained')) {
          retainedEarnings += eqVal;
        }
      }
    });

    // EBIT from the posted lines, each with its own sign (AUD-19): revenue is a credit (negative), so a sale adds
    // and its reversal (a debit) takes it away again; costs are debits, so a cost subtracts and its reversal adds
    // back. Interest and income tax are left out (earnings before interest and taxes), found by the account's name
    // or category — an expense account's type is only ever "expense".
    const beforeInterestAndTax = (accountId: string) => {
      const acc = accounts.find(a => a.id === accountId);
      const words = `${acc?.name || ''} ${acc?.category || ''}`.toLowerCase();
      return !/\binterest\b|income tax|tax expense|corporate tax/.test(words);
    };
    let ebit = 0;
    transactions.forEach(t => {
      if (!isPostable(t)) return;
      t.lines.forEach(l => {
        const amt = lineAmount(l, t);
        if (accounting.isRevenue(l.accountId)) {
          ebit -= amt;
        } else if ((accounting.isExpense(l.accountId) || accounting.isCOGS(l.accountId)) && beforeInterestAndTax(l.accountId)) {
          ebit -= amt;
        }
      });
    });

    if (totalAssets <= 0) {
      return {
        metrics: [
          { label: 'Z-Score', value: 'N/A' }
        ],
        charts: [],
        insights: ['Total Assets are zero or negative. Altman Z-Score requires a capitalized balance sheet to calculate meaningful solvency metrics.']
      };
    }

    const safeTotalAssets = Math.max(totalAssets, 1);
    const workingCapital = currentAssets - currentLiabilities;
    const t1 = workingCapital / safeTotalAssets;
    const t2 = retainedEarnings / safeTotalAssets;
    const t3 = ebit / safeTotalAssets;
    // For T4 we need Market Value of Equity / Total Liabilities. 
    // We'll use Book Value of Equity for private companies formula: Z' = 0.717T1 + 0.847T2 + 3.107T3 + 0.420T4 + 0.998T5 (where T5 is Sales / Total Assets)
    // Actually the standard private model: Z' = 6.56(T1) + 3.26(T2) + 6.72(T3) + 1.05(T4)
    const t4 = totalLiabilities === 0 ? 1 : equity / totalLiabilities;
    
    const zScore = (6.56 * t1) + (3.26 * t2) + (6.72 * t3) + (1.05 * t4);

    let zone: string;
    let color: string;
    let trend: string;
    
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
