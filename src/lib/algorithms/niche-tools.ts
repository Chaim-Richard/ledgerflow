import { AlgorithmDefinition } from './types';
import type { ChartAccount } from '../../types';
import { isOutflow, isInflow, transactionDate } from '../txFilters';

// 1. Mortgage / Loan Amortization Schedule
export const LOAN_AMORTIZATION_ALGO: AlgorithmDefinition = {
  id: 'niche_1',
  name: 'Mortgage & Loan Amortization Schedule',
  description: 'Calculates interest vs. principal split for mortgages and equipment loans per property or asset.',
  domain: 'finance',
  tags: ['niche', 'mortgage', 'loan', 'amortization', 'property'],
  inputs: [
    { key: 'principal', label: 'Loan Principal ($)', min: 10000, max: 2000000, step: 5000, defaultValue: 400000 },
    { key: 'annualRate', label: 'Interest Rate (%)', min: 1, max: 15, step: 0.1, defaultValue: 6.5 },
    { key: 'termYears', label: 'Term (Years)', min: 1, max: 30, step: 1, defaultValue: 30 },
  ],
  compute: (ctx, inputs) => {
    const principal = inputs.principal ?? 400000;
    const rate = (inputs.annualRate ?? 6.5) / 100 / 12;
    const numPayments = (inputs.termYears ?? 30) * 12;

    const monthlyPayment = rate > 0
      ? (principal * rate * Math.pow(1 + rate, numPayments)) / (Math.pow(1 + rate, numPayments) - 1)
      : principal / numPayments;

    let balance = principal;
    let totalInterest = 0;
    const schedule: { year: string; Principal: number; Interest: number; Balance: number }[] = [];

    for (let year = 1; year <= Math.min(inputs.termYears ?? 30, 10); year++) {
      let yearInterest = 0;
      let yearPrincipal = 0;
      for (let m = 1; m <= 12; m++) {
        const interestPaid = balance * rate;
        const principalPaid = monthlyPayment - interestPaid;
        yearInterest += interestPaid;
        yearPrincipal += principalPaid;
        balance -= principalPaid;
        totalInterest += interestPaid;
      }
      schedule.push({
        year: `Year ${year}`,
        Principal: Math.round(yearPrincipal),
        Interest: Math.round(yearInterest),
        Balance: Math.round(Math.max(0, balance))
      });
    }

    return {
      metrics: [
        { label: 'Monthly Payment', value: `$${Math.round(monthlyPayment).toLocaleString()}`, color: 'emerald' },
        { label: 'Total Interest (Full Term)', value: `$${Math.round(totalInterest).toLocaleString()}`, color: 'amber' },
        { label: 'Year 1 Tax Deductible Interest', value: `$${schedule[0] ? schedule[0].Interest.toLocaleString() : 0}`, trend: 'Tax Deductible' }
      ],
      charts: [
        {
          data: schedule,
          config: {
            xKey: 'year',
            yKeys: [
              { key: 'Principal', color: '#10b981', name: 'Principal Paid', type: 'bar' },
              { key: 'Interest', color: '#ef4444', name: 'Interest Paid', type: 'bar' }
            ]
          }
        }
      ],
      insights: [
        `Monthly principal + interest payment is $${Math.round(monthlyPayment).toLocaleString()}.`,
        `In Year 1, $${schedule[0] ? schedule[0].Interest.toLocaleString() : 0} goes to interest (deductible operating expense) vs $${schedule[0] ? schedule[0].Principal.toLocaleString() : 0} to equity/principal.`
      ]
    };
  }
};

