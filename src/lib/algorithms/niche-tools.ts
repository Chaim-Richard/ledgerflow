import { AlgorithmDefinition } from './types';
import { resolveAccountRole } from '../accountUtils';
import { TruthEngine } from '../../modules/integrity/TruthEngine';

export const LOAN_AMORTIZATION_ALGO: AlgorithmDefinition = {
  id: 'loan_amortization',
  name: 'Amortization Schedule',
  description: 'Calculates the interest vs. principal split for mortgage and loan payments over time.',
  domain: 'planning',
  tags: ['Real Estate', 'Loan', 'Interest'],
  inputs: [
    { key: 'principal', label: 'Principal Amount ($)', min: 10000, max: 5000000, step: 1000, defaultValue: 500000 },
    { key: 'rate', label: 'Annual Interest Rate (%)', min: 1, max: 20, step: 0.1, defaultValue: 5.5 },
    { key: 'years', label: 'Term (Years)', min: 5, max: 30, step: 1, defaultValue: 30 },
  ],
  compute: (transactions, accounts, inputs) => {
    const principal = inputs.principal;
    const annualRate = inputs.rate / 100;
    const months = inputs.years * 12;

    const paymentCents = TruthEngine.calculateLoanAmortizationPayment(principal * 100, annualRate, months);
    const payment = paymentCents / 100;
    
    let balance = principal;
    const schedule = [];
    let totalInterest = 0;
    
    const monthlyRate = annualRate / 12;

    for (let i = 1; i <= Math.min(months, 120); i++) {
      const interest = balance * monthlyRate;
      const prin = payment - interest;
      balance -= prin;
      totalInterest += interest;

      if (i % 12 === 0 || i === 1) {
        schedule.push({
          month: `M${i}`,
          balance: Math.max(0, balance),
          interest: interest
        });
      }
    }

    return {
      metrics: [
        { label: 'Monthly Payment', value: `$${payment.toFixed(2)}` },
        { label: 'Total Interest (10 Yrs)', value: `$${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}` }
      ],
      insights: [
        `At ${inputs.rate}%, your monthly payment is $${payment.toFixed(2)}.`,
        `By year 10, you will have paid $${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})} in interest.`
      ],
      charts: [
        {
          data: schedule,
          config: {
            xKey: 'month',
            yKeys: [
              { key: 'balance', name: 'Balance', color: '#3b82f6', type: 'line' }
            ]
          }
        }
      ]
    };
  }
};

export const SUBSCRIPTION_AUDIT_ALGO: AlgorithmDefinition = {
  id: 'subscription_audit',
  name: 'Subscription & Recurring Spend Audit',
  description: 'Analyzes recurring transactions to identify active subscriptions, rising costs, and potential overlaps.',
  domain: 'operations',
  tags: ['Audit', 'Spend', 'Recurring'],
  inputs: [
    { key: 'minCount', label: 'Minimum Frequency', min: 2, max: 12, step: 1, defaultValue: 3 }
  ],
  compute: (transactions, accounts, inputs) => {
    const counts: Record<string, { count: number, totalCents: number, lastDate: string, lastAmount: number }> = {};
    
    transactions.forEach(t => {
      if (t.totalAmountCents < 0) {
        const payee = (t.payee || t.description || 'Unknown').trim().toLowerCase();
        if (!counts[payee]) counts[payee] = { count: 0, totalCents: 0, lastDate: '', lastAmount: 0 };
        counts[payee].count++;
        counts[payee].totalCents += Math.abs(t.totalAmountCents);
        if (!counts[payee].lastDate || t.date > counts[payee].lastDate) {
          counts[payee].lastDate = t.date;
          counts[payee].lastAmount = Math.abs(t.totalAmountCents);
        }
      }
    });

    const recurring = Object.entries(counts)
      .filter(([_, data]) => data.count >= inputs.minCount)
      .sort((a, b) => b[1].totalCents - a[1].totalCents);

    const totalMonthlyEstCents = recurring.reduce((sum, [_, data]) => sum + data.lastAmount, 0);

    return {
      metrics: [
        { label: 'Active Subscriptions', value: recurring.length },
        { label: 'Est. Monthly Spend', value: `$${(totalMonthlyEstCents/100).toFixed(2)}` }
      ],
      insights: [
        `You have ${recurring.length} recurring vendors with ${inputs.minCount}+ payments, costing roughly $${(totalMonthlyEstCents/100).toFixed(2)} monthly.`,
        ...recurring.slice(0, 3).map(([payee, data]) => `Top spend: ${payee} ($${(data.lastAmount/100).toFixed(2)} recently).`)
      ],
      charts: [
        {
          data: recurring.slice(0, 5).map(([payee, data]) => ({ payee, amount: data.lastAmount / 100 })),
          config: {
            xKey: 'payee',
            yKeys: [
              { key: 'amount', name: 'Latest Amount', color: '#ef4444', type: 'bar' }
            ]
          }
        }
      ]
    };
  }
};

