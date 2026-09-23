import type { Invoice, Bill, Payment, CreditNote, VendorCredit, Customer, Vendor, Transaction, ChartAccount } from '../types';

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust_1',
    uid: 'user_1',
    workspaceId: 'default',
    name: 'Test Customer',
    status: 'active',
    balanceCents: 0,
    ...overrides
  };
}

export function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vend_1',
    uid: 'user_1',
    workspaceId: 'default',
    name: 'Test Vendor',
    category: 'General',
    status: 'active',
    balanceCents: 0,
    ...overrides
  };
}

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    uid: 'user_1',
    workspaceId: 'default',
    customerId: 'cust_1',
    amountCents: 10000,
    date: '2026-01-15',
    dueDate: '2026-02-15',
    status: 'sent',
    ...overrides
  };
}

export function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill_1',
    uid: 'user_1',
    workspaceId: 'default',
    vendorId: 'vend_1',
    amountCents: 5000,
    date: '2026-01-15',
    dueDate: '2026-02-15',
    status: 'approved',
    ...overrides
  };
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay_1',
    uid: 'user_1',
    workspaceId: 'default',
    direction: 'received',
    contactId: 'cust_1',
    date: '2026-01-20',
    amountCents: 5000,
    method: 'bank_transfer',
    depositAccountId: 'acc_cash',
    allocations: [],
    unappliedCents: 5000,
    status: 'posted',
    ...overrides
  };
}

export function makeCreditNote(overrides: Partial<CreditNote> = {}): CreditNote {
  return {
    id: 'cn_1',
    uid: 'user_1',
    workspaceId: 'default',
    customerId: 'cust_1',
    amountCents: 2000,
    remainingCents: 2000,
    date: '2026-01-25',
    status: 'open',
    ...overrides
  };
}

export function makeVendorCredit(overrides: Partial<VendorCredit> = {}): VendorCredit {
  return {
    id: 'vc_1',
    uid: 'user_1',
    workspaceId: 'default',
    vendorId: 'vend_1',
    amountCents: 1000,
    remainingCents: 1000,
    date: '2026-01-25',
    status: 'open',
    ...overrides
  };
}

export function makeChartAccount(overrides: Partial<ChartAccount> = {}): ChartAccount {
  return {
    id: 'acc_1',
    uid: 'user_1',
    workspaceId: 'default',
    code: '1000',
    name: 'Cash',
    type: 'asset',
    category: 'Cash',
    isSystem: false,
    isActive: true,
    openingBalanceCents: 0,
    balanceCents: 0,
    ...overrides
  };
}

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_1',
    uid: 'user_1',
    workspaceId: 'default',
    date: '2026-01-15',
    description: 'Test transaction',
    type: 'actual',
    status: 'completed',
    createdAt: '2026-01-15T00:00:00Z',
    totalAmountCents: 0,
    currency: 'USD',
    lines: [],
    ...overrides
  };
}
