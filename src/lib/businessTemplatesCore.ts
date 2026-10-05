import type { TopologyNode } from '../types';
import type { BusinessTemplate } from './businessTemplates';

export const CORE_BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = {
creative: {
    id: 'creative',
    name: 'Creative Project',
    description: 'Best for freelancers, artists, and production houses.',
    accounts: [
      { code: '1010', name: 'Main Checking', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' },
      { code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Payables' },
      { code: '4000', name: 'Project Revenue', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Software Subscriptions', type: 'expense', category: 'Operations' },
      { code: '5100', name: 'Equipment Rental', type: 'expense', category: 'Production' },
      { code: '5200', name: 'Contractors', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Marketing & Portfolio', type: 'expense', category: 'Marketing' },
    ],
    topology: {
      name: 'Creative Production Map',
      nodes: [
        { id: 'n1', type: 'source', label: 'Project Revenue', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Production Costs', position: { x: 300, y: 100 }, config: { filter: { category: 'Production' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Labor', position: { x: 300, y: 200 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Net Profit', position: { x: 500, y: 150 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
retail: {
    id: 'retail',
    name: 'E-Commerce / Retail',
    description: 'Best for shops selling physical or digital goods.',
    accounts: [
      { code: '1010', name: 'Operating Account', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Inventory Asset', type: 'asset', category: 'Inventory' },
      { code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Payables' },
      { code: '2100', name: 'Sales Tax Payable', type: 'liability', category: 'Tax' },
      { code: '4000', name: 'Product Sales', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Shipping & Logistics', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'Platform Fees (Shopify/Stripe)', type: 'expense', category: 'Fees' },
    ],
    topology: {
      name: 'Retail Flow',
      nodes: [
        { id: 'n1', type: 'source', label: 'Gross Sales', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'COGS', position: { x: 300, y: 100 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'sink', label: 'Gross Margin', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n3', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n3', weight: -1 },
      ]
    }
  },
saas: {
    id: 'saas',
    name: 'SaaS / Subscription',
    description: 'Best for software companies with recurring revenue.',
    accounts: [
      { code: '1010', name: 'Main Bank Account', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' },
      { code: '2200', name: 'Deferred Revenue', type: 'liability', category: 'Revenue' },
      { code: '4000', name: 'Subscription Revenue (MRR)', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Cloud Infrastructure (AWS/GCP)', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Customer Support', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'R&D / Engineering', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Sales & Marketing', type: 'expense', category: 'Marketing' },
    ],
    topology: {
      name: 'SaaS Unit Economics',
      nodes: [
        { id: 'n1', type: 'source', label: 'MRR', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Hosting Costs', position: { x: 300, y: 50 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'CAC (Marketing)', position: { x: 300, y: 150 }, config: { filter: { category: 'Marketing' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Contribution Margin', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
realestate: {
    id: 'realestate',
    name: 'Real Estate / Property',
    description: 'Best for property managers and real estate investors.',
    accounts: [
      { code: '1010', name: 'Escrow Account', type: 'asset', category: 'Cash' },
      { code: '1500', name: 'Property Asset', type: 'asset', category: 'Fixed Assets' },
      { code: '2300', name: 'Mortgage Payable', type: 'liability', category: 'Debt' },
      { code: '2400', name: 'Tenant Deposits', type: 'liability', category: 'Deposits' },
      { code: '4000', name: 'Rental Income', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Property Maintenance', type: 'expense', category: 'Operations' },
      { code: '5100', name: 'Property Taxes', type: 'expense', category: 'Tax' },
      { code: '5200', name: 'Insurance', type: 'expense', category: 'Overhead' },
      { code: '5300', name: 'Management Fees', type: 'expense', category: 'Fees' },
    ],
    topology: {
      name: 'Property ROI',
      nodes: [
        { id: 'n1', type: 'source', label: 'Rental Income', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'OpEx', position: { x: 300, y: 100 }, config: { filter: { category: 'Operations' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'sink', label: 'NOI (Net Operating Income)', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n3', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n3', weight: -1 },
      ]
    }
  },
nonprofit: {
    id: 'nonprofit',
    name: 'Non-Profit / Charity',
    description: 'Best for charities, foundations, and community groups.',
    accounts: [
      { code: '1010', name: 'Restricted Funds', type: 'asset', category: 'Cash' },
      { code: '1020', name: 'Unrestricted Funds', type: 'asset', category: 'Cash' },
      { code: '4000', name: 'Donations & Gifts', type: 'income', category: 'Revenue' },
      { code: '4100', name: 'Grants', type: 'income', category: 'Revenue' },
      { code: '5000', name: 'Program Services', type: 'expense', category: 'Programs' },
      { code: '5100', name: 'Fundraising Costs', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'Admin & General', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Program Efficiency',
      nodes: [
        { id: 'n1', type: 'source', label: 'Total Revenue', position: { x: 100, y: 100 }, config: { filter: { category: 'Revenue' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Program Spend', position: { x: 300, y: 50 }, config: { filter: { category: 'Programs' }, formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Fundraising', position: { x: 300, y: 150 }, config: { filter: { category: 'Operations' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Reserve Growth', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
service: {
    id: 'service',
    name: 'Professional Services',
    description: 'Best for consulting, legal, and accounting firms.',
    accounts: [
      { code: '1010', name: 'Operating Account', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' },
      { code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Payables' },
      { code: '4000', name: 'Consulting Fees', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Retainer Income', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Professional Indemnity', type: 'expense', category: 'Insurance' },
      { code: '5100', name: 'Travel & Subsistence', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'Sub-contractors', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Office Rent & Utilities', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Service Profitability',
      nodes: [
        { id: 'n1', type: 'source', label: 'Billable Revenue', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Direct Labor', position: { x: 300, y: 100 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'sink', label: 'Operating Margin', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n3', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n3', weight: -1 },
      ]
    }
  },
manufacturing: {
    id: 'manufacturing',
    name: 'Manufacturing / Production',
    description: 'Best for factories and product development companies.',
    accounts: [
      { code: '1010', name: 'Main Checking', type: 'asset', category: 'Cash' },
      { code: '1210', name: 'Raw Materials', type: 'asset', category: 'Inventory' },
      { code: '1220', name: 'Work in Progress', type: 'asset', category: 'Inventory' },
      { code: '1230', name: 'Finished Goods', type: 'asset', category: 'Inventory' },
      { code: '1500', name: 'Machinery & Equipment', type: 'asset', category: 'Fixed Assets' },
      { code: '4000', name: 'Product Sales', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Direct Materials', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Direct Labor', type: 'expense', category: 'COGS' },
      { code: '5200', name: 'Factory Overhead', type: 'expense', category: 'COGS' },
    ],
    topology: {
      name: 'Manufacturing Efficiency',
      nodes: [
        { id: 'n1', type: 'source', label: 'Gross Sales', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Production Cost', position: { x: 300, y: 100 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'sink', label: 'Gross Margin', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n3', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n3', weight: -1 },
      ]
    }
  },
hospitality: {
    id: 'hospitality',
    name: 'Hospitality / Restaurant',
    description: 'Best for hotels, restaurants, and cafes.',
    accounts: [
      { code: '1010', name: 'Daily Deposits', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Food & Beverage Inventory', type: 'asset', category: 'Inventory' },
      { code: '4000', name: 'Food Sales', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Beverage Sales', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Food Cost', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Beverage Cost', type: 'expense', category: 'COGS' },
      { code: '5200', name: 'Kitchen Labor', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Front of House Labor', type: 'expense', category: 'Labor' },
    ],
    topology: {
      name: 'Hospitality Flow',
      nodes: [
        { id: 'n1', type: 'source', label: 'Total Sales', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Prime Cost (COGS+Labor)', position: { x: 300, y: 100 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'sink', label: 'Operating Income', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  }
};
