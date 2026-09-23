import type {
  ChartAccount,
  Transaction,
  Invoice,
  Bill,
  Payment,
  CreditNote,
  VendorCredit,
  Customer,
  Vendor,
} from '../types';

export function makeChartAccount(overrides?: Partial<ChartAccount>): ChartAccount {
  return {
    id: 'acc-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    code: '1000',
    name: 'Test Account',
    type: 'asset',
    category: 'Cash',
    balanceCents: 0,
    ...overrides,
  };
}

export function makeTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    date: '2026-01-01',
    description: 'Test Transaction',
    totalAmountCents: 0,
    currency: 'USD',
    lines: [],
    status: 'completed',
    type: 'actual',
    ...overrides,
  };
}

export function makeCustomer(overrides?: Partial<Customer>): Customer {
  return {
    id: 'cust-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    name: 'Acme Corp',
    ...overrides,
  };
}

export function makeVendor(overrides?: Partial<Vendor>): Vendor {
  return {
    id: 'vend-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    name: 'Supplier Co',
    category: 'Supplies',
    ...overrides,
  };
}

export function makePayment(overrides?: Partial<Payment>): Payment {
  return {
    id: 'pay-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    direction: 'received',
    contactId: 'cust-1',
    date: '2026-01-01',
    amountCents: 10000,
    method: 'bank_transfer',
    depositAccountId: 'acc-1',
    allocations: [],
    unappliedCents: 0,
    status: 'posted',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeInvoice(overrides?: Partial<Invoice>): Invoice {
  return {
    id: 'inv-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    customerId: 'cust-1',
    amountCents: 10000,
    dueDate: '2026-01-31',
    status: 'pending',
    ...overrides,
  };
}

export function makeBill(overrides?: Partial<Bill>): Bill {
  return {
    id: 'bill-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    vendorId: 'vend-1',
    amountCents: 10000,
    dueDate: '2026-01-31',
    status: 'pending',
    ...overrides,
  };
}

export function makeCreditNote(overrides?: Partial<CreditNote>): CreditNote {
  return {
    id: 'cn-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    customerId: 'cust-1',
    amountCents: 5000,
    remainingCents: 5000,
    date: '2026-01-01',
    status: 'open',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeVendorCredit(overrides?: Partial<VendorCredit>): VendorCredit {
  return {
    id: 'vc-1',
    uid: 'test-user',
    workspaceId: 'ws-1',
    vendorId: 'vend-1',
    amountCents: 5000,
    remainingCents: 5000,
    date: '2026-01-01',
    status: 'open',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