export const MISSING_TRANSACTION_ALGO: AlgorithmDefinition = {
  id: 'missing_transaction',
  name: 'Missing Transaction Alarm',
  description: 'Identifies expected recurring transactions (like rent or insurance) that have not posted in the current period.',
  domain: 'forensics',
  tags: ['Audit', 'Missing', 'Alert'],
  inputs: [
    { key: 'daysThreshold', label: 'Missing Days Threshold', min: 15, max: 90, step: 1, defaultValue: 30 }
  ],
  compute: (transactions, accounts, inputs) => {
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() - inputs.daysThreshold);
    const thresholdStr = thresholdDate.toISOString().split('T')[0];

    const counts: Record<string, { count: number, lastDate: string, amounts: number[] }> = {};
    transactions.forEach(t => {
      const payee = (t.payee || t.description || '').trim().toLowerCase();
      if (!payee) return;
      if (!counts[payee]) counts[payee] = { count: 0, lastDate: '', amounts: [] };
      counts[payee].count++;
      counts[payee].amounts.push(t.totalAmountCents);
      if (!counts[payee].lastDate || t.date > counts[payee].lastDate) {
        counts[payee].lastDate = t.date;
      }
    });

    const missing = Object.entries(counts).filter(([_, data]) => {
      return data.count >= 3 && data.lastDate < thresholdStr;
    });

    const insights = missing.length > 0
      ? missing.slice(0, 3).map(([payee, data]) => `Expected transaction from/to '${payee}' has not posted since ${data.lastDate}.`)
      : ['All expected recurring transactions appear to have posted recently.'];

    return {
      metrics: [
        { label: 'Missing Expected', value: missing.length },
      ],
      insights,
      charts: []
    };
  }
};

export const DEDUCTION_FINDER_ALGO: AlgorithmDefinition = {
  id: 'deduction_finder',
  name: 'Deduction Finder',
  description: 'Scans transactions for commonly-missed tax deductions like home office, mileage, or mixed-use subscriptions.',
  domain: 'planning',
  tags: ['Tax', 'Deductions'],
  inputs: [
    { key: 'minAmount', label: 'Minimum Transaction Amount', min: 0, max: 500, step: 10, defaultValue: 0 }
  ],
  compute: (transactions, accounts, inputs) => {
    let potentialDeductions = 0;
    let foundCount = 0;
    
    const keywords = ['home depot', 'uber', 'gas', 'internet', 'mileage', 'home office', 'lyft', 'zoom', 'adobe', 'aws', 'wework'];
    const candidates: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.totalAmountCents >= 0) return; // Only look at expenses
      if (Math.abs(t.totalAmountCents) / 100 < inputs.minAmount) return;

      const desc = (t.description || '').toLowerCase();
      const payee = (t.payee || '').toLowerCase();
      
      const match = keywords.find(k => desc.includes(k) || payee.includes(k));
      if (match) {
        foundCount++;
        const absVal = Math.abs(t.totalAmountCents);
        potentialDeductions += absVal;
        candidates[match] = (candidates[match] || 0) + absVal;
      }
    });

    const chartData = Object.entries(candidates).map(([k, v]) => ({ category: k, amount: v / 100 })).sort((a,b) => b.amount - a.amount).slice(0, 5);

    return {
      metrics: [
        { label: 'Potential Deductions', value: foundCount },
        { label: 'Value Found', value: `$${(potentialDeductions/100).toFixed(2)}` }
      ],
      insights: [
        `Found ${foundCount} transactions that may qualify for home office, mileage, or utility deductions.`,
        `Total potential value: $${(potentialDeductions/100).toFixed(2)}. Review these carefully with your tax advisor.`
      ],
      charts: [
        {
          data: chartData,
          config: {
            xKey: 'category',
            yKeys: [
              { key: 'amount', name: 'Amount ($)', color: '#10b981', type: 'bar' }
            ]
          }
        }
      ]
    };
  }
};

