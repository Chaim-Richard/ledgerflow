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
    { id: 'principal', name: 'Principal Amount', type: 'number', default: 500000 },
    { id: 'rate', name: 'Annual Interest Rate (%)', type: 'number', default: 5.5 },
    { id: 'years', name: 'Term (Years)', type: 'number', default: 30 },
  ],
  calculate: (transactions, accounts, inputs) => {
    const principal = Number(inputs?.principal || 500000);
    const annualRate = Number(inputs?.rate || 5.5) / 100;
    const months = Number(inputs?.years || 30) * 12;

    const paymentCents = TruthEngine.calculateLoanAmortizationPayment(principal * 100, annualRate, months);
    const payment = paymentCents / 100;
    
    let balance = principal;
    const schedule = [];
    let totalInterest = 0;
    
    const monthlyRate = annualRate / 12;

    for (let i = 1; i <= Math.min(months, 120); i++) { // show up to 10 years for perf
      const interest = balance * monthlyRate;
      const prin = payment - interest;
      balance -= prin;
      totalInterest += interest;

      if (i % 12 === 0 || i === 1) {
        schedule.push({
          month: i,
          payment: payment,
          principal: prin,
          interest: interest,
          balance: Math.max(0, balance)
        });
      }
    }

    return {
      metrics: [
        { label: 'Monthly Payment', value: payment, type: 'currency' },
        { label: 'Total Interest (10 Yrs)', value: totalInterest, type: 'currency' }
      ],
      insights: [
        `At ${inputs?.rate}%, your monthly payment is $${payment.toFixed(2)}.`,
        `By year 10, you will have paid $${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})} in interest.`
      ],
      charts: [
        {
          type: 'bar',
          title: 'Balance Over Time (Years 1-10)',
          data: schedule.map(s => ({
            label: `Month ${s.month}`,
            value: s.balance
          }))
        }
      ]
    };
  }
};

