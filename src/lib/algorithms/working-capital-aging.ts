import { AlgorithmDefinition, AlgoResult } from './types';

export const WORKING_CAPITAL_AGING_ALGO: AlgorithmDefinition = {
  id: 'ops_2',
  name: 'Working Capital & Invoice Aging',
  domain: 'operations',
  tags: ['Working Capital', 'Receivables', 'Payables', 'Aging', 'Cash Flow'],
  description: 'Analyzes unpaid invoices and bills to identify late payments and assess short-term liquidity bottlenecks.',
  inputs: [
    { key: 'lateThresholdDays', label: 'Overdue Warning (Days)', min: 1, max: 120, step: 5, defaultValue: 30 }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    // Note: Since this simulated ledger may not track explicit invoices/bills perfectly in the pure transactions array,
    // this logic uses the transaction date vs current date for pending/unpaid items if available.
    
    let arPending = 0;
    let apPending = 0;
    let arOverdue = 0;
    let apOverdue = 0;

    const thresholdDays = inputs.lateThresholdDays || 30;
    const now = new Date().getTime();

    const chartData = [
       { Bucket: 'Current', AR: 0, AP: 0 },
       { Bucket: '1-30 Days Late', AR: 0, AP: 0 },
       { Bucket: '31-60 Days Late', AR: 0, AP: 0 },
       { Bucket: '60+ Days Late', AR: 0, AP: 0 }
    ];

    transactions.forEach(tx => {
       // Look for pending transactions representing unpaid invoices/bills
       if (tx.status !== 'pending') return;
       
       const txDate = new Date(tx.date).getTime();
       const daysOld = (now - txDate) / (1000 * 60 * 60 * 24);
       
       let isAR = false;
       let isAP = false;
       let amount = 0;

       tx.lines.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc) {
             const type = (acc.type || '').toLowerCase();
             const name = (acc.name || '').toLowerCase();
             if (type.includes('receivable') || name.includes('ar')) {
                isAR = true;
                amount += Math.abs(l.amountCents);
             } else if (type.includes('payable') || name.includes('ap')) {
                isAP = true;
                amount += Math.abs(l.amountCents);
             }
          }
       });

       if (isAR) {
          arPending += amount;
          if (daysOld > thresholdDays) arOverdue += amount;
          
          if (daysOld <= 0) chartData[0].AR += (amount/100);
          else if (daysOld <= 30) chartData[1].AR += (amount/100);
          else if (daysOld <= 60) chartData[2].AR += (amount/100);
          else chartData[3].AR += (amount/100);
          
       } else if (isAP) {
          apPending += amount;
          if (daysOld > thresholdDays) apOverdue += amount;
          
          if (daysOld <= 0) chartData[0].AP += (amount/100);
          else if (daysOld <= 30) chartData[1].AP += (amount/100);
          else if (daysOld <= 60) chartData[2].AP += (amount/100);
          else chartData[3].AP += (amount/100);
       }
    });

    if (arPending === 0 && apPending === 0) {
      return {
        metrics: [{ label: 'Status', value: 'No Pending Invoices' }],
        charts: [],
        insights: ['No pending (unpaid) transactions mapping to AR or AP accounts were found.']
      };
    }

    const netPending = arPending - apPending;
    
    let arHealth = 'green';
    if (arOverdue > (arPending * 0.3)) arHealth = 'red'; // More than 30% AR is overdue
    else if (arOverdue > 0) arHealth = 'orange';

    return {
      metrics: [
        { label: 'Total Pending AR', value: `$${(arPending/100).toLocaleString()}` },
        { label: 'Total Pending AP', value: `$${(apPending/100).toLocaleString()}` },
        { label: 'Severely Overdue AR', value: `$${(arOverdue/100).toLocaleString()}`, color: arHealth },
        { label: 'Net Working Capital (Pending)', value: `$${(netPending/100).toLocaleString()}`, color: netPending >= 0 ? 'green' : 'orange' }
      ],
      charts: [
        {
          config: {
            xKey: 'Bucket',
            yKeys: [
               { key: 'AR', name: 'Accounts Receivable ($)', color: '#3b82f6', type: 'bar' },
               { key: 'AP', name: 'Accounts Payable ($)', color: '#f43f5e', type: 'bar' }
            ]
          },
          data: chartData
        }
      ],
      insights: [
        `There is $${(arPending/100).toLocaleString()} tied up in unpaid customer invoices (AR) and $${(apPending/100).toLocaleString()} outstanding in supplier bills (AP).`,
        arOverdue > 0 ? `WARNING: $${(arOverdue/100).toLocaleString()} of Accounts Receivable is significantly overdue (> ${inputs.lateThresholdDays} days). Immediate collection efforts recommended.` : 'Receivables collection is healthy with no severely overdue invoices.',
        netPending < 0 ? 'Short-term liquidity crunch: Pending payables exceed pending receivables.' : 'Working capital structure is positive.'
      ]
    };
  }
};
