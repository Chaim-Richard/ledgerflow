import type { TopologyNode } from '../types';
import type { BusinessTemplate } from './businessTemplates';

export const INDUSTRY_BUSINESS_TEMPLATES: Record<string, BusinessTemplate> = {
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
  }
};
