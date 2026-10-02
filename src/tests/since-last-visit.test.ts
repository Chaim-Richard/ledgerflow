/** What changed since the last visit (I-20). */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { changesSince, describeChanges, takeLastVisit } from '../lib/sinceLastVisit';
import { makeBill, makeInvoice, makeTransaction } from './fixtures';

const since = '2026-10-01T09:00:00.000Z';

describe('Since your last visit', () => {
  test('counts what happened after the last visit only', () => {
    const c = changesSince(since, {
      transactions: [
        makeTransaction({ id: 'old', createdAt: '2026-09-30T10:00:00.000Z' }),
        makeTransaction({ id: 'new', createdAt: '2026-10-01T10:00:00.000Z' }),
        makeTransaction({ id: 'voided', createdAt: '2026-10-01T11:00:00.000Z', status: 'void' }),
      ],
      invoices: [
        makeInvoice({ id: 'paid', status: 'paid', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z' }),
        makeInvoice({ id: 'sent', status: 'sent', createdAt: '2026-10-01T12:00:00.000Z' }),
        makeInvoice({ id: 'draft', status: 'draft', createdAt: '2026-10-01T12:00:00.000Z' }),
      ],
      bills: [makeBill({ id: 'b', createdAt: '2026-10-02T00:00:00.000Z' })],
    });
    assert.deepEqual(c, { newTransactions: 1, invoicesPaid: 1, newInvoices: 1, newBills: 1 });
    assert.equal(describeChanges(c), '1 new transaction · 1 new invoice · 1 invoice paid · 1 new bill');
    assert.equal(describeChanges({ newTransactions: 0, invoicesPaid: 0, newInvoices: 0, newBills: 0 }), '');
  });

  test('the visit time: first visit has none, the next one sees the previous', () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
      getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); },
    };
    assert.equal(takeLastVisit('k', '2026-10-01T09:00:00.000Z'), null);
    assert.equal(takeLastVisit('k', '2026-10-02T09:00:00.000Z'), '2026-10-01T09:00:00.000Z');
  });
});
