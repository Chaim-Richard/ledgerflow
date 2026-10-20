import type { Bill, ChartAccount, Customer, Invoice, Transaction, Vendor } from '../types';

export type DemoCountry = 'IL' | 'US';
export type DemoResetMode = 'starter' | 'empty';

export interface CountryDemoWorkspace {
  country: DemoCountry;
  companyName: string;
  currency: 'ILS' | 'USD';
  accounts: ChartAccount[];
  customers: Customer[];
  vendors: Vendor[];
  invoices: Invoice[];
  bills: Bill[];
  transactions: Transaction[];
}

interface DemoCountryProfile {
  companyName: string;
  currency: 'ILS' | 'USD';
  accounts: Array<{
    code: string;
    name: string;
    type: ChartAccount['type'];
    category: string;
    role?: string;
  }>;
  customers: Array<{ name: string; email: string }>;
  vendors: Array<{ name: string; email: string }>;
  incomeCents: number;
  expenseCents: number;
}

const COUNTRY_PROFILES: Record<DemoCountry, DemoCountryProfile> = {
  IL: {
    companyName: 'Galil Design Studio (demo) · סטודיו גליל לעיצוב',
    currency: 'ILS',
    accounts: [
      { code: '1000', name: 'Business bank · חשבון עסקי', type: 'asset', category: 'Cash', role: 'cash' },
      { code: '1200', name: 'Accounts receivable · לקוחות', type: 'asset', category: 'Receivables', role: 'ar' },
      { code: '2000', name: 'Accounts payable · ספקים', type: 'liability', category: 'Payables', role: 'ap' },
      { code: '3200', name: 'Opening balance equity · יתרת פתיחה', type: 'equity', category: 'Equity', role: 'equity' },
      { code: '4000', name: 'Design services · הכנסות משירותים', type: 'income', category: 'Revenue', role: 'revenue' },
      { code: '5100', name: 'Software and hosting · תוכנה ואחסון', type: 'expense', category: 'Operating Expenses' },
    ],
    customers: [
      { name: 'Orion Kitchens (demo) · מטבחי אוריון', email: 'accounts@orion-demo.example.test' },
      { name: 'Negev Solar (demo) · נגב סולאר', email: 'finance@negev-demo.example.test' },
    ],
    vendors: [
      { name: 'Carmel Cloud (demo) · כרמל קלאוד', email: 'billing@carmel-demo.example.test' },
      { name: 'Studio Supply (demo) · ציוד סטודיו', email: 'ap@studiosupply-demo.example.test' },
    ],
    incomeCents: 1_850_000,
    expenseCents: 720_000,
  },
  US: {
    companyName: 'Hudson Design Studio (demo)',
    currency: 'USD',
    accounts: [
      { code: '1000', name: 'Business checking', type: 'asset', category: 'Cash', role: 'cash' },
      { code: '1200', name: 'Accounts receivable', type: 'asset', category: 'Receivables', role: 'ar' },
      { code: '2000', name: 'Accounts payable', type: 'liability', category: 'Payables', role: 'ap' },
      { code: '3200', name: 'Opening balance equity', type: 'equity', category: 'Equity', role: 'equity' },
      { code: '4000', name: 'Design services revenue', type: 'income', category: 'Revenue', role: 'revenue' },
      { code: '5100', name: 'Software and hosting', type: 'expense', category: 'Operating Expenses' },
    ],
    customers: [
      { name: 'Maple Street Market (demo)', email: 'ap@maplestreet-demo.example.test' },
      { name: 'Northstar Workshop (demo)', email: 'finance@northstar-demo.example.test' },
    ],
    vendors: [
      { name: 'Hudson Cloud (demo)', email: 'billing@hudsoncloud-demo.example.test' },
      { name: 'Metro Office Supply (demo)', email: 'accounts@metrosupply-demo.example.test' },
    ],
    incomeCents: 1_650_000,
    expenseCents: 645_000,
  },
};

const MONTHS = [
  ['2025-01-01', '2025-01-28', 'January'],
  ['2025-02-01', '2025-02-28', 'February'],
  ['2025-03-01', '2025-03-28', 'March'],
  ['2025-04-01', '2025-04-28', 'April'],
  ['2025-05-01', '2025-05-28', 'May'],
  ['2025-06-01', '2025-06-28', 'June'],
  ['2025-07-01', '2025-07-28', 'July'],
  ['2025-08-01', '2025-08-28', 'August'],
  ['2025-09-01', '2025-09-28', 'September'],
  ['2025-10-01', '2025-10-28', 'October'],
  ['2025-11-01', '2025-11-28', 'November'],
  ['2025-12-01', '2025-12-28', 'December'],
] as const;

