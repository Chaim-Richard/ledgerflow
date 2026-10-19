import type { ChartAccount, Customer, Transaction, Vendor } from '../types';

export type DemoCountry = 'IL' | 'US';

export interface CountryDemoWorkspace {
  country: DemoCountry;
  companyName: string;
  currency: 'ILS' | 'USD';
  accounts: ChartAccount[];
  customers: Customer[];
  vendors: Vendor[];
  transactions: Transaction[];
}

type AccountSeed = Pick<ChartAccount, 'code' | 'name' | 'type' | 'category' | 'role'>;

const countryProfiles: Record<DemoCountry, {
  companyName: string;
  currency: 'ILS' | 'USD';
  accounts: AccountSeed[];
  customers: string[];
  vendors: string[];
  incomeCents: number;
  expenseCents: number;
}> = {
  IL: {
    companyName: 'Galil Design Studio (demo)',
    currency: 'ILS',
    accounts: [
      { code: '1000', name: 'Business bank · חשבון עסקי', type: 'asset', category: 'Cash', role: 'cash' },
      { code: '3200', name: 'Opening balance equity · יתרת פתיחה', type: 'equity', category: 'Equity', role: 'equity' },
      { code: '4000', name: 'Design services · הכנסות משירותים', type: 'income', category: 'Revenue', role: 'revenue' },
      { code: '5100', name: 'Software and hosting · תוכנה ואחסון', type: 'expense', category: 'Operating Expenses' },
    ],
    customers: ['Orion Kitchens (demo) · מטבחי אוריון', 'Negev Solar (demo) · נגב סולאר'],
    vendors: ['Carmel Cloud (demo) · כרמל קלאוד', 'Studio Supply (demo) · ציוד סטודיו'],
    incomeCents: 1_850_000,
    expenseCents: 720_000,
  },
  US: {
    companyName: 'Hudson Design Studio (demo)',
    currency: 'USD',
    accounts: [
      { code: '1000', name: 'Business checking', type: 'asset', category: 'Cash', role: 'cash' },
      { code: '3200', name: 'Opening balance equity', type: 'equity', category: 'Equity', role: 'equity' },
      { code: '4000', name: 'Design services revenue', type: 'income', category: 'Revenue', role: 'revenue' },
      { code: '5100', name: 'Software and hosting', type: 'expense', category: 'Operating Expenses' },
    ],
    customers: ['Maple Street Market (demo)', 'Northstar Workshop (demo)'],
    vendors: ['Hudson Cloud (demo)', 'Metro Office Supply (demo)'],
    incomeCents: 1_650_000,
    expenseCents: 645_000,
  },
};

const MONTHS = [
  ['2025-01-01', 'January'], ['2025-02-01', 'February'], ['2025-03-01', 'March'],
  ['2025-04-01', 'April'], ['2025-05-01', 'May'], ['2025-06-01', 'June'],
  ['2025-07-01', 'July'], ['2025-08-01', 'August'], ['2025-09-01', 'September'],
  ['2025-10-01', 'October'], ['2025-11-01', 'November'], ['2025-12-01', 'December'],
] as const;

/**
 * A deterministic, synthetic one-year sample for guest exploration only. No tax is calculated,
 * no API is called, and the caller must keep these records in the guest's in-memory stores.
 */
export function seedCountryDemoWorkspace(workspaceId: string, country: DemoCountry): CountryDemoWorkspace {
  const profile = countryProfiles[country];
  const uid = 'usr_demo';
  const accounts = profile.accounts.map((account, index) => ({
    ...account,
    id: `sample-${country.toLowerCase()}-${index}-${workspaceId}`,
    uid,
    workspaceId,
    balanceCents: index === 0 ? 8_000_000 : 0,
    currency: profile.currency,
  }));
  const [cash, equity, revenue, expense] = accounts;
  const openingDate = '2025-01-01';
  const transactions: Transaction[] = [{
    id: `sample-${country.toLowerCase()}-opening-${workspaceId}`,
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

  MONTHS.forEach(([date, month], index) => {
    // Predictable month-to-month variation keeps the example lifelike while remaining auditable.
    const income = profile.incomeCents + index * 7_500;
    const expenseAmount = profile.expenseCents + (index % 4) * 3_250;
    transactions.push({
      id: `sample-${country.toLowerCase()}-income-${index + 1}-${workspaceId}`,
      uid,
      workspaceId,
      date,
      description: `${month} design services · synthetic demo`,
      payee: profile.customers[index % profile.customers.length],
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
      id: `sample-${country.toLowerCase()}-expense-${index + 1}-${workspaceId}`,
      uid,
      workspaceId,
      date,
      description: `${month} software and hosting · synthetic demo`,
      payee: profile.vendors[index % profile.vendors.length],
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
  });

  const parties = (names: string[], kind: 'customer' | 'vendor') => names.map((name, index) => ({
    id: `sample-${country.toLowerCase()}-${kind}-${index + 1}-${workspaceId}`,
    uid,
    workspaceId,
    name,
    status: 'active' as const,
    ...(kind === 'vendor' ? { category: 'Services' } : {}),
  }));

  return {
    country,
    companyName: profile.companyName,
    currency: profile.currency,
    accounts,
    customers: parties(profile.customers, 'customer'),
    vendors: parties(profile.vendors, 'vendor'),
    transactions,
  };
}
