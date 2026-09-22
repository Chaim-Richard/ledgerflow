export type PartySide = 'customer' | 'vendor';

export interface PartySideConfig {
  side: PartySide;
  partySingular: string;
  partyPlural: string;
  documentSingular: string;
  documentPlural: string;
  creditSingular: string;
  creditPlural: string;
  paymentDirection: 'received' | 'made';
  accountRole: 'ar' | 'ap';
  storeEntityKey: 'customers' | 'vendors';
  storeDocKey: 'invoices' | 'bills';
  storeCreditKey: 'creditNotes' | 'vendorCredits';
  title: string;
  subtitle: string;
  subTabDocLabel: string;
  subTabPartyLabel: string;
  badgeLabel: string;
  agingAccountLabel: string;
  exportPrefix: string;
  statBalanceTitle: string;
  statTotalDocTitle: string;
}

export const PARTY_SIDE_CONFIGS: Record<PartySide, PartySideConfig> = {
  customer: {
    side: 'customer',
    partySingular: 'Customer',
    partyPlural: 'Customers',
    documentSingular: 'Invoice',
    documentPlural: 'Invoices',
    creditSingular: 'Credit Note',
    creditPlural: 'Credit Notes',
    paymentDirection: 'received',
    paymentRole: 'customer',
    accountRole: 'ar',
    storeEntityKey: 'customers',
    storeDocKey: 'invoices',
    storeCreditKey: 'creditNotes',
    title: 'Invoices & Customer Receivables',
    subtitle: 'Manage sales invoices, customer aging, receivables, and cash collection schedules.',
    subTabDocLabel: 'Invoices & AR',
    subTabPartyLabel: 'Customers & Clients',
    badgeLabel: 'ACCOUNTS RECEIVABLE & SALES',
    agingAccountLabel: 'Accounts Receivable (A/R)',
    exportPrefix: 'AR_Aging_Report',
    statBalanceTitle: 'Outstanding Balance',
    statTotalDocTitle: 'Total Invoiced (LTD)',
  },
  vendor: {
    side: 'vendor',
    partySingular: 'Vendor',
    partyPlural: 'Vendors',
    documentSingular: 'Bill',
    documentPlural: 'Bills',
    creditSingular: 'Vendor Credit',
    creditPlural: 'Vendor Credits',
    paymentDirection: 'made',
    paymentRole: 'vendor',
    accountRole: 'ap',
    storeEntityKey: 'vendors',
    storeDocKey: 'bills',
    storeCreditKey: 'vendorCredits',
    title: 'Bills & Vendor Liabilities',
    subtitle: 'Manage supplier bills, expense accruals, and cash outflow schedules.',
    subTabDocLabel: 'Bills & AP',
    subTabPartyLabel: 'Vendors & Suppliers',
    badgeLabel: 'ACCOUNTS PAYABLE & EXPENSES',
    agingAccountLabel: 'Accounts Payable (A/P)',
    exportPrefix: 'AP_Aging_Report',
    statBalanceTitle: 'Accounts Payable Balance',
    statTotalDocTitle: 'Total Billed (LTD)',
  }
};