export const RENT_ROLL_ALGO: AlgorithmDefinition = {
  id: 'rent_roll',
  name: 'Rent Roll & Occupancy',
  description: 'Tracks occupancy, collected rent vs. expected rent, and lease statuses across properties.',
  domain: 'operations',
  tags: ['Real Estate', 'Rent'],
  inputs: [
    { key: 'expectedRent', label: 'Expected Total Rent / Mo', min: 1000, max: 100000, step: 100, defaultValue: 10000 }
  ],
  compute: (transactions, accounts, inputs) => {
    const rentAccounts = accounts.filter(a => a.name.toLowerCase().includes('rent') || a.type === 'revenue' || a.type === 'income');
    const rentAccountIds = new Set(rentAccounts.map(a => a.id));

    let collectedRentCents = 0;
    const propertyRents: Record<string, number> = {};

    transactions.forEach(t => {
      t.lines.forEach(line => {
        if (line.amountCents < 0 && (rentAccountIds.has(line.accountId) || (t.description && t.description.toLowerCase().includes('rent')))) {
          // Credits to revenue are negative, meaning income
          const amt = Math.abs(line.amountCents);
          collectedRentCents += amt;
          const propId = line.project || 'Unknown Property';
          propertyRents[propId] = (propertyRents[propId] || 0) + amt;
        }
      });
    });

    const activeProperties = Object.keys(propertyRents).length;

    return {
      metrics: [
        { label: 'Active Rent Units', value: activeProperties },
        { label: 'Rent Collected (All Time)', value: `$${(collectedRentCents / 100).toFixed(2)}` }
      ],
      insights: [
        activeProperties > 0 
          ? `Collected rent across ${activeProperties} units/properties.`
          : 'No rent collection detected in the current ledger.',
        ...Object.entries(propertyRents).slice(0, 3).map(([prop, amt]) => `Unit ${prop}: $${(amt/100).toFixed(2)} collected.`)
      ],
      charts: [
        {
          data: Object.entries(propertyRents).map(([prop, amt]) => ({ property: prop, amount: amt / 100 })),
          config: {
            xKey: 'property',
            yKeys: [
              { key: 'amount', name: 'Collected Rent', color: '#8b5cf6', type: 'bar' }
            ]
          }
        }
      ]
    };
  }
};

export const PROPERTY_PNL_ALGO: AlgorithmDefinition = {
  id: 'property_pnl',
  name: 'Property P&L Comparison',
  description: 'Compares Revenue, Expenses, NOI, and Cap Rate across multiple properties side-by-side.',
  domain: 'valuation',
  tags: ['Real Estate', 'PNL'],
  inputs: [
    { key: 'minRevenue', label: 'Min Revenue Threshold', min: 0, max: 100000, step: 1000, defaultValue: 0 }
  ],
  compute: (transactions, accounts, inputs) => {
    const propertyPnl: Record<string, { rev: number, exp: number }> = {};
    
    transactions.forEach(t => {
      t.lines.forEach(line => {
        const propId = line.project || 'General';
        if (!propertyPnl[propId]) propertyPnl[propId] = { rev: 0, exp: 0 };
        
        const account = accounts.find(a => a.id === line.accountId);
        if (account) {
          if (account.type === 'revenue' || account.type === 'income') {
            propertyPnl[propId].rev += Math.abs(line.amountCents);
          } else if (account.type === 'expense' || account.type === 'cost_of_goods') {
            propertyPnl[propId].exp += Math.abs(line.amountCents);
          }
        }
      });
    });

    let totalNOI = 0;
    const chartData: any[] = [];
    const insights: string[] = [];

    Object.entries(propertyPnl).forEach(([prop, pnl]) => {
      if (pnl.rev / 100 < inputs.minRevenue) return;
      const noi = pnl.rev - pnl.exp;
      totalNOI += noi;
      chartData.push({ property: prop, noi: noi / 100 });
      if (prop !== 'General' && noi > 0) {
        insights.push(`Property ${prop} generated positive NOI of $${(noi/100).toFixed(2)}.`);
      }
    });

    return {
      metrics: [
        { label: 'Total NOI', value: `$${(totalNOI / 100).toFixed(2)}` },
        { label: 'Properties Tracked', value: chartData.length }
      ],
      insights: insights.length > 0 ? insights.slice(0, 3) : ['No property-specific positive NOI found.'],
      charts: [
        {
          data: chartData,
          config: {
            xKey: 'property',
            yKeys: [
              { key: 'noi', name: 'NOI ($)', color: '#3b82f6', type: 'bar' }
            ]
          }
        }
      ]
    };
  }
};

