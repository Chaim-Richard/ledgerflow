import { AlgorithmDefinition, AlgoResult } from './types';
import { isPostable, lineAmount } from '../../lib/txFilters';

export const SAAS_UNIT_ECONOMICS_ALGO: AlgorithmDefinition = {
  id: 'planning_6',
  name: 'SaaS Unit Economics (LTV/CAC)',
  domain: 'planning',
  tags: ['SaaS', 'LTV', 'CAC', 'Churn', 'Gross Margin'],
  description: 'Evaluates SaaS business model viability by approximating Customer Acquisition Cost (CAC) vs Lifetime Value (LTV).',
  inputs: [
    { key: 'assumedChurnPct', label: 'Assumed Monthly Churn (%)', min: 1, max: 20, step: 1, defaultValue: 3 },
    { key: 'newCustomers', label: 'New Customers Acquired (Count)', min: 1, max: 1000, step: 10, defaultValue: 50 }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    const churnRate = (inputs.assumedChurnPct ?? 3) / 100;
    const newCustomers = inputs.newCustomers ?? 50;

    let totalMarketingSpend = 0;
    let mrr = 0; // Approx MRR based on recent revenue
    let cogs = 0;

    transactions.forEach(tx => {
       if (!isPostable(tx)) return;
       tx.lines.forEach(l => {
          const acc = accounts.find(a => a.id === l.accountId);
          if (acc) {
             const name = (acc.name || '').toLowerCase();
             const type = (acc.type || '').toLowerCase();
             const cat = (acc.category || '').toLowerCase();
             const amt = Math.abs(lineAmount(l, tx));
             
             // Require expense type or marketing category to count as marketing spend
             const isExpense = type === 'expense' || cat === 'expense' || cat === 'marketing';
             const isMarketingName = name.includes('marketing') || name.includes('advertising') || name.includes('adwords') || name.includes('promotion') || name.includes('acquisition') || name.includes('sales commission');
             
             if (isExpense && isMarketingName) {
                totalMarketingSpend += amt;
             }
             if (type === 'income' || type === 'revenue' || cat === 'revenue' || cat === 'income' || cat === 'sales') {
                mrr += amt;
             }
             if (type === 'cost_of_goods' || cat === 'cogs' || (isExpense && (name.includes('hosting') || name.includes('cloud') || name.includes('infrastructure')))) {
                cogs += amt;
             }
          }
       });
    });

    if (totalMarketingSpend === 0 || mrr === 0) {
      return {
        metrics: [{ label: 'Status', value: 'Insufficient SaaS Data' }],
        charts: [],
        insights: ['Unit economics calculation requires Sales & Marketing expenses and recorded Revenue to compute CAC and LTV.']
      };
    }

    // Assumptions for the period based on ledger data
    // Assuming transactions represent a 1-month period for simplicity.
    const grossMarginPct = mrr > 0 ? ((mrr - cogs) / mrr) : 0;
    const arpu = newCustomers > 0 ? (mrr / newCustomers) : 0; // Simplistic ARPU
    
    // CAC = Total Marketing Spend / New Customers
    const cac = totalMarketingSpend / newCustomers;

    // LTV = (ARPU * Gross Margin) / Churn Rate
    const ltv = churnRate > 0 ? ((arpu * grossMarginPct) / churnRate) : 0;

    const ltvCacRatio = cac > 0 ? (ltv / cac) : 0;
    const paybackMonths = (arpu * grossMarginPct) > 0 ? (cac / (arpu * grossMarginPct)) : 0;

    const chartData = [
       { Metric: 'LTV ($)', Value: ltv / 100 },
       { Metric: 'CAC ($)', Value: cac / 100 }
    ];

    let ratioColor = 'gray';
    if (ltvCacRatio >= 3) ratioColor = 'green';
    else if (ltvCacRatio >= 1) ratioColor = 'orange';
    else ratioColor = 'red';

    return {
      metrics: [
        { label: 'LTV:CAC Ratio', value: `${ltvCacRatio.toFixed(1)}x`, color: ratioColor },
        { label: 'Customer Lifetime Value', value: `$${(ltv/100).toLocaleString(undefined, {maximumFractionDigits:0})}` },
        { label: 'Customer Acquisition Cost', value: `$${(cac/100).toLocaleString(undefined, {maximumFractionDigits:0})}` },
        { label: 'Payback Period', value: `${paybackMonths.toFixed(1)} Mos` }
      ],
      charts: [
        {
          config: {
            xKey: 'Metric',
            yKeys: [{ key: 'Value', name: 'Dollars per Customer', color: '#14b8a6', type: 'bar' }]
          },
          data: chartData
        }
      ],
      insights: [
        `For every $1 spent on acquisition (CAC: $${(cac/100).toFixed(0)}), the entity expects to generate $${(ltv/100).toFixed(0)} in lifetime value.`,
        `The LTV:CAC ratio is ${ltvCacRatio.toFixed(1)}x. A ratio > 3.0x is considered healthy for a SaaS business.`,
        `It takes approximately ${paybackMonths.toFixed(1)} months to recover the CAC based on current gross margins (${(grossMarginPct*100).toFixed(1)}%).`
      ]
    };
  }
};
