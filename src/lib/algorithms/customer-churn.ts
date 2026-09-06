import { AlgorithmDefinition, AlgoResult } from './types';
import { parseLocalDate } from '../../lib/utils';
import { isPostable, lineAmount } from '../../lib/txFilters';

export const CUSTOMER_CHURN_ALGO: AlgorithmDefinition = {
  id: 'intelligence_6',
  name: 'Customer Churn & Attrition Analysis',
  domain: 'operations',
  tags: ['Sales', 'Customers', 'Churn', 'Retention'],
  description: 'Identifies previously active revenue-generating customers who have stopped purchasing, flagging them as churned or at-risk.',
  inputs: [
    { key: 'churnThresholdDays', label: 'Churn Threshold (Days)', min: 30, max: 365, step: 30, defaultValue: 90 }
  ],
  compute: (ctx, inputs): AlgoResult => {
    const { transactions, accounts, accounting } = ctx;
    const thresholdDays = inputs.churnThresholdDays ?? 90;
    
    // Identification of customers from transaction data based on income/revenue
    const customerLastSeen: Record<string, number> = {};
    const customerValue: Record<string, number> = {};
    
    let maxTxDate = 0;

    transactions.forEach(tx => {
       if (!isPostable(tx)) return;
       if (tx.date) {
          const d = parseLocalDate(tx.date).getTime();
          if (d > maxTxDate) maxTxDate = d;
       }
       
       let isRevenue = false;
       let txAmount = 0;
       tx.lines.forEach(l => {
          if (accounting.isRevenue(l.accountId)) {
             isRevenue = true;
             txAmount += Math.abs(lineAmount(l, tx));
          }
       });

       if (isRevenue && txAmount > 0) {
          const payee = (tx.payee || tx.description || 'Unknown Customer').toUpperCase().trim();
          const txDate = parseLocalDate(tx.date).getTime();
          
          if (!customerLastSeen[payee] || txDate > customerLastSeen[payee]) {
             customerLastSeen[payee] = txDate;
          }
          if (!customerValue[payee]) customerValue[payee] = 0;
          customerValue[payee] += txAmount;
       }
    });

    const now = maxTxDate > 0 ? maxTxDate : new Date().getTime();
    let totalCustomers = 0;
    let churnedCustomers = 0;
    let atRiskCustomers = 0;
    let activeCustomers = 0;
    
    let lostRevenue = 0;
    const chartData: any[] = [];

    Object.entries(customerLastSeen).forEach(([customer, lastSeen]) => {
       totalCustomers++;
       const daysSinceLastTx = (now - lastSeen) / (1000 * 60 * 60 * 24);
       
       if (daysSinceLastTx > thresholdDays) {
          churnedCustomers++;
          lostRevenue += customerValue[customer];
          chartData.push({
             Customer: customer,
             Status: 'Churned',
             DaysSinceActive: Math.round(daysSinceLastTx)
          });
       } else if (daysSinceLastTx > thresholdDays * 0.7) {
          atRiskCustomers++;
          chartData.push({
             Customer: customer,
             Status: 'At Risk',
             DaysSinceActive: Math.round(daysSinceLastTx)
          });
       } else {
          activeCustomers++;
       }
    });

    if (totalCustomers === 0) {
      return {
        metrics: [{ label: 'Status', value: 'No Customer Data' }],
        charts: [],
        insights: ['No recognizable revenue/customer transactions found to analyze churn.']
      };
    }

    const churnRate = totalCustomers === 0 ? 0 : (churnedCustomers / totalCustomers) * 100;
    
    // Sort chart data
    chartData.sort((a, b) => b.DaysSinceActive - a.DaysSinceActive);
    const topChartData = chartData.slice(0, 15);

    let churnColor = 'green';
    let churnTrend = 'positive';
    if (churnRate > 15) { churnColor = 'red'; churnTrend = 'negative'; }
    else if (churnRate > 5) { churnColor = 'orange'; churnTrend = 'neutral'; }

    return {
      metrics: [
        { label: 'Overall Churn Rate', value: `${churnRate.toFixed(1)}%`, color: churnColor, trend: churnTrend },
        { label: 'Total Customers', value: totalCustomers.toString() },
        { label: 'Active', value: activeCustomers.toString(), color: 'green' },
        { label: 'At Risk', value: atRiskCustomers.toString(), color: 'orange' },
        { label: 'Churned', value: churnedCustomers.toString(), color: 'red' }
      ],
      charts: [
        {
          config: {
            xKey: 'Customer',
            yKeys: [{ key: 'DaysSinceActive', name: 'Days Inactive', color: '#f43f5e', type: 'bar' }]
          },
          data: topChartData
        }
      ],
      insights: [
        `Of ${totalCustomers} historically active customers, ${churnedCustomers} have not purchased in over ${inputs.churnThresholdDays} days (Churn Rate: ${churnRate.toFixed(1)}%).`,
        `There are ${atRiskCustomers} customers currently "At Risk" (approaching the threshold). Targeted retention campaigns recommended.`,
        lostRevenue > 0 ? `The historical lifetime value associated with currently churned customers is $${(lostRevenue/100).toLocaleString()}.` : ''
      ]
    };
  }
};