export const RESTRICTED_FUND_ALGO: AlgorithmDefinition = {
  id: 'restricted_fund',
  name: 'Restricted Fund Tracker',
  description: 'Tracks restricted vs. unrestricted net assets for non-profit compliance.',
  domain: 'system',
  tags: ['Non-Profit', 'Compliance', 'Grants'],
  inputs: [
    { key: 'targetRatio', label: 'Target Restricted Ratio (%)', min: 0, max: 100, step: 1, defaultValue: 20 }
  ],
  compute: (transactions, accounts, inputs) => {
    let restrictedCents = 0;
    let unrestrictedCents = 0;
    
    transactions.forEach(t => {
      t.lines.forEach(line => {
        const isRestricted = (line.class || '').toLowerCase().includes('restrict') || (line.class || '').toLowerCase().includes('grant');
        if (isRestricted) {
          restrictedCents += line.amountCents;
        } else {
          unrestrictedCents += line.amountCents;
        }
      });
    });

    return {
      metrics: [
        { label: 'Unrestricted Funds Net', value: `$${(unrestrictedCents / 100).toFixed(2)}` },
        { label: 'Restricted Funds Net', value: `$${(restrictedCents / 100).toFixed(2)}` }
      ],
      insights: [
        `You have a net $${(restrictedCents/100).toFixed(2)} in restricted funds/grants.`,
        'Ensure restricted funds are released only when specific grant conditions are met.'
      ],
      charts: [
        {
          data: [
            { type: 'Unrestricted', amount: unrestrictedCents / 100 },
            { type: 'Restricted', amount: restrictedCents / 100 }
          ],
          config: {
            xKey: 'type',
            yKeys: [
              { key: 'amount', name: 'Balance', color: '#10b981', type: 'bar' }
            ]
          }
        }
      ]
    };
  }
};