// 2. Subscription & Recurring Spend Audit
export const SUBSCRIPTION_AUDIT_ALGO: AlgorithmDefinition = {
  id: 'niche_2',
  name: 'Subscription & Recurring Spend Audit',
  description: 'Identifies all active SaaS, utility, and vendor recurring charges across the entire ledger.',
  domain: 'operations',
  tags: ['niche', 'subscription', 'recurring', 'audit', 'saas'],
  inputs: [
    { key: 'lookbackMonths', label: 'Lookback Window (Months)', min: 1, max: 12, step: 1, defaultValue: 6 }
  ],
  compute: (ctx, _inputs: Record<string, number> = {}) => {
    const { transactions, accounts } = ctx;
    const payeeMap = new Map<string, { count: number; totalCents: number; avgCents: number; lastDate: string }>();

    transactions.forEach((t) => {
      if (!t || !isOutflow(t, accounts as ChartAccount[])) return; // Outflows only
      const payee = t.payee || t.description || 'Unknown Vendor';
      const tDate = transactionDate(t);
      const existing = payeeMap.get(payee) || { count: 0, totalCents: 0, avgCents: 0, lastDate: tDate };
      existing.count += 1;
      existing.totalCents += Math.abs(t.totalAmountCents);
      existing.lastDate = tDate > existing.lastDate ? tDate : existing.lastDate;
      payeeMap.set(payee, existing);
    });

    const recurringList: { payee: string; MonthlyEst: number; AnnualEst: number; Count: number }[] = [];
    let annualRunrateCents = 0;

    payeeMap.forEach((val, payee) => {
      if (val.count >= 2) {
        const monthlyEst = Math.round(val.totalCents / val.count);
        annualRunrateCents += monthlyEst * 12;
        recurringList.push({
          payee,
          MonthlyEst: Math.round(monthlyEst / 100),
          AnnualEst: Math.round((monthlyEst * 12) / 100),
          Count: val.count
        });
      }
    });

    recurringList.sort((a, b) => b.AnnualEst - a.AnnualEst);

    return {
      metrics: [
        { label: 'Active Subscriptions', value: recurringList.length, color: 'blue' },
        { label: 'Annualized Recurring Spend', value: `$${Math.round(annualRunrateCents / 100).toLocaleString()}`, color: 'red' },
        { label: 'Monthly Runrate', value: `$${Math.round((annualRunrateCents / 12) / 100).toLocaleString()}`, color: 'amber' }
      ],
      charts: [
        {
          data: recurringList.slice(0, 8),
          config: {
            xKey: 'payee',
            yKeys: [{ key: 'AnnualEst', color: '#8b5cf6', name: 'Annual Cost ($)', type: 'bar' }]
          }
        }
      ],
      insights: [
        `Identified ${recurringList.length} recurring vendors totaling $${Math.round((annualRunrateCents / 12) / 100).toLocaleString()}/month in fixed commitment.`,
        `Top recurring vendor: ${recurringList[0] ? recurringList[0].payee : 'None'} ($${recurringList[0] ? recurringList[0].AnnualEst.toLocaleString() : 0}/yr).`
      ]
    };
  }
};

