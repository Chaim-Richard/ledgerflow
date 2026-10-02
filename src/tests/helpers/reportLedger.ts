/**
 * Small books with a reversed entry, a vendor refund and a credit back to a customer (L-157), for
 * the report tests: expenses 2,000 rent + 400 software (500 - 100 refund; a 400 charge reversed),
 * income 4,500 Acme (3,000 + 2,000 - 500) + 1,000 Bob.
 */
import { makeChartAccount, makeTransaction } from '../fixtures';
import type { TransactionLine } from '../../types';

export const accounts = [
  makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'sales', name: 'Sales', type: 'income', category: 'Revenue' }),
  makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense', category: 'Occupancy' }),
  makeChartAccount({ id: 'soft', name: 'Software', type: 'expense', category: 'Software' }),
];
const line = (accountId: string, amountCents: number, extra: Partial<TransactionLine> = {}): TransactionLine => ({ accountId, accountName: accountId, amountCents, ...extra });
const tx = (id: string, date: string, lines: TransactionLine[], extra = {}) => makeTransaction({ id, date, lines, totalAmountCents: Math.abs(lines[0].amountCents), ...extra });

export const ledger = [
  tx('rent-jan', '2026-01-05', [line('rent', 100000), line('bank', -100000)], { tags: ['office'] }),
  tx('rent-feb', '2026-02-05', [line('rent', 100000), line('bank', -100000)], { tags: ['office'] }),
  tx('soft-feb', '2026-02-09', [line('soft', 50000), line('bank', -50000)]),
  // a mistaken 400.00 software charge, reversed the next day
  tx('soft-x', '2026-02-10', [line('soft', 40000), line('bank', -40000)], { tags: ['office'] }),
  tx('soft-x-rev', '2026-02-11', [line('soft', -40000), line('bank', 40000)], { tags: ['office'], metadata: { isReversal: true, reversesTxId: 'soft-x' } }),
  // a 100.00 refund from the software vendor
  tx('soft-refund', '2026-02-20', [line('bank', 10000), line('soft', -10000)]),
  tx('sale-acme', '2026-01-15', [line('bank', 300000), line('sales', -300000)], { payee: 'Acme' }),
  tx('sale-acme-2', '2026-02-15', [line('bank', 200000), line('sales', -200000)], { payee: 'Acme', tags: ['office'] }),
  // 500.00 credited back to Acme
  tx('acme-credit', '2026-02-25', [line('sales', 50000), line('bank', -50000)], { payee: 'Acme' }),
  tx('sale-bob', '2026-02-16', [line('bank', 100000), line('sales', -100000)], { payee: 'Bob' }),
  tx('draft', '2026-02-17', [line('rent', 999900), line('bank', -999900)], { status: 'draft' }),
];
