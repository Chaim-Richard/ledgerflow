import { Transaction, ChartAccount } from '../../types';
import { AlgorithmDefinition } from './types';

// Takes a number (e.g. net profit) and the transactions that make it up, and generates a natural sentence.
export function explainNetProfit(transactions: Transaction[], month: string) {
    let revenue = 0;
    let expenses = 0;
    const expenseMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();

    transactions.forEach(t => {
        if (!t.date.startsWith(month)) return; // Filter by month (YYYY-MM)

        const amt = t.totalAmountCents;
        const payee = t.payee || t.description || 'Unknown';

        if (amt > 0) {
            revenue += amt;
            revenueMap.set(payee, (revenueMap.get(payee) || 0) + amt);
        } else {
            const absAmt = Math.abs(amt);
            expenses += absAmt;
            expenseMap.set(payee, (expenseMap.get(payee) || 0) + absAmt);
        }
    });

    const netProfit = revenue - expenses;

    // Find biggest drivers
    let biggestRev = { payee: '', amt: 0 };
    revenueMap.forEach((amt, payee) => { if (amt > biggestRev.amt) biggestRev = { payee, amt }; });

    let biggestExp = { payee: '', amt: 0 };
    expenseMap.forEach((amt, payee) => { if (amt > biggestExp.amt) biggestExp = { payee, amt }; });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthStr = monthNames[parseInt(month.split('-')[1]) - 1] || month;

    let sentence = `You made $${(netProfit/100).toFixed(0)} in ${monthStr}: $${(revenue/100).toFixed(0)} earned`;
    if (biggestRev.amt > 0) sentence += ` (mostly ${biggestRev.payee}, $${(biggestRev.amt/100).toFixed(0)})`;
    
    sentence += ` minus $${(expenses/100).toFixed(0)} spent`;
    if (biggestExp.amt > 0) sentence += ` (biggest: ${biggestExp.payee} $${(biggestExp.amt/100).toFixed(0)}).`;

    return { sentence, netProfit, revenue, expenses };
}

export const NUMBER_EXPLAINER_ALGO: AlgorithmDefinition = {
  id: 'number_explainer',
  domain: 'finance',
  name: 'Number Explainer (Data to Text)',
  description: 'Turns raw figures like Net Profit into a plain-English explanatory sentence by analyzing the top drivers.',
  inputs: [
      { key: 'targetMonth', label: 'Month Index (1-12)', min: 1, max: 12, step: 1, defaultValue: new Date().getMonth() + 1 }
  ],
  compute: (transactions, accounts, inputs) => {
    const start = performance.now();
    
    const year = new Date().getFullYear();
    const monthStr = `${year}-${inputs.targetMonth.toString().padStart(2, '0')}`;
    
    const result = explainNetProfit(transactions, monthStr);
    const ms = performance.now() - start;

    return {
      metrics: [
        { label: 'Net Profit', value: `$${(result.netProfit/100).toFixed(2)}` },
        { label: 'Execution Time', value: `${ms.toFixed(2)} ms` }
      ],
      charts: [],
      insights: [
        `Explanation generated: "${result.sentence}"`,
        'By layering a template generator over existing data, we convert the app from "for accountants" to "for anyone".',
        'Adds glossary layers implicitly (e.g. framing money in vs money out).'
      ]
    };
  }
};