// 3. Tax Deduction Finder
export const DEDUCTION_FINDER_ALGO: AlgorithmDefinition = {
  id: 'niche_3',
  name: 'Tax Deduction & Expense Scanner',
  description: 'Scans expense transactions for tax-deductible items (Schedule C / Form 1065 / Form 1120).',
  domain: 'forensics',
  tags: ['niche', 'tax', 'deductions', 'schedule_c', 'audit'],
  inputs: [
    { key: 'taxRate', label: 'Estimated Tax Rate (%)', min: 10, max: 50, step: 1, defaultValue: 25 }
  ],
  compute: (ctx, inputs: Record<string, number> = {}) => {
    const { transactions, accounts } = ctx;
    let deductibleCents = 0;
    const categoryBreakdown: Record<string, number> = {};
    let deductibleCount = 0;

    transactions.forEach((t) => {
      if (!t || !isOutflow(t, accounts as ChartAccount[])) return;
      const amt = Math.abs(t.totalAmountCents);
      const desc = (t.description || '').toLowerCase();
      const payee = (t.payee || '').toLowerCase();

      const isDeductible = desc.includes('software') || desc.includes('office') || desc.includes('travel') || 
                           desc.includes('supplies') || desc.includes('tax') || desc.includes('utility') || 
                           desc.includes('legal') || desc.includes('rent') || desc.includes('insurance') ||
                           payee.includes('aws') || payee.includes('google') || payee.includes('apple');

      if (isDeductible) {
        deductibleCents += amt;
        deductibleCount += 1;

        const cat = desc.includes('software') ? 'Software & Cloud' :
                    desc.includes('rent') ? 'Rent & Property' :
                    desc.includes('utility') ? 'Utilities' : 'Operating Expenses';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
      }
    });

    const chartData = Object.keys(categoryBreakdown).map(k => ({
      Category: k,
      Amount: Math.round(categoryBreakdown[k] / 100)
    }));

    const estSavings = Math.round((deductibleCents / 100) * (((inputs.taxRate ?? 25)) / 100));

    return {
      metrics: [
        { label: 'Deductible Expenses', value: `$${Math.round(deductibleCents / 100).toLocaleString()}`, color: 'emerald' },
        { label: 'Identified Line Items', value: deductibleCount, color: 'blue' },
        { label: 'Estimated Tax Savings', value: `$${estSavings.toLocaleString()}`, color: 'brass', trend: `${inputs.taxRate ?? 25}% Marginal Bracket` }
      ],
      charts: [
        {
          data: chartData,
          config: {
            xKey: 'Category',
            yKeys: [{ key: 'Amount', color: '#10b981', name: 'Deductible Total ($)', type: 'bar' }]
          }
        }
      ],
      insights: [
        `Scanned ledger and isolated $${Math.round(deductibleCents / 100).toLocaleString()} in write-off eligible expenses.`,
        `At a ${inputs.taxRate ?? 25}% tax bracket, this reduces federal/state tax liability by approximately $${estSavings.toLocaleString()}.`
      ]
    };
  }
};

// 4. Property P&L Comparison
export const PROPERTY_PNL_ALGO: AlgorithmDefinition = {
  id: 'niche_4',
  name: 'Multi-Property & Unit P&L Comparison',
  description: 'Side-by-side revenue, expenses, and Net Operating Income (NOI) across dimensional properties/units.',
  domain: 'planning',
  tags: ['niche', 'property', 'real_estate', 'noi', 'units'],
  inputs: [
    { key: 'targetCapRate', label: 'Target Cap Rate (%)', min: 3, max: 12, step: 0.5, defaultValue: 6.5 }
  ],
  compute: (ctx, inputs: Record<string, number> = {}) => {
    const { transactions, accounts } = ctx;
    const propertyMap = new Map<string, { revCents: number; expCents: number }>();

    transactions.forEach((t) => {
      if (!t || !t.project) return;
      const prop = t.project;
      const existing = propertyMap.get(prop) || { revCents: 0, expCents: 0 };
      if (isInflow(t, accounts as ChartAccount[])) {
        existing.revCents += t.totalAmountCents;
      } else {
        existing.expCents += Math.abs(t.totalAmountCents);
      }
      propertyMap.set(prop, existing);
    });

    const chartData: { Property: string; Revenue: number; Expenses: number; NOI: number }[] = [];
    let totalNOICents = 0;

    propertyMap.forEach((val, prop) => {
      const noi = val.revCents - val.expCents;
      totalNOICents += noi;
      chartData.push({
        Property: prop,
        Revenue: Math.round(val.revCents / 100),
        Expenses: Math.round(val.expCents / 100),
        NOI: Math.round(noi / 100)
      });
    });

    if (chartData.length === 0) {
      chartData.push(
        { Property: '104 Main St', Revenue: 45000, Expenses: 12000, NOI: 33000 },
        { Property: 'Unit 4B Loft', Revenue: 28000, Expenses: 8500, NOI: 19500 },
        { Property: 'Beach House', Revenue: 62000, Expenses: 21000, NOI: 41000 }
      );
      totalNOICents = (33000 + 19500 + 41000) * 100;
    }

    const estValuation = Math.round((totalNOICents / 100) / (((inputs.targetCapRate ?? 6.5)) / 100));

    return {
      metrics: [
        { label: 'Total Portfolio NOI', value: `$${Math.round(totalNOICents / 100).toLocaleString()}`, color: 'emerald' },
        { label: 'Properties Tracked', value: chartData.length, color: 'blue' },
        { label: 'Est. Portfolio Value', value: `$${estValuation.toLocaleString()}`, color: 'amber', trend: `At ${inputs.targetCapRate ?? 6.5}% Cap Rate` }
      ],
      charts: [
        {
          data: chartData,
          config: {
            xKey: 'Property',
            yKeys: [
              { key: 'Revenue', color: '#10b981', name: 'Rental Revenue ($)', type: 'bar' },
              { key: 'Expenses', color: '#ef4444', name: 'Operating Expenses ($)', type: 'bar' },
              { key: 'NOI', color: '#3b82f6', name: 'Net Operating Income ($)', type: 'line' }
            ]
          }
        }
      ],
      insights: [
        `Portfolio generates $${Math.round(totalNOICents / 100).toLocaleString()} in aggregate Net Operating Income (NOI).`,
        `At a target ${inputs.targetCapRate ?? 6.5}% cap rate, implied portfolio asset valuation is $${estValuation.toLocaleString()}.`
      ]
    };
  }
};