export const PROJECT_PROFITABILITY_ALGO: AlgorithmDefinition = {
  id: 'job_profitability',
  name: 'Job Profitability Ranking',
  description: 'Ranks projects/jobs by profitability to identify which activities actually make money.',
  domain: 'operations',
  tags: ['Projects', 'Profitability'],
  inputs: [
    { key: 'minMargin', label: 'Good Margin Threshold (%)', min: 0, max: 100, step: 1, defaultValue: 20 }
  ],
  compute: (transactions, accounts, inputs) => {
    const jobPnl: Record<string, { rev: number, exp: number }> = {};
    
    transactions.forEach(t => {
      t.lines.forEach(line => {
        if (!line.project) return;
        const jobId = line.project;
        if (!jobPnl[jobId]) jobPnl[jobId] = { rev: 0, exp: 0 };
        
        const account = accounts.find(a => a.id === line.accountId);
        if (account) {
          if (account.type === 'revenue' || account.type === 'income') {
            jobPnl[jobId].rev += Math.abs(line.amountCents);
          } else if (account.type === 'expense' || account.type === 'cost_of_goods') {
            jobPnl[jobId].exp += Math.abs(line.amountCents);
          }
        }
      });
    });

    const profits = Object.entries(jobPnl).map(([job, data]) => ({
      job,
      profit: data.rev - data.exp,
      margin: data.rev > 0 ? ((data.rev - data.exp) / data.rev) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);

    const profitable = profits.filter(p => p.profit > 0).length;
    const lossMaking = profits.filter(p => p.profit < 0).length;

    const insights = profits.length > 0 
      ? [
          `${profits[0].job} is your most profitable job with a ${profits[0].margin.toFixed(1)}% margin.`,
          lossMaking > 0 ? `You have ${lossMaking} loss-making jobs.` : 'All your jobs are profitable.'
        ]
      : ['No project tags found on transactions. Tag transactions with a Project to analyze profitability.'];

    return {
      metrics: [
        { label: 'Profitable Jobs', value: profitable },
        { label: 'Loss-Making Jobs', value: lossMaking }
      ],
      insights,
      charts: [
        {
          data: profits.slice(0, 5).map(p => ({ job: p.job, profit: p.profit / 100 })),
          config: {
            xKey: 'job',
            yKeys: [
              { key: 'profit', name: 'Profit ($)', color: '#f59e0b', type: 'bar' }
            ]
          }
        }
      ]
    };
  }
};

export const BILL_TIMING_ALGO: AlgorithmDefinition = {
  id: 'bill_timing',
  name: 'Bill Payment Timing Optimizer',
  description: 'Recommends optimal days to pay bills based on upcoming historical outflows vs. cash floor.',
  domain: 'planning',
  tags: ['Cash Flow', 'Bills', 'Optimizer'],
  inputs: [
    { key: 'cashFloor', label: 'Desired Cash Floor ($)', min: 500, max: 20000, step: 500, defaultValue: 2000 }
  ],
  compute: (transactions, accounts, inputs) => {
    // In a real scenario, this relies on bills/invoices context or forecasted recurring txs.
    // We'll compute historical largest outflow days of the month to recommend avoiding those days.
    const dayOutflows: number[] = new Array(32).fill(0);
    transactions.forEach(t => {
      if (t.totalAmountCents < 0) {
        const d = new Date(t.date).getDate();
        if (!isNaN(d)) {
          dayOutflows[d] += Math.abs(t.totalAmountCents);
        }
      }
    });

    let maxDay = 1;
    let maxOutflow = 0;
    for (let i = 1; i <= 31; i++) {
      if (dayOutflows[i] > maxOutflow) {
        maxOutflow = dayOutflows[i];
        maxDay = i;
      }
    }

    return {
      metrics: [
        { label: 'Heaviest Outflow Day', value: `Day ${maxDay}` },
        { label: 'Cash Floor Target', value: `$${inputs.cashFloor}` }
      ],
      insights: [
        `Historically, the ${maxDay} of the month has the highest cash outflows ($${(maxOutflow/100).toFixed(2)} total).`,
        `Recommendation: Schedule non-urgent bill payments away from the ${maxDay} to protect your $${inputs.cashFloor} cash floor.`
      ],
      charts: [
        {
          data: dayOutflows.map((val, i) => ({ day: `Day ${i}`, outflow: val / 100 })).slice(1),
          config: {
            xKey: 'day',
            yKeys: [
              { key: 'outflow', name: 'Total Outflows ($)', color: '#ef4444', type: 'line' }
            ]
          }
        }
      ]
    };
  }
};

export const RENT_INCREASE_ALGO: AlgorithmDefinition = {
  id: 'rent_increase',
  name: 'Price/Rent Increase Simulator',
  description: 'Simulates the effect of a percentage rent/price increase across all units.',
  domain: 'planning',
  tags: ['Real Estate', 'Simulator'],
  inputs: [
    { key: 'increasePct', label: 'Increase (%)', min: 1, max: 20, step: 0.5, defaultValue: 5 }
  ],
  compute: (transactions, accounts, inputs) => {
    const rentAccounts = accounts.filter(a => a.name.toLowerCase().includes('rent') || a.type === 'revenue' || a.type === 'income');
    const rentAccountIds = new Set(rentAccounts.map(a => a.id));

    let currentAnnualRentCents = 0;
    
    transactions.forEach(t => {
      t.lines.forEach(line => {
        if (line.amountCents < 0 && (rentAccountIds.has(line.accountId) || (t.description && t.description.toLowerCase().includes('rent')))) {
          currentAnnualRentCents += Math.abs(line.amountCents);
        }
      });
    });

    const pct = inputs.increasePct / 100;
    const addedValue = currentAnnualRentCents * pct;
    const newTotal = currentAnnualRentCents + addedValue;

    return {
      metrics: [
        { label: 'Current Base (Observed)', value: `$${(currentAnnualRentCents / 100).toFixed(2)}` },
        { label: 'Projected Increase', value: `$${(addedValue / 100).toFixed(2)}` }
      ],
      insights: [
        `A ${inputs.increasePct}% increase generates an additional $${(addedValue/100).toFixed(2)} on the observed base.`,
        `New projected base: $${(newTotal/100).toFixed(2)}.`
      ],
      charts: [
        {
          data: [
            { scenario: 'Current', rent: currentAnnualRentCents / 100 },
            { scenario: 'With Increase', rent: newTotal / 100 }
          ],
          config: {
            xKey: 'scenario',
            yKeys: [
              { key: 'rent', name: 'Total Rent ($)', color: '#10b981', type: 'bar' }
            ]
          }
        }
      ]
    };
  }
};
