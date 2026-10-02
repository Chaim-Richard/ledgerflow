import { ChartAccount, DashboardSchema, TopologyNode } from '../types';

export interface BusinessTemplate {
  id: string;
  name: string;
  description: string;
  accounts: Partial<ChartAccount>[];
  topology: Partial<DashboardSchema>;
}

export const DEFAULT_EQUITY_ACCOUNTS: Partial<ChartAccount>[] = [
  { code: '3000', name: "Owner's Equity", type: 'equity', category: 'Equity' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity' },
  { code: '3200', name: 'Opening Balance Equity', type: 'equity', category: 'Equity' },
];

export const DEFAULT_ROUNDING_ACCOUNT: Partial<ChartAccount> = {
  code: '8999',
  name: 'Foreign Exchange Gain/Loss & Rounding',
  type: 'expense',
  category: 'Rounding Differences',
  subtype: 'rounding',
  role: 'fx_rounding'
};

function ensureTemplateAccounts(accounts: Partial<ChartAccount>[]): Partial<ChartAccount>[] {
  const existingCodes = new Set(accounts.map(a => a.code));
  
  const enriched = [...accounts];
  if (!existingCodes.has('3000')) {
    enriched.push({ code: '3000', name: "Owner's Equity", type: 'equity', category: 'Equity' });
  }
  if (!existingCodes.has('3100')) {
    enriched.push({ code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity' });
  }
  if (!existingCodes.has('3200')) {
    enriched.push({ code: '3200', name: 'Opening Balance Equity', type: 'equity', category: 'Equity' });
  }
  if (!existingCodes.has('8999') && !enriched.some(a => a.role === 'fx_rounding' || a.subtype === 'rounding')) {
    enriched.push(DEFAULT_ROUNDING_ACCOUNT);
  }
  return enriched;
}

const RAW_BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = {
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
  },
  agriculture: {
    id: 'agriculture',
    name: 'Agriculture & Farming',
    description: 'Best for livestock, crops, and organic farms tracking feed, equipment, and subsidies.',
    accounts: [
      { code: '1010', name: 'Farm Operating Checking', type: 'asset', category: 'Cash' },
      { code: '1210', name: 'Grain & Crop Inventory', type: 'asset', category: 'Inventory' },
      { code: '1220', name: 'Livestock Inventory', type: 'asset', category: 'Inventory' },
      { code: '1500', name: 'Land & Buildings', type: 'asset', category: 'Fixed Assets' },
      { code: '1510', name: 'Tractors & Machinery', type: 'asset', category: 'Fixed Assets' },
      { code: '4000', name: 'Crop Sales Revenue', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Livestock Sales Revenue', type: 'income', category: 'Sales' },
      { code: '4200', name: 'Government Subsidies', type: 'income', category: 'Subsidies' },
      { code: '5000', name: 'Feed, Seed & Fertilizer', type: 'expense', category: 'Direct Costs' },
      { code: '5100', name: 'Fuel & Oil (Machinery)', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'Farm Labor & Wages', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Veterinary & Livestock Care', type: 'expense', category: 'Operations' },
    ],
    topology: {
      name: 'Agriculture Yield Flow',
      nodes: [
        { id: 'n1', type: 'source', label: 'Total Farm Sales', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'source', label: 'Subsidies', position: { x: 100, y: 220 }, config: { filter: { category: 'Subsidies' }, formula: 'sum', color: '#3b82f6' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Feed & Crop Costs', position: { x: 300, y: 100 }, config: { filter: { category: 'Direct Costs' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'transform', label: 'Labor & Fleet', position: { x: 300, y: 220 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n5', type: 'sink', label: 'Net Farm Yield', position: { x: 500, y: 160 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n5', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n5', weight: 1 },
        { id: 'l3', source: 'n3', target: 'n5', weight: -1 },
        { id: 'l4', source: 'n4', target: 'n5', weight: -1 },
      ]
    }
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Medical Clinic',
    description: 'Best for medical practices, private clinics, dentist surgeries, and physical therapists.',
    accounts: [
      { code: '1010', name: 'Operating checking', type: 'asset', category: 'Cash' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' },
      { code: '1240', name: 'Medical Supplies Inventory', type: 'asset', category: 'Inventory' },
      { code: '1520', name: 'Medical & Lab Equipment', type: 'asset', category: 'Fixed Assets' },
      { code: '4000', name: 'Patient Service Revenue', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Insurance Reimbursements', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Medical Supplies Used', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Nursing & Clinical Wages', type: 'expense', category: 'Labor' },
      { code: '5200', name: 'Malpractice Insurance', type: 'expense', category: 'Operations' },
      { code: '5300', name: 'Clinic Rent & Utilities', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Patient Clinic Margin',
      nodes: [
        { id: 'n1', type: 'source', label: 'Patient & Insurance Sales', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Clinical Supplies', position: { x: 300, y: 60 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Nursing & Medical Salaries', position: { x: 300, y: 160 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Clinic Gross Operating Profit', position: { x: 500, y: 110 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
  logistics: {
    id: 'logistics',
    name: 'Logistics & Fleet Transport',
    description: 'Best for trucking companies, delivery networks, freight handlers, and logistics operations.',
    accounts: [
      { code: '1010', name: 'Main checking', type: 'asset', category: 'Cash' },
      { code: '1050', name: 'Fuel Card Prepayments', type: 'asset', category: 'Cash' },
      { code: '1530', name: 'Fleet Vehicles (Trucks/Vans)', type: 'asset', category: 'Fixed Assets' },
      { code: '4000', name: 'Freight Logistics Revenue', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Warehousing Fees Received', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Diesel & Fuel Costs', type: 'expense', category: 'Operations' },
      { code: '5100', name: 'Vehicle Maintenance & Tires', type: 'expense', category: 'Operations' },
      { code: '5200', name: 'Driver Wages & Labor', type: 'expense', category: 'Labor' },
      { code: '5300', name: 'Tolls, Permits & Cargo Insurance', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Fleet Contribution Margin',
      nodes: [
        { id: 'n1', type: 'source', label: 'Freight Revenue', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Fuel Expenses', position: { x: 300, y: 50 }, config: { filter: { category: 'Operations' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Drivers Salaries', position: { x: 300, y: 150 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Fleet Gross Margin', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
  subscription_box: {
    id: 'subscription_box',
    name: 'Subscription Box / D2C',
    description: 'Best for recurring box delivery models, curated kits, and monthly product subscriptions.',
    accounts: [
      { code: '1010', name: 'Stripe Merchant checking', type: 'asset', category: 'Cash' },
      { code: '1220', name: 'Sourced Goods & Box Inventory', type: 'asset', category: 'Inventory' },
      { code: '2200', name: 'Unearned/Deferred Subscriptions', type: 'liability', category: 'Revenue' },
      { code: '4000', name: 'Recurring Box Subscriptions', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Individual Box Add-on Sales', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Curated Goods & Sourcing', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Fulfillment & Box Materials', type: 'expense', category: 'COGS' },
      { code: '5200', name: 'Shipping & Postage (USPS/UPS)', type: 'expense', category: 'COGS' },
      { code: '5300', name: 'Customer Acquisition Cost (Ad spend)', type: 'expense', category: 'Marketing' },
    ],
    topology: {
      name: 'Box Economics & LTV',
      nodes: [
        { id: 'n1', type: 'source', label: 'Recurring Sub Revenue', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Direct Sourcing & Pack', position: { x: 300, y: 50 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Ad CAC', position: { x: 300, y: 150 }, config: { filter: { category: 'Marketing' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Net Subscriber Contribution', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
  construction: {
    id: 'construction',
    name: 'Construction & Contracting',
    description: 'Best for general builders, commercial developers, architects, and specialty trade contractors.',
    accounts: [
      { code: '1010', name: 'Escrow Project checking', type: 'asset', category: 'Cash' },
      { code: '1210', name: 'Progress Billings Receivable', type: 'asset', category: 'Receivables' },
      { code: '1225', name: 'Retainage Withheld Receivable', type: 'asset', category: 'Receivables' },
      { code: '1540', name: 'Heavy Equipment Asset', type: 'asset', category: 'Fixed Assets' },
      { code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Payables' },
      { code: '4000', name: 'Progress Contract Revenue', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Direct Materials (Wood/Steel)', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Subcontractors Outlay', type: 'expense', category: 'Labor' },
      { code: '5200', name: 'Heavy Equipment Rental', type: 'expense', category: 'Operations' },
      { code: '5300', name: 'Permits, Plans & Municipal Fees', type: 'expense', category: 'Operations' },
    ],
    topology: {
      name: 'Contract Job Margin',
      nodes: [
        { id: 'n1', type: 'source', label: 'Job Billings Revenue', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Materials & Equipment', position: { x: 300, y: 60 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Subcontractors Outlay', position: { x: 300, y: 160 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Job Gross Profit', position: { x: 500, y: 110 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
  automotive: {
    id: 'automotive',
    name: 'Automotive Service & Repair',
    description: 'Best for mechanic garages, auto repair centers, custom detailers, and panel beaters.',
    accounts: [
      { code: '1010', name: 'Garage checking Account', type: 'asset', category: 'Cash' },
      { code: '1235', name: 'Spare Parts Inventory', type: 'asset', category: 'Inventory' },
      { code: '1550', name: 'Hydraulic Lifts & Shop Tools', type: 'asset', category: 'Fixed Assets' },
      { code: '4000', name: 'Mechanic Labor Billings', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Auto Parts Markup Sales', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Auto Parts Wholesale Cost', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Mechanic Technician Wages', type: 'expense', category: 'Labor' },
      { code: '5200', name: 'Shop Supplies & Lubricants', type: 'expense', category: 'Operations' },
      { code: '5300', name: 'Specialty Tool Depreciation', type: 'expense', category: 'Overhead' },
    ],
    topology: {
      name: 'Garage Service Margin',
      nodes: [
        { id: 'n1', type: 'source', label: 'Repair & Parts Revenue', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Wholesale Parts', position: { x: 300, y: 50 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Mechanic Labor Cost', position: { x: 300, y: 150 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Shop Operating Margin', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
  renewable_energy: {
    id: 'renewable_energy',
    name: 'Renewable Energy Utility',
    description: 'Best for solar installers, microgrid operations, biomass plants, and green credit managers.',
    accounts: [
      { code: '1010', name: 'Main checking', type: 'asset', category: 'Cash' },
      { code: '1560', name: 'Solar Arrays & Inverters', type: 'asset', category: 'Fixed Assets' },
      { code: '2210', name: 'Unearned Green Energy Grants', type: 'liability', category: 'Revenue' },
      { code: '4000', name: 'Grid Sales Energy Output', type: 'income', category: 'Sales' },
      { code: '4100', name: 'Solar Panel System Installs', type: 'income', category: 'Sales' },
      { code: '4200', name: 'Carbon Credits Trade', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Solar Panels & Silicon Sourcing', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Electrician & Crew Labor', type: 'expense', category: 'Labor' },
      { code: '5200', name: 'Inverter Grid-Interconnection Cost', type: 'expense', category: 'Operations' },
      { code: '5300', name: 'Grid Maintenance Service', type: 'expense', category: 'Operations' },
    ],
    topology: {
      name: 'Green Energy Profitability',
      nodes: [
        { id: 'n1', type: 'source', label: 'Energy, Solar & Credits', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Silicon & Interconnects', position: { x: 300, y: 60 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Electricians Wages', position: { x: 300, y: 160 }, config: { filter: { category: 'Labor' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Green EBITDA Yield', position: { x: 500, y: 110 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
  import_export: {
    id: 'import_export',
    name: 'Import / Export Trade',
    description: 'Best for international wholesalers, trade brokers, logistics handlers, and customs clearing.',
    accounts: [
      { code: '1010', name: 'Multi-Currency Bank checking', type: 'asset', category: 'Cash' },
      { code: '1215', name: 'Inventory Assets In Transit', type: 'asset', category: 'Inventory' },
      { code: '2000', name: 'Accounts Payable (Overseas)', type: 'liability', category: 'Payables' },
      { code: '4000', name: 'Wholesale Trade Orders', type: 'income', category: 'Sales' },
      { code: '5000', name: 'Customs Duties, Tariffs & Fees', type: 'expense', category: 'COGS' },
      { code: '5100', name: 'Ocean & Air Freight Carrier', type: 'expense', category: 'COGS' },
      { code: '5200', name: 'Port Clearance & Warehousing', type: 'expense', category: 'Operations' },
      { code: '5300', name: 'Forex Hedging Gains/Losses', type: 'expense', category: 'Operations' },
    ],
    topology: {
      name: 'Trade Order Net Yield',
      nodes: [
        { id: 'n1', type: 'source', label: 'Trade Wholesale Sales', position: { x: 100, y: 100 }, config: { filter: { category: 'Sales' }, formula: 'sum', color: '#10b981' }, valueCents: 0 } as TopologyNode,
        { id: 'n2', type: 'transform', label: 'Tariffs, Tariffs & Duties', position: { x: 300, y: 50 }, config: { filter: { category: 'COGS' }, formula: 'sum', color: '#f59e0b' }, valueCents: 0 } as TopologyNode,
        { id: 'n3', type: 'transform', label: 'Air & Ocean Freight', position: { x: 300, y: 150 }, config: { filter: { category: 'Operations' }, formula: 'sum', color: '#ef4444' }, valueCents: 0 } as TopologyNode,
        { id: 'n4', type: 'sink', label: 'Net Trade Yield', position: { x: 500, y: 100 }, config: { formula: 'sum', color: '#6366f1' }, valueCents: 0 } as TopologyNode,
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n4', weight: 1 },
        { id: 'l2', source: 'n2', target: 'n4', weight: -1 },
        { id: 'l3', source: 'n3', target: 'n4', weight: -1 },
      ]
    }
  },
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

export const BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = Object.fromEntries(
  Object.entries(RAW_BUSINESS_TEMPLATES).map(([key, template]) => [
    key,
    {
      ...template,
      accounts: ensureTemplateAccounts(template.accounts)
    }
  ])
);
