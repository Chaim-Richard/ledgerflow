import type { TopologyNode } from '../types';
import type { BusinessTemplate } from './businessTemplates';

export const EXTENDED_BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = {
franchise: {
    id: 'franchise',
    name: 'Franchise Operator',
    description: 'Best for local franchisees operating food, fitness, or retail outlets under a parent brand.',
    accounts: [
      { code: '1010', name: 'Store POS Cash checking', type: 'asset', category: 'Cash' },
      { code: '1570', name: 'Leasehold Improvements', type: 'asset', category: 'Fixed Assets' },
      { code: '4000', name: 'Store POS Sales Receipt', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Franchisor Royalties (7%)', type: 'expense', category: 'Direct Costs' },
      { code: '5100', name: 'Brand Ad Fund Levy (3%)', type: 'expense', category: 'Direct Costs' },
      { code: '5200', name: 'Direct Store Supplies', type: 'expense', category: 'Operations' },
      { code: '5300', name: 'Store Staff wages', type: 'expense', category: 'Labor' },
      { code: '5400', name: 'Location Lease Rent', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Franchise Unit EBITDA',
      nodes: [
        { id: 'n1', type: 'source', label: 'Store POS Receipts', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Brand Fees & Ad Fund', position: { x: 300, y: 50 }, config: { filter: { category: 'Direct Costs' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Location Rent & Wages', position: { x: 300, y: 150 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Store EBITDA Contribution', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
software_agency: {
    id: 'software_agency',
    name: 'Software Agency & Dev Shop',
    description: 'Best for custom web development, IT systems, and technical software consulting shops.',
    accounts: [
      { code: '1010', name: 'Primary checking', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' },
      { code: '2200', name: 'Unearned Client Retainers', type: 'liability', category: 'Revenue' },
      { code: '4000', name: 'Custom Dev Milestone Billings', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Monthly Maintenance Retainers', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Contractor Engineer Costs', type: 'expense', category: 'Labor' },
      { code: '5100', name: 'Dev Tools & Cloud (AWS/Sentry)', type: 'expense', category: 'COGS' },
      { code: '5200', name: 'Business Commissions (Sales)', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Office rent & services', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Agency Billings Margin',
      nodes: [
        { id: 'n1', type: 'source', label: 'Client Billings & Retainers', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Contractor Engineers', position: { x: 300, y: 60 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Cloud Infrastructure', position: { x: 300, y: 160 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Dev Shop Net Operating Margin', position: { x: 500, y: 110 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
enterprise_saas: {
    id: 'enterprise_saas',
    name: 'Enterprise SaaS (Global)',
    description: 'Best for multi-product, multi-region enterprise software businesses.',
    accounts: [
      { code: '1010', name: 'Global Treasury Checking', type: 'asset', category: 'Cash' },
      { code: '1020', name: 'Regional Operating Accounts', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Enterprise Accounts Receivable', type: 'asset', category: 'Receivables' },
      { code: '1600', name: 'Capitalized Software Dev', type: 'asset', category: 'Fixed Assets' },
      { code: '2200', name: 'Deferred Revenue (Annual/Multi-Year)', type: 'liability', category: 'Revenue' },
      { code: '2210', name: 'Performance Obligations', type: 'liability', category: 'Revenue' },
      { code: '4000', name: 'Software Subscriptions (ARR)', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Professional Services Revenue', type: 'income', category: 'Sales' },
      { code: '4200', name: 'Usage-Based Billing', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Cloud Infrastructure & CDN', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Customer Success & Support', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'R&D / Engineering', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Enterprise Sales Commissions', type: 'expense', category: 'Labor' },
      { code: '5400', name: 'Marketing & Demand Gen', type: 'expense', category: 'Marketing' },
      { code: '5500', name: 'G&A and Legal Compliance', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Global Enterprise SaaS Economics',
      nodes: [
        { id: 'n1', type: 'source', label: 'Total Recognized Revenue', position: { x: 100, y: 150 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Cloud Infrastructure COGS', position: { x: 300, y: 50 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'R&D and Engineering', position: { x: 300, y: 150 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#3b82f6' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'transform', label: 'Sales & Marketing', position: { x: 300, y: 250 }, config: { filter: { category: 'Marketing' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n5', type: 'sink', label: 'EBITDA (Adjusted)', position: { x: 600, y: 150 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n5', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n5', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n5', weight: -1 },
        { id: 'l4', source: 'n4', target: 'n5', weight: -1 },
      ]
    }
  },
holding_company: {
    id: 'holding_company',
    name: 'Holding Company / Conglomerate',
    description: 'Best for multi-entity structures, holding companies, and diversified portfolios.',
    accounts: [
      { code: '1010', name: 'Parent Treasury Account', type: 'asset', category: 'Cash' },
      { code: '1100', name: 'Intercompany Receivables', type: 'asset', category: 'Receivables' },
      { code: '1200', name: 'Investments in Subsidiaries', type: 'asset', category: 'Investments' },
      { code: '2100', name: 'Intercompany Payables', type: 'liability', category: 'Payables' },
      { code: '2500', name: 'Consolidated Debt', type: 'liability', category: 'Debt' },
      { code: '4000', name: 'Dividends from Subsidiaries', type: 'income', category: 'Revenue' },
      { code: '4100', name: 'Management Fees Received', type: 'income', category: 'Revenue' },
      { code: '4200', name: 'Interest Income (Intercompany)', type: 'income', category: 'Revenue' },
      { code: '5000', name: 'Corporate G&A', type: 'expense', category: 'Overhead' },
      { code: '5100', name: 'Legal & Compliance Fees', type: 'expense', category: 'Overhead' },
      { code: '5200', name: 'Interest Expense', type: 'expense', category: 'Operations' },
      { code: '5300', name: 'M&A Deal Costs', type: 'expense', category: 'Operations' },
    ],
    topology: {
      name: 'HoldCo Capital Flow',
      nodes: [
        { id: 'n1', type: 'source', label: 'Subsidiary Distributions', position: { x: 100, y: 100 }, config: { filter: { category: 'Revenue' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Corporate Overhead', position: { x: 300, y: 50 }, config: { filter: { category: 'Overhead' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Debt Service & M&A', position: { x: 300, y: 150 }, config: { filter: { category: 'Operations' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Net Distributable Cash', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
manufacturing_multi: {
    id: 'manufacturing_multi',
    name: 'Multi-Entity Manufacturing & Distribution',
    description: 'Best for complex supply chains, multi-factory, and global distribution operations.',
    accounts: [
      { code: '1010', name: 'Consolidated Checking', type: 'asset', category: 'Cash' },
      { code: '1210', name: 'Raw Materials (Global)', type: 'asset', category: 'Inventory' },
      { code: '1220', name: 'Work in Progress (Multi-Site)', type: 'asset', category: 'Inventory' },
      { code: '1230', name: 'Finished Goods (Distribution)', type: 'asset', category: 'Inventory' },
      { code: '1500', name: 'Plant, Property & Equipment', type: 'asset', category: 'Fixed Assets' },
      { code: '4000', name: 'Global Product Sales', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Intercompany Transfer Revenue', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Direct Materials & Sourcing', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Global Direct Labor', type: 'expense', category: 'COGS' },
      { code: '5200', name: 'Factory Overhead (Multi-Site)', type: 'expense', category: 'COGS' },
      { code: '5300', name: 'Global Logistics & Freight', type: 'expense', category: 'Operations' },
      { code: '5400', name: 'Customs & Tariffs', type: 'expense', category: 'Operations' },
    ],
    topology: {
      name: 'Global Value Chain',
      nodes: [
        { id: 'n1', type: 'source', label: 'Global Sales', position: { x: 100, y: 150 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Materials & Production Cost', position: { x: 300, y: 50 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Logistics & Tariffs', position: { x: 300, y: 250 }, config: { filter: { category: 'Operations' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Consolidated Gross Margin', position: { x: 600, y: 150 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
private_equity: {
    id: 'private_equity',
    name: 'Venture Capital / Private Equity Fund',
    description: 'Best for investment funds tracking LP capital, portfolio mark-to-market, and management fees.',
    accounts: [
      { code: '1010', name: 'Fund Treasury', type: 'asset', category: 'Cash' },
      { code: '1100', name: 'Capital Calls Receivable', type: 'asset', category: 'Receivables' },
      { code: '1500', name: 'Portfolio Investments (At Cost)', type: 'asset', category: 'Investments' },
      { code: '1510', name: 'Unrealized Mark-to-Market Gains', type: 'asset', category: 'Investments' },
      { code: '3000', name: 'LP Capital Contributions', type: 'equity', category: 'Equity' },
      { code: '3100', name: 'GP Commitments', type: 'equity', category: 'Equity' },
      { code: '3200', name: 'Retained Earnings / Fund Reserves', type: 'equity', category: 'Equity' },
      { code: '4000', name: 'Realized Gains on Exit', type: 'income', category: 'Revenue' },
      { code: '4100', name: 'Dividend / Interest Income', type: 'income', category: 'Revenue' },
      { code: '5000', name: 'Management Fees Paid to GP', type: 'expense', category: 'Operations' },
      { code: '5100', name: 'Fund Admin & Legal', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'Carried Interest Allocation', type: 'expense', category: 'Operations' },
    ],
    topology: {
      name: 'Fund Performance (IRR & MOIC)',
      nodes: [
        { id: 'n1', type: 'source', label: 'Exits & Distributions', position: { x: 100, y: 100 }, config: { filter: { category: 'Revenue' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Management & Admin Fees', position: { x: 300, y: 50 }, config: { filter: { category: 'Operations' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Capital Deployed', position: { x: 300, y: 150 }, config: { filter: { category: 'Investments' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Net Fund Value Creation', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
personal: {
    id: 'personal',
    name: 'Personal Wealth / Household',
    description: 'Best for tracking personal spending, investments, and household budgets.',
    accounts: [
      { code: '1010', name: 'Main Checking', type: 'asset', category: 'Cash' },
      { code: '1020', name: 'Savings Account', type: 'asset', category: 'Cash' },
      { code: '1100', name: 'Investment Portfolio', type: 'asset', category: 'Investments' },
      { code: '2000', name: 'Credit Card', type: 'liability', category: 'Debt' },
      { code: '2100', name: 'Mortgage / Rent', type: 'liability', category: 'Housing' },
      { code: '4000', name: 'Salary / Income', type: 'income', category: 'Revenue' },
      { code: '4100', name: 'Investment Gains', type: 'income', category: 'Revenue' },
      { code: '5000', name: 'Housing & Utilities', type: 'expense', category: 'Housing' },
      { code: '5100', name: 'Groceries & Dining', type: 'expense', category: 'Food' },
      { code: '5200', name: 'Transportation', type: 'expense', category: 'Travel' },
      { code: '5300', name: 'Entertainment & Leisure', type: 'expense', category: 'Lifestyle' },
      { code: '5400', name: 'Healthcare & Wellness', type: 'expense', category: 'Health' },
      { code: '5500', name: 'Education & Learning', type: 'expense', category: 'Education' },
    ],
    topology: {
      name: 'Household Cashflow',
      nodes: [
        { id: 'n1', type: 'source', label: 'Total Income', position: { x: 100, y: 100 }, config: { filter: { category: 'Revenue' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Fixed Costs (Housing)', position: { x: 300, y: 50 }, config: { filter: { category: 'Housing' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Variable Spend', position: { x: 300, y: 150 }, config: { filter: { category: 'Food' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Net Savings', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  }
};
