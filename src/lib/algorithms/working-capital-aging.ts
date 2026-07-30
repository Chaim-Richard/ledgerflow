import { AlgorithmDefinition, AlgoResult } from './types';
import { resolveAccountRole } from '../accountUtils';

export const WORKING_CAPITAL_AGING_ALGO: AlgorithmDefinition = {
  id: 'ops_2',
  name: 'Working Capital & Invoice Aging',
  domain: 'operations',
  tags: ['Working Capital', 'Receivables', 'Payables', 'Aging', 'Cash Flow'],
  description: 'Analyzes unpaid invoices and bills to identify late payments and assess short-term liquidity bottlenecks based on due dates.',
  inputs: [
    { key: 'lateThresholdDays', label: 'Overdue Warning (Days)', min: 1, max: 120, step: 5, defaultValue: 30 }
  ],
  compute: (transactions, accounts, inputs, context): AlgoResult => {
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

    let hasProcessedData = false;

    // 1. Process explicit Invoices from context
    if (context?.invoices && context.invoices.length > 0) {
      context.invoices.forEach(inv => {
        if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') return;
        hasProcessedData = true;
        const dueDateStr = inv.dueDate || inv.date;
        const dueDate = dueDateStr ? new Date(dueDateStr).getTime() : now;
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        const amount = Math.abs(inv.amountCents || inv.totalCents || 0);

        arPending += amount;
        if (daysOverdue > thresholdDays) arOverdue += amount;

        if (daysOverdue <= 0) chartData[0].AR += (amount / 100);
        else if (daysOverdue <= 30) chartData[1].AR += (amount / 100);
        else if (daysOverdue <= 60) chartData[2].AR += (amount / 100);
        else chartData[3].AR += (amount / 100);
      });
    }

    // 2. Process explicit Bills from context
    if (context?.bills && context.bills.length > 0) {
      context.bills.forEach(bill => {
        if (bill.status === 'paid' || bill.status === 'void' || bill.status === 'draft') return;
        hasProcessedData = true;
        const dueDateStr = bill.dueDate || bill.date;
        const dueDate = dueDateStr ? new Date(dueDateStr).getTime() : now;
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        const amount = Math.abs(bill.amountCents || 0);

        apPending += amount;
        if (daysOverdue > thresholdDays) apOverdue += amount;

        if (daysOverdue <= 0) chartData[0].AP += (amount / 100);
        else if (daysOverdue <= 30) chartData[1].AP += (amount / 100);
        else if (daysOverdue <= 60) chartData[2].AP += (amount / 100);
        else chartData[3].AP += (amount / 100);
      });
    }

    // 3. Fallback: If no explicit invoices or bills in context, analyze transactions array
    if (!hasProcessedData && transactions && transactions.length > 0) {
      transactions.forEach(tx => {
        if (tx.status === 'void' || tx.status === 'reconciled') return;

        let isAR = false;
        let isAP = false;
        let amount = 0;

        tx.lines?.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc) {
            const role = resolveAccountRole(acc);
            if (role === 'ar') {
              isAR = true;
              amount += Math.abs(l.amountCents);
            } else if (role === 'ap') {
              isAP = true;
              amount += Math.abs(l.amountCents);
            }
          }
        });

        if (!isAR && !isAP) return;

        const dueDateStr = tx.dueDate || tx.date;
        const dueDate = dueDateStr ? new Date(dueDateStr).getTime() : now;
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        if (isAR) {
          arPending += amount;
          if (daysOverdue > thresholdDays) arOverdue += amount;

          if (daysOverdue <= 0) chartData[0].AR += (amount / 100);
          else if (daysOverdue <= 30) chartData[1].AR += (amount / 100);
          else if (daysOverdue <= 60) chartData[2].AR += (amount / 100);
          else chartData[3].AR += (amount / 100);
        } else if (isAP) {
          apPending += amount;
          if (daysOverdue > thresholdDays) apOverdue += amount;

          if (daysOverdue <= 0) chartData[0].AP += (amount / 100);
          else if (daysOverdue <= 30) chartData[1].AP += (amount / 100);
          else if (daysOverdue <= 60) chartData[2].AP += (amount / 100);
          else chartData[3].AP += (amount / 100);
        }
      });
    }

    if (arPending === 0 && apPending === 0) {
      return {
        metrics: [{ label: 'Status', value: 'No Pending Invoices' }],
        charts: [],
        insights: ['No open customer invoices or supplier bills were found in the system.']
      };
    }

    const netPending = arPending - apPending;

    let arHealth = 'green';
    if (arOverdue > (arPending * 0.3)) arHealth = 'red';
    else if (arOverdue > 0) arHealth = 'orange';

    return {
      metrics: [
        { label: 'Total Pending AR', value: `$${(arPending / 100).toLocaleString()}` },
        { label: 'Total Pending AP', value: `$${(apPending / 100).toLocaleString()}` },
        { label: 'Severely Overdue AR', value: `$${(arOverdue / 100).toLocaleString()}`, color: arHealth },
        { label: 'Net Working Capital (Pending)', value: `$${(netPending / 100).toLocaleString()}`, color: netPending >= 0 ? 'green' : 'orange' }
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
        `There is $${(arPending / 100).toLocaleString()} tied up in unpaid customer invoices (AR) and $${(apPending / 100).toLocaleString()} outstanding in supplier bills (AP).`,
        arOverdue > 0 ? `WARNING: $${(arOverdue / 100).toLocaleString()} of Accounts Receivable is significantly overdue (> ${inputs.lateThresholdDays} days past due date). Immediate collection efforts recommended.` : 'Receivables collection is healthy with no severely overdue invoices.',
        netPending < 0 ? 'Short-term liquidity crunch: Pending payables exceed pending receivables.' : 'Working capital structure is positive.'
      ]
    };
  }
};