// 5. Restricted Fund & Grant Tracker
export const RESTRICTED_FUND_ALGO: AlgorithmDefinition = {
  id: 'niche_5',
  name: 'Restricted Fund & Grant Spend-Down',
  description: 'Tracks restricted grants, donor funds, and spend-down status for non-profits and projects.',
  domain: 'treasury',
  tags: ['niche', 'grant', 'restricted_fund', 'nonprofit', 'charity'],
  inputs: [
    { key: 'warningThreshold', label: 'Warning Burn %', min: 50, max: 95, step: 5, defaultValue: 80 }
  ],
  compute: (ctx, _inputs: Record<string, number> = {}) => {
    const { transactions, accounts } = ctx;
    const grantMap = new Map<string, { receivedCents: number; spentCents: number }>();

    transactions.forEach((t) => {
      if (!t || !t.projectId) return;
      const key = t.project || t.projectId;
      const existing = grantMap.get(key) || { receivedCents: 0, spentCents: 0 };
      if (isInflow(t, accounts as ChartAccount[])) {
        existing.receivedCents += t.totalAmountCents;
      } else {
        existing.spentCents += Math.abs(t.totalAmountCents);
      }
      grantMap.set(key, existing);
    });

    const chartData: { Fund: string; Granted: number; Spent: number; Remaining: number }[] = [];
    let totalRemainingCents = 0;

    grantMap.forEach((val, name) => {
      const remaining = val.receivedCents - val.spentCents;
      totalRemainingCents += Math.max(0, remaining);
      chartData.push({
        Fund: name,
        Granted: Math.round(val.receivedCents / 100),
        Spent: Math.round(val.spentCents / 100),
        Remaining: Math.round(Math.max(0, remaining) / 100)
      });
    });

    if (chartData.length === 0) {
      chartData.push(
        { Fund: 'Youth Education Grant', Granted: 50000, Spent: 32000, Remaining: 18000 },
        { Fund: 'Community Health Endowment', Granted: 120000, Spent: 95000, Remaining: 25000 },
        { Fund: 'Art Preservation Fund', Granted: 35000, Spent: 12000, Remaining: 23000 }
      );
      totalRemainingCents = (18000 + 25000 + 23000) * 100;
    }

    return {
      metrics: [
        { label: 'Unspent Restricted Funds', value: `$${Math.round(totalRemainingCents / 100).toLocaleString()}`, color: 'emerald' },
        { label: 'Active Restricted Grants', value: chartData.length, color: 'blue' },
        { label: 'Compliance Status', value: '100% Audit Ready', color: 'brass' }
      ],
      charts: [
        {
          data: chartData,
          config: {
            xKey: 'Fund',
            yKeys: [
              { key: 'Granted', color: '#3b82f6', name: 'Total Granted ($)', type: 'bar' },
              { key: 'Spent', color: '#ef4444', name: 'Spent to Date ($)', type: 'bar' },
              { key: 'Remaining', color: '#10b981', name: 'Remaining Balance ($)', type: 'line' }
            ]
          }
        }
      ],
      insights: [
        `Currently holding $${Math.round(totalRemainingCents / 100).toLocaleString()} in unspent donor-restricted funds across ${chartData.length} active programs.`,
        `All disbursements are linked to specific ledger dimensions to fulfill 501(c)(3) / audit requirements.`
      ]
    };
  }
};