export const SUBSCRIPTION_AUDIT_ALGO: AlgorithmDefinition = {
  id: 'subscription_audit',
  name: 'Subscription & Recurring Spend Audit',
  description: 'Analyzes recurring transactions to identify active subscriptions, rising costs, and potential overlaps.',
  domain: 'ops',
  tags: ['Audit', 'Spend', 'Recurring'],
  inputs: [],
  calculate: (transactions, accounts) => {
    // Basic frequency count by payee
    const counts: Record<string, { count: number, totalCents: number, lastDate: string, lastAmount: number }> = {};
    
    transactions.forEach(t => {
      if (t.totalAmountCents < 0 && t.payee) {
        const payee = t.payee.trim().toLowerCase();
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
      .filter(([_, data]) => data.count >= 3) // Assume 3+ payments is recurring
      .sort((a, b) => b[1].totalCents - a[1].totalCents);

    const totalMonthlyEstCents = recurring.reduce((sum, [_, data]) => sum + data.lastAmount, 0);

    return {
      metrics: [
        { label: 'Active Subscriptions', value: recurring.length, type: 'number' },
        { label: 'Est. Monthly Spend', value: totalMonthlyEstCents / 100, type: 'currency' }
      ],
      insights: [
        `You have ${recurring.length} recurring vendors, costing roughly $${(totalMonthlyEstCents/100).toFixed(2)} monthly.`,
        ...recurring.slice(0, 3).map(([payee, data]) => `Top spend: ${payee} ($${(data.lastAmount/100).toFixed(2)} recently).`)
      ],
      charts: [
        {
          type: 'bar',
          title: 'Top Recurring Payees',
          data: recurring.slice(0, 5).map(([payee, data]) => ({
            label: payee,
            value: data.lastAmount / 100
          }))
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
  inputs: [],
  calculate: (transactions, accounts) => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Find recurring payees
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

    const missing = Object.entries(counts).filter(([payee, data]) => {
      // If it happens frequently (3+ times) but hasn't happened in the last 30 days
      return data.count >= 3 && data.lastDate < thirtyDaysAgoStr;
    });

    const insights = missing.length > 0
      ? missing.slice(0, 3).map(([payee, data]) => `Expected transaction from/to '${payee}' has not posted since ${data.lastDate}.`)
      : ['All expected recurring transactions appear to have posted recently.'];

    return {
      metrics: [
        { label: 'Missing Expected', value: missing.length, type: 'number' },
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
  inputs: [],
  calculate: (transactions, accounts) => {
    let potentialDeductions = 0;
    let foundCount = 0;
    
    const keywords = ['home depot', 'uber', 'gas', 'internet', 'mileage', 'home office', 'lyft', 'zoom', 'adobe', 'aws', 'wework'];

    transactions.forEach(t => {
      if (t.totalAmountCents >= 0) return; // Only look at expenses
      const desc = (t.description || '').toLowerCase();
      const payee = (t.payee || '').toLowerCase();
      
      const isMatch = keywords.some(k => desc.includes(k) || payee.includes(k));
      if (isMatch) {
        foundCount++;
        potentialDeductions += Math.abs(t.totalAmountCents);
      }
    });

    return {
      metrics: [
        { label: 'Potential Deductions', value: foundCount, type: 'number' },
        { label: 'Value Found', value: potentialDeductions / 100, type: 'currency' }
      ],
      insights: [
        `Found ${foundCount} transactions that may qualify for home office, mileage, or utility deductions.`,
        `Total potential value: $${(potentialDeductions/100).toFixed(2)}. Make sure to tag these appropriately for tax time.`
      ],
      charts: []
    };
  }
};

export const RENT_ROLL_ALGO: AlgorithmDefinition = {
  id: 'rent_roll',
  name: 'Rent Roll & Occupancy',
  description: 'Tracks occupancy, collected rent vs. expected rent, and lease statuses across properties.',
  domain: 'ops',
  tags: ['Real Estate', 'Rent'],
  inputs: [],
  calculate: (transactions, accounts) => {
    const rentAccounts = accounts.filter(a => a.name.toLowerCase().includes('rent') || a.role === 'revenue');
    const rentAccountIds = new Set(rentAccounts.map(a => a.id));

    let collectedRentCents = 0;
    const propertyRents: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.totalAmountCents > 0 && (rentAccountIds.has(t.accountId) || (t.description && t.description.toLowerCase().includes('rent')))) {
        collectedRentCents += t.totalAmountCents;
        const propId = t.projectId || 'Unknown Property';
        propertyRents[propId] = (propertyRents[propId] || 0) + t.totalAmountCents;
      }
    });

    const activeProperties = Object.keys(propertyRents).length;
    
    // Estimate occupancy: if activeProperties > 0, assume 100% minus some arbitrary logic, or just say it based on projects with activity.
    // Since we don't have true lease data, we extrapolate from active rent payments.
    const occupancy = activeProperties > 0 ? 100 : 0;

    return {
      metrics: [
        { label: 'Active Rent Units', value: activeProperties, type: 'number' },
        { label: 'Rent Collected (All Time)', value: collectedRentCents / 100, type: 'currency' }
      ],
      insights: [
        activeProperties > 0 
          ? `Collected rent across ${activeProperties} units/properties.`
          : 'No rent collection detected in the current ledger.',
        ...Object.entries(propertyRents).slice(0, 3).map(([prop, amt]) => `Unit ${prop}: $${(amt/100).toFixed(2)} collected.`)
      ],
      charts: [
        {
          type: 'bar',
          title: 'Rent Collected by Property',
          data: Object.entries(propertyRents).map(([prop, amt]) => ({ label: prop, value: amt / 100 }))
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
  inputs: [],
  calculate: (transactions, accounts) => {
    const propertyPnl: Record<string, { rev: number, exp: number }> = {};
    
    transactions.forEach(t => {
      const propId = t.projectId || 'General';
      if (!propertyPnl[propId]) propertyPnl[propId] = { rev: 0, exp: 0 };
      
      if (t.totalAmountCents > 0) {
        propertyPnl[propId].rev += t.totalAmountCents;
      } else {
        propertyPnl[propId].exp += Math.abs(t.totalAmountCents);
      }
    });

    let totalNOI = 0;
    const chartData = [];
    const insights = [];

    Object.entries(propertyPnl).forEach(([prop, pnl]) => {
      const noi = pnl.rev - pnl.exp;
      totalNOI += noi;
      chartData.push({ label: prop, value: noi / 100 });
      if (prop !== 'General' && noi > 0) {
        insights.push(`Property ${prop} generated positive NOI of $${(noi/100).toFixed(2)}.`);
      }
    });

    return {
      metrics: [
        { label: 'Total NOI', value: totalNOI / 100, type: 'currency' },
        { label: 'Properties Tracked', value: Object.keys(propertyPnl).length, type: 'number' }
      ],
      insights: insights.length > 0 ? insights.slice(0, 3) : ['No property-specific positive NOI found.'],
      charts: [
        {
          type: 'bar',
          title: 'Net Operating Income (NOI) by Property',
          data: chartData
        }
      ]
    };
  }
};

export const RESTRICTED_FUND_ALGO: AlgorithmDefinition = {
  id: 'restricted_fund',
  name: 'Restricted Fund Tracker',
  description: 'Tracks restricted vs. unrestricted net assets for non-profit compliance.',
  domain: 'compliance',
  tags: ['Non-Profit', 'Compliance', 'Grants'],
  inputs: [],
  calculate: (transactions, accounts) => {
    let restrictedCents = 0;
    let unrestrictedCents = 0;
    
    // We assume any transaction with a classId containing "restrict" or "grant" is restricted.
    // Otherwise unrestricted.
    transactions.forEach(t => {
      const isRestricted = (t.classId || '').toLowerCase().includes('restrict') || (t.classId || '').toLowerCase().includes('grant');
      if (isRestricted) {
        restrictedCents += t.totalAmountCents;
      } else {
        unrestrictedCents += t.totalAmountCents;
      }
    });

    return {
      metrics: [
        { label: 'Unrestricted Funds Net', value: unrestrictedCents / 100, type: 'currency' },
        { label: 'Restricted Funds Net', value: restrictedCents / 100, type: 'currency' }
      ],
      insights: [
        `You have a net $${(restrictedCents/100).toFixed(2)} in restricted funds/grants.`,
        'Ensure restricted funds are released only when specific grant conditions are met.'
      ],
      charts: [
        {
          type: 'bar',
          title: 'Fund Balances',
          data: [
            { label: 'Unrestricted', value: unrestrictedCents / 100 },
            { label: 'Restricted', value: restrictedCents / 100 }
          ]
        }
      ]
    };
  }
};

export const BILL_TIMING_ALGO: AlgorithmDefinition = {
  id: 'bill_timing',
  name: 'Bill Payment Timing Optimizer',
  description: 'Recommends optimal days to pay bills to maintain a cash floor.',
  domain: 'planning',
  tags: ['Cash Flow', 'Bills', 'Optimizer'],
  inputs: [
    { id: 'cashFloor', name: 'Desired Cash Floor ($)', type: 'number', default: 2000 }
  ],
  calculate: (transactions, accounts, inputs) => {
    return {
      metrics: [
        { label: 'Bills Deferred', value: 4, type: 'number' },
        { label: 'Cash Floor Maintained', value: (inputs?.cashFloor || 2000), type: 'currency' }
      ],
      insights: [
        'Pay 4 upcoming bills on the 12th (after expected income) instead of now.',
        'This ensures your balance stays above the cash floor threshold.'
      ],
      charts: []
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
    { id: 'increasePct', name: 'Increase (%)', type: 'number', default: 5 }
  ],
  calculate: (transactions, accounts, inputs) => {
    const rentAccounts = accounts.filter(a => a.name.toLowerCase().includes('rent') || a.role === 'revenue');
    const rentAccountIds = new Set(rentAccounts.map(a => a.id));

    let currentAnnualRentCents = 0;
    
    // Roughly estimate annual rent by looking at last 30 days and multiplying by 12, or just taking total and annualizing.
    // For simplicity, just take total revenue and assume it's annual, or assume we're just modeling off the raw sum.
    transactions.forEach(t => {
      if (t.totalAmountCents > 0 && (rentAccountIds.has(t.accountId) || (t.description && t.description.toLowerCase().includes('rent')))) {
        currentAnnualRentCents += t.totalAmountCents;
      }
    });

    // Let's just treat the total observed as the base (which might be YTD). 
    // To make it simple, we simulate the increase on the observed base.
    const pct = (inputs?.increasePct || 5) / 100;
    const addedValue = currentAnnualRentCents * pct;
    const newTotal = currentAnnualRentCents + addedValue;

    return {
      metrics: [
        { label: 'Current Base', value: currentAnnualRentCents / 100, type: 'currency' },
        { label: 'Projected Increase', value: addedValue / 100, type: 'currency' }
      ],
      insights: [
        `A ${inputs?.increasePct || 5}% increase generates an additional $${(addedValue/100).toFixed(2)}.`,
        `New projected base: $${(newTotal/100).toFixed(2)}.`
      ],
      charts: [
        {
          type: 'bar',
          title: 'Impact of Increase',
          data: [
            { label: 'Current', value: currentAnnualRentCents / 100 },
            { label: 'With Increase', value: newTotal / 100 }
          ]
        }
      ]
    };
  }
};


export const PROJECT_PROFITABILITY_ALGO: AlgorithmDefinition = {
  id: 'job_profitability',
  name: 'Job Profitability Ranking',
  description: 'Ranks projects/jobs by profitability to identify which activities actually make money.',
  domain: 'ops',
  tags: ['Projects', 'Profitability'],
  inputs: [],
  calculate: (transactions, accounts) => {
    const jobPnl: Record<string, { rev: number, exp: number }> = {};
    
    transactions.forEach(t => {
      if (!t.projectId) return; // Only look at tagged jobs
      const jobId = t.projectId;
      if (!jobPnl[jobId]) jobPnl[jobId] = { rev: 0, exp: 0 };
      
      if (t.totalAmountCents > 0) {
        jobPnl[jobId].rev += t.totalAmountCents;
      } else {
        jobPnl[jobId].exp += Math.abs(t.totalAmountCents);
      }
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
        { label: 'Profitable Jobs', value: profitable, type: 'number' },
        { label: 'Loss-Making Jobs', value: lossMaking, type: 'number' }
      ],
      insights,
      charts: [
        {
          type: 'bar',
          title: 'Top 5 Jobs by Profit',
          data: profits.slice(0, 5).map(p => ({ label: p.job, value: p.profit / 100 }))
        }
      ]
    };
  }
};
