import { AlgorithmDefinition, AlgoResult } from './types';
import { parseLocalDate } from '../../lib/utils';

export const VENDOR_CHURN_ALGO: AlgorithmDefinition = {
  id: 'ops_vendor_churn',
  name: 'Vendor Churn & Ghosting',
  domain: 'operations',
  tags: ['Vendors', 'AP', 'Operations', 'Risk'],
  description: 'Identifies vendors that were previously paid on a regular basis but have unexpectedly stopped billing, which may indicate cancelled SaaS, ghost vendors, or service interruption.',
  inputs: [
    {
      key: 'inactivityDays',
      label: 'Inactivity Threshold (Days)',
      min: 30,
      max: 180,
      step: 15,
      defaultValue: 90
    }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    const inactivityDays = inputs['inactivityDays'] ?? 90;
    const inactivityMs = inactivityDays * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    
    // Group transactions by Payee/Description
    const vendorHistory: Record<string, number[]> = {};
    
    transactions.forEach(tx => {
      // Look for outgoing payments (negative net amount, or just filter on expenses)
      // We will look at payee or description
      const name = (tx.payee || tx.description || 'Unknown').trim();
      if (!name || name.toLowerCase() === 'unknown') return;
      
      const txTime = parseLocalDate(tx.date).getTime();
      
      if (!vendorHistory[name]) {
        vendorHistory[name] = [];
      }
      vendorHistory[name].push(txTime);
    });
    
    let activeVendors = 0;
    let churnedVendors = 0;
    let singleUseVendors = 0;
    
    // Determine the status of each vendor
    const churnRiskScores: Array<{name: string, daysSince: number, txCount: number}> = [];
    
    Object.keys(vendorHistory).forEach(name => {
      const history = vendorHistory[name].sort((a, b) => a - b);
      
      if (history.length <= 2) {
        singleUseVendors++;
        return; // Need a history to establish a pattern
      }
      
      const lastTxTime = history[history.length - 1];
      const daysSinceLast = (now - lastTxTime) / (1000 * 60 * 60 * 24);
      
      // Was there a regular cadence?
      // Find average gap
      let totalGap = 0;
      for (let i = 1; i < history.length; i++) {
        totalGap += (history[i] - history[i-1]);
      }
      const avgGapMs = totalGap / (history.length - 1);
      const avgGapDays = avgGapMs / (1000 * 60 * 60 * 24);
      
      // If the vendor usually bills every ~30 days, and it's been > 90 days
      if (daysSinceLast > Math.max(avgGapDays * 2, inactivityDays)) {
        churnedVendors++;
        churnRiskScores.push({
          name,
          daysSince: daysSinceLast,
          txCount: history.length
        });
      } else {
        activeVendors++;
      }
    });
    
    // Sort churned by txCount (highest history first)
    churnRiskScores.sort((a, b) => b.txCount - a.txCount);
    
    const insights = [];
    insights.push(`Analyzed ${Object.keys(vendorHistory).length} unique payees/vendors.`);
    
    if (churnedVendors > 0) {
      insights.push(`Detected ${churnedVendors} vendors that established a recurring billing pattern but have gone silent for >${inactivityDays} days.`);
      const topChurn = churnRiskScores.slice(0, 3);
      insights.push(`Top silent vendors: ${topChurn.map(v => `"${v.name}" (${Math.round(v.daysSince)} days ago)`).join(', ')}.`);
    } else {
      insights.push(`No regular vendors have exceeded the ${inactivityDays}-day inactivity threshold.`);
    }

    const chartData = [
      { Category: 'Active Recurring', Count: activeVendors },
      { Category: 'Silent / Churned', Count: churnedVendors },
      { Category: 'One-off / Irregular', Count: singleUseVendors }
    ];

    return {
      metrics: [
        { label: 'Active Vendors', value: activeVendors },
        { label: 'Silent Vendors', value: churnedVendors, color: churnedVendors > 0 ? 'text-amber-500' : 'text-slate-500' },
        { label: 'Top Silent Gap', value: churnRiskScores.length > 0 ? `${Math.round(churnRiskScores[0].daysSince)}d` : '0d' }
      ],
      charts: [
        {
          config: {
            xKey: 'Category',
            yKeys: [
              { key: 'Count', name: 'Vendor Count', color: '#8b5cf6', type: 'bar' }
            ]
          },
          data: chartData
        }
      ],
      insights
    };
  }
};
