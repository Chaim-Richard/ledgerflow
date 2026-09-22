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
  paymentRole: 'customer' | 'vendor';
  accountRole: 'ar' | 'ap';
}

export const PARTY_SIDES: Record<PartySide, PartySideConfig> = {
  customer: {
    side: 'customer',
    partySingular: 'Customer',
    partyPlural: 'Customers',
    documentSingular: 'Invoice',
    documentPlural: 'Invoices',
    creditSingular: 'Credit Memo',
    creditPlural: 'Credit Memos',
    paymentDirection: 'received',
    paymentRole: 'customer',
    accountRole: 'ar'
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
    accountRole: 'ap'
  }
};