export function canUseDemoSandbox(authState: { isGuest: boolean; user: unknown }): boolean {
  return Boolean(authState.isGuest && !authState.user);
}

/**
 * G-3 / G-9: Deterministic one-year sample books for Israel (ILS, EN/HE) and the US (USD).
 * Strictly client-side in-memory demo data: no API calls, no database writes, and no tax claims.
 */
export function seedCountryDemoWorkspace(workspaceId: string, country: DemoCountry): CountryDemoWorkspace {
  const profile = COUNTRY_PROFILES[country];
  const uid = 'usr_demo';
  const slug = country.toLowerCase();
  const accounts: ChartAccount[] = profile.accounts.map((account, index) => ({
    ...account,
    id: `sample-${slug}-${index}-${workspaceId}`,
    uid,
    workspaceId,
    balanceCents: index === 0 ? 8_000_000 : 0,
    currency: profile.currency,
  }));
  const [cash, , , equity, revenue, expense] = accounts;

  const customers: Customer[] = profile.customers.map((entry, index) => ({
    id: `sample-${slug}-customer-${index + 1}-${workspaceId}`,
    uid,
    workspaceId,
    name: entry.name,
    email: entry.email,
    status: 'active',
  }));
  const vendors: Vendor[] = profile.vendors.map((entry, index) => ({
    id: `sample-${slug}-vendor-${index + 1}-${workspaceId}`,
    uid,
    workspaceId,
    name: entry.name,
    email: entry.email,
    category: 'Services',
    status: 'active',
  }));

  const openingDate = '2025-01-01';
  const transactions: Transaction[] = [{
    id: `sample-${slug}-opening-${workspaceId}`,
    uid,
    workspaceId,
    date: openingDate,
    description: 'Opening bank balance · synthetic demo',
    totalAmountCents: 8_000_000,
    currency: profile.currency,
    status: 'completed',
    type: 'journal',
    createdAt: `${openingDate}T12:00:00.000Z`,
    lines: [
      { accountId: cash.id, accountName: cash.name, amountCents: 8_000_000, description: 'Opening bank balance' },
      { accountId: equity.id, accountName: equity.name, amountCents: -8_000_000, description: 'Opening balance equity' },
    ],
  }];

  const invoices: Invoice[] = [];
  const bills: Bill[] = [];

  MONTHS.forEach(([date, dueDate, month], index) => {
    const income = profile.incomeCents + index * 7_500;
    const expenseAmount = profile.expenseCents + (index % 4) * 3_250;
    const customer = customers[index % customers.length];
    const vendor = vendors[index % vendors.length];

    transactions.push({
      id: `sample-${slug}-income-${index + 1}-${workspaceId}`,
      uid,
      workspaceId,
      date,
      description: `${month} design services · synthetic demo`,
      payee: customer.name,
      totalAmountCents: income,
      currency: profile.currency,
      status: 'completed',
      type: 'income',
      createdAt: `${date}T13:00:00.000Z`,
      lines: [
        { accountId: cash.id, accountName: cash.name, amountCents: income, description: `${month} customer receipts` },
        { accountId: revenue.id, accountName: revenue.name, amountCents: -income, description: 'Design services' },
      ],
    });

    transactions.push({
      id: `sample-${slug}-expense-${index + 1}-${workspaceId}`,
      uid,
      workspaceId,
      date,
      description: `${month} software and hosting · synthetic demo`,
      payee: vendor.name,
      totalAmountCents: expenseAmount,
      currency: profile.currency,
      status: 'completed',
      type: 'expense',
      createdAt: `${date}T14:00:00.000Z`,
      lines: [
        { accountId: expense.id, accountName: expense.name, amountCents: expenseAmount, description: 'Software and hosting' },
        { accountId: cash.id, accountName: cash.name, amountCents: -expenseAmount, description: `${month} supplier payment` },
      ],
    });

    invoices.push({
      id: `sample-${slug}-inv-${index + 1}-${workspaceId}`,
      uid,
      workspaceId,
      number: `DEMO-${country}-${String(index + 1).padStart(3, '0')}`,
      customerId: customer.id,
      customerName: customer.name,
      date,
      dueDate,
      status: index === 11 ? 'sent' : 'paid',
      amountCents: income,
      amountPaidCents: index === 11 ? 0 : income,
      currency: profile.currency,
      items: [{
        id: `sample-${slug}-inv-line-${index + 1}-${workspaceId}`,
        description: `${month} retainer (demo)`,
        quantity: 1,
        rateCents: income,
        amountCents: income,
        accountId: revenue.id,
      }],
    });

    bills.push({
      id: `sample-${slug}-bill-${index + 1}-${workspaceId}`,
      uid,
      workspaceId,
      number: `BILL-${country}-${String(index + 1).padStart(3, '0')}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      date,
      dueDate,
      status: 'paid',
      amountCents: expenseAmount,
      amountPaidCents: expenseAmount,
      currency: profile.currency,
    });
  });

  return {
    country,
    companyName: profile.companyName,
    currency: profile.currency,
    accounts,
    customers,
    vendors,
    invoices,
    bills,
    transactions,
  };
}

/**
 * G-23: Deterministic guest/sandbox demo reset payload (either clean starter entries or an empty slate).
 */
export function buildResetDemoWorkspace(workspaceId: string, mode: DemoResetMode): {
  currency: 'USD';
  accounts: ChartAccount[];
  customers: Customer[];
  vendors: Vendor[];
  invoices: Invoice[];
  bills: Bill[];
  transactions: Transaction[];
} {
  if (mode === 'empty') {
    return {
      currency: 'USD',
      accounts: [],
      customers: [],
      vendors: [],
      invoices: [],
      bills: [],
      transactions: [],
    };
  }
  const uid = 'usr_demo';
  const accounts: ChartAccount[] = [
    { id: `reset-cash-${workspaceId}`, uid, workspaceId, code: '1000', name: 'Operating checking (demo)', type: 'asset', category: 'Cash', role: 'cash', currency: 'USD', balanceCents: 250_000 },
    { id: `reset-eq-${workspaceId}`, uid, workspaceId, code: '3200', name: 'Opening balance equity (demo)', type: 'equity', category: 'Equity', role: 'equity', currency: 'USD', balanceCents: 0 },
    { id: `reset-rev-${workspaceId}`, uid, workspaceId, code: '4000', name: 'Consulting revenue (demo)', type: 'income', category: 'Revenue', role: 'revenue', currency: 'USD', balanceCents: 0 },
    { id: `reset-exp-${workspaceId}`, uid, workspaceId, code: '5100', name: 'Office software (demo)', type: 'expense', category: 'Operating Expenses', currency: 'USD', balanceCents: 0 },
  ];
  const [cash, equity, revenue] = accounts;
  const transactions: Transaction[] = [
    {
      id: `reset-tx-1-${workspaceId}`,
      uid,
      workspaceId,
      date: '2026-09-01',
      description: 'Starter opening balance (demo)',
      totalAmountCents: 200_000,
      currency: 'USD',
      status: 'completed',
      type: 'journal',
      createdAt: '2026-09-01T12:00:00.000Z',
      lines: [
        { accountId: cash.id, accountName: cash.name, amountCents: 200_000, description: 'Starter cash' },
        { accountId: equity.id, accountName: equity.name, amountCents: -200_000, description: 'Opening equity' },
      ],
    },
    {
      id: `reset-tx-2-${workspaceId}`,
      uid,
      workspaceId,
      date: '2026-09-15',
      description: 'Starter consulting receipt (demo)',
      payee: 'Starter Client (demo)',
      totalAmountCents: 50_000,
      currency: 'USD',
      status: 'completed',
      type: 'income',
      createdAt: '2026-09-15T12:00:00.000Z',
      lines: [
        { accountId: cash.id, accountName: cash.name, amountCents: 50_000, description: 'Client payment' },
        { accountId: revenue.id, accountName: revenue.name, amountCents: -50_000, description: 'Consulting service' },
      ],
    },
  ];
  return {
    currency: 'USD',
    accounts,
    customers: [{ id: `reset-cust-${workspaceId}`, uid, workspaceId, name: 'Starter Client (demo)', status: 'active' }],
    vendors: [{ id: `reset-vend-${workspaceId}`, uid, workspaceId, name: 'Starter Cloud (demo)', category: 'Services', status: 'active' }],
    invoices: [],
    bills: [],
    transactions,
  };
}