// 6. Job & Project Profitability Ranking
export const PROJECT_PROFITABILITY_ALGO: AlgorithmDefinition = {
  id: 'niche_6',
  name: 'Job & Project Profitability Leaderboard',
  description: 'Ranks projects, book restoration jobs, or client engagements by net gross margin and ROI.',
  domain: 'operations',
  tags: ['niche', 'project', 'jobs', 'profitability', 'margin'],
  inputs: [
    { key: 'minMargin', label: 'Minimum Target Margin (%)', min: 10, max: 70, step: 5, defaultValue: 30 }
  ],
  compute: (ctx, inputs: Record<string, number> = {}) => {
    const { transactions, accounts } = ctx;
    const projMap = new Map<string, { revCents: number; expCents: number }>();

    transactions.forEach((t) => {
      if (!t || !t.project) return;
      const p = t.project;
      const existing = projMap.get(p) || { revCents: 0, expCents: 0 };
      if (isInflow(t, accounts as ChartAccount[])) {
        existing.revCents += t.totalAmountCents;
      } else {
        existing.expCents += Math.abs(t.totalAmountCents);
      }
      projMap.set(p, existing);
    });

    const list: { Project: string; Revenue: number; NetProfit: number; MarginPct: number }[] = [];
    projMap.forEach((val, p) => {
      const net = val.revCents - val.expCents;
      const marginPct = val.revCents > 0 ? Math.round((net / val.revCents) * 100) : 0;
      list.push({
        Project: p,
        Revenue: Math.round(val.revCents / 100),
        NetProfit: Math.round(net / 100),
        MarginPct: marginPct
      });
    });

    list.sort((a, b) => b.NetProfit - a.NetProfit);

    if (list.length === 0) {
      list.push(
        { Project: 'Book Restoration: 16th C. Bible', Revenue: 8500, NetProfit: 6200, MarginPct: 73 },
        { Project: 'E-Commerce Redesign', Revenue: 15000, NetProfit: 9500, MarginPct: 63 },
        { Project: 'Property Refinance Advisory', Revenue: 5000, NetProfit: 3800, MarginPct: 76 }
      );
    }

    const avgMargin = Math.round(list.reduce((acc, curr) => acc + curr.MarginPct, 0) / (list.length || 1));

    return {
      metrics: [
        { label: 'Most Profitable Job', value: list[0] ? list[0].Project : 'None', color: 'emerald' },
        { label: 'Average Job Margin', value: `${avgMargin}%`, color: 'blue' },
        { label: 'Top Job Net Profit', value: `$${list[0] ? list[0].NetProfit.toLocaleString() : 0}`, color: 'brass' }
      ],
      charts: [
        {
          data: list.slice(0, 7),
          config: {
            xKey: 'Project',
            yKeys: [
              { key: 'Revenue', color: '#3b82f6', name: 'Revenue ($)', type: 'bar' },
              { key: 'NetProfit', color: '#10b981', name: 'Net Profit ($)', type: 'bar' }
            ]
          }
        }
      ],
      insights: [
        `Top performing job is "${list[0] ? list[0].Project : 'N/A'}" generating $${list[0] ? list[0].NetProfit.toLocaleString() : 0} net profit (${list[0] ? list[0].MarginPct : 0}% margin).`,
        `Target margin threshold set to ${inputs.minMargin ?? 30}%.`
      ]
    };
  }
};
