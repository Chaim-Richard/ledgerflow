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
  /** Presentation and wording for the shared customer/vendor detail screen (A-211). */
  detail: {
    accent: 'indigo' | 'emerald';
    outstandingLabel: string;
    overdueLabel: string;
    lifetimeLabel: string;
    paymentsLabel: string;
    paymentsHeading: string;
    paymentSign: '+' | '-';
    emptyDocuments: string;
    emptyPayments: string;
  };
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
    accountRole: 'ar',
    detail: {
      accent: 'indigo',
      outstandingLabel: 'Outstanding Balance',
      overdueLabel: 'Overdue Amount',
      lifetimeLabel: 'Lifetime Sales',
      paymentsLabel: 'Total Received Payments',
      paymentsHeading: 'Payments Received',
      paymentSign: '+',
      emptyDocuments: 'No invoices recorded for this customer yet.',
      emptyPayments: 'No payments received from this customer yet.',
    },
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
    detail: {
      accent: 'emerald',
      outstandingLabel: 'Outstanding Payable',
      overdueLabel: 'Overdue Balance',
      lifetimeLabel: 'Lifetime Purchases',
      paymentsLabel: 'Total Disbursements',
      paymentsHeading: 'Payments Made',
      paymentSign: '-',
      emptyDocuments: 'No bills recorded for this vendor yet.',
      emptyPayments: 'No payments made to this vendor yet.',
    },
  },
};
