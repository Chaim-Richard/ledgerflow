import { Transaction, ChartAccount } from '../../types';
import { AlgorithmDefinition } from './types';
import { isPostable, lineAmount } from '../../lib/txFilters';

// Calculates running safe-to-spend balance based on virtual envelopes
export function calculateSafeToSpend(transactions: readonly Transaction[], accounts: readonly ChartAccount[], entityType: string = 'c_corp') {
    let revenue = 0;
    let expenses = 0;
    let rawCash = 0;

    const accountMap = new Map(accounts.map(a => [a.id, a]));

    transactions.forEach(t => {
        if (!isPostable(t)) return;
        
        // Raw cash is the sum of positive vs negative transaction totals
        const rate = t.exchangeRate || 1;
        const convertedCents = Math.round(t.totalAmountCents * rate);
        if (convertedCents > 0) {
            rawCash += convertedCents;
        } else {
            rawCash -= Math.abs(convertedCents);
        }

        // Revenue and expenses filtered by account type
        if (t.lines) {
            t.lines.forEach(line => {
                const account = accountMap.get(line.accountId);
                if (account) {
                    const amt = lineAmount(line, t);
                    const catLower = (account.category || '').toLowerCase();
                    if (account.type === 'income' || account.type === 'revenue' || catLower === 'revenue' || catLower === 'income') {
                        revenue += Math.abs(amt);
                    } else if (account.type === 'expense' || account.type === 'cost_of_goods' || catLower === 'cogs' || catLower === 'expense' || catLower === 'direct costs') {
                        expenses += Math.abs(amt);
                    }
                }
            });
        }
    });

    const netProfitCents = Math.max(0, revenue - expenses);
    const netProfit = netProfitCents / 100;

    let estimatedTax: number;
    if (entityType === 'pass_through') {
        // Individual income + self-employment tax estimate (approx. 25% blended)
        estimatedTax = netProfit * 0.25;
    } else if (entityType === 'flat_20') {
        estimatedTax = netProfit * 0.20;
    } else {
        // C-Corp flat rate under TCJA (21%)
        estimatedTax = netProfit * 0.21;
    }

    const estimatedTaxCents = Math.round(estimatedTax * 100);
    const effectiveTaxRate = netProfit > 0 ? (estimatedTax / netProfit) * 100 : 0;
    
    // Operating Reserve Policy (2 months of average expenses)
    const monthKeys = new Set<string>();
    transactions.forEach(t => {
        if (!isPostable(t)) return;
        if (t.date && typeof t.date === 'string') {
            const m = t.date.slice(0, 7);
            if (/^\d{4}-\d{2}$/.test(m)) monthKeys.add(m);
        }
    });
    const activeMonths = Math.max(1, monthKeys.size);
    const averageMonthlyExpenseCents = expenses / activeMonths;
    const recommendedReserveCents = Math.round(averageMonthlyExpenseCents * 2);

    const safeToSpendCents = rawCash - estimatedTaxCents - recommendedReserveCents;

    return { 
        revenueCents: revenue, 
        expensesCents: expenses, 
        netProfitCents, 
        estimatedTaxCents, 
        effectiveTaxRate,
        recommendedReserveCents,
        rawCashCents: rawCash, 
        safeToSpendCents 
    };
}

export const TAX_SET_ASIDE_ALGO: AlgorithmDefinition = {
  id: 'tax_set_aside',
  domain: 'planning',
  name: 'Virtual Tax Envelopes (Safe-to-Spend)',
  tags: ['Tax', 'Treasury', 'Liquidity', 'Envelopes'],
  description: 'Maintains a running tax estimate on YTD net profit and a standard operating reserve to calculate a mathematically rigorous "Safe to Spend" number.',
  inputs: [
    {
      kind: 'select',
      key: 'entityType',
      label: 'Tax Entity Structure',
      options: [
        { value: 'c_corp', label: 'C-Corporation (21% Flat Federal Tax)' },
        { value: 'pass_through', label: 'Pass-Through / LLC / Sole Prop (25% Blended Inc + SE Tax)' },
        { value: 'flat_20', label: 'Flat Tax Reserve (20%)' }
      ],
      defaultValue: 'c_corp'
    }
  ],
  compute: (ctx, inputs) => {
    const { transactions, accounts } = ctx;
    const entityType = inputs['entityType'] || 'c_corp';
    const result = calculateSafeToSpend(transactions, accounts, entityType);

    return {
      metrics: [
        { label: 'Raw Liquidity', value: `$${(result.rawCashCents/100).toLocaleString(undefined, {minimumFractionDigits: 2})}` },
        { label: 'YTD Tax Reserve', value: `$${(result.estimatedTaxCents/100).toLocaleString(undefined, {minimumFractionDigits: 2})}`, color: 'red' },
        { label: 'Operating Buffer (60-Days)', value: `$${(result.recommendedReserveCents/100).toLocaleString(undefined, {minimumFractionDigits: 2})}`, color: 'orange' },
        { label: 'True Safe-to-Spend', value: `$${(result.safeToSpendCents/100).toLocaleString(undefined, {minimumFractionDigits: 2})}`, color: 'green' }
      ],
      charts: [
          {
             data: [
                 { name: 'Raw Cash', value: result.rawCashCents / 100 },
                 { name: 'Tax Reserve', value: result.estimatedTaxCents / 100 },
                 { name: 'Opex Buffer', value: result.recommendedReserveCents / 100 },
                 { name: 'Safe to Spend', value: Math.max(0, result.safeToSpendCents / 100) }
             ],
             config: { xKey: 'name', yKeys: [{ key: 'value', color: '#10b981', name: 'Allocation ($)', type: 'bar' }] }
          }
      ],
      insights: [
        `Calculated an effective tax rate of ${result.effectiveTaxRate.toFixed(2)}% resulting in a $${(result.estimatedTaxCents/100).toLocaleString()} projected liability on $${(result.netProfitCents/100).toLocaleString()} YTD net profit (${result.expensesCents > 0 ? `$${(result.expensesCents/100).toLocaleString()} recognized expenses` : 'zero expenses'}).`,
        `Automatically modeled a 60-day operating expense buffer of $${(result.recommendedReserveCents/100).toLocaleString()} based on trailing transactional averages.`,
        result.safeToSpendCents < 0 
          ? 'WARNING: Current liquidity is insufficient to cover accrued tax liabilities and standard operating reserves. Immediate capital intervention required.'
          : 'By surfacing "Safe to Spend" instead of "Cash Balance", structural insolvency anxiety is removed. The books are mathematically clear.'
      ]
    };
  }
};
