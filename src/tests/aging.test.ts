/** One aging rule for the screens and the API (L-159). */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { agingBucket, computePartyAging, daysOverdue, outstandingBaseCents, partyStats } from '../lib/aging';
import { makeBill, makeCustomer, makeInvoice, makePayment } from './fixtures';

const today = '2026-06-30';

describe('aging', () => {
  test('days past the due date, the document date when there is none', () => {
    assert.equal(daysOverdue({ date: '2026-05-01', dueDate: '2026-06-30' }, today), 0);
    assert.equal(daysOverdue({ date: '2026-05-01', dueDate: '2026-06-29' }, today), 1);
    assert.equal(daysOverdue({ date: '2026-03-01' }, today), 121);
    assert.equal(daysOverdue({ dueDate: '2026-07-15' }, today), -15);
    assert.equal(daysOverdue({}, today), 0);
    assert.equal(daysOverdue({ dueDate: '2024-02-28' }, '2024-03-01'), 2);   // leap year
    assert.equal(daysOverdue({ dueDate: '2025-12-31' }, '2026-01-01'), 1);
  });

  test('buckets', () => {
    assert.deepEqual([-5, 0, 1, 30, 31, 60, 61, 90, 91].map(agingBucket),
      ['current', 'current', 'd1_30', 'd1_30', 'd31_60', 'd31_60', 'd61_90', 'd61_90', 'd90plus']);
  });

  test('what is still owed: after payments and deposit, in the base currency; closed documents owe nothing', () => {
    assert.equal(outstandingBaseCents(makeInvoice({ amountCents: 100000, amountPaidCents: 30000, status: 'sent' }), 'customer'), 70000);
    assert.equal(outstandingBaseCents(makeInvoice({ amountCents: 100000, depositCents: 20000, status: 'sent' }), 'customer'), 80000);
    assert.equal(outstandingBaseCents(makeInvoice({ amountCents: 10000, exchangeRate: 1.1, currency: 'EUR', status: 'sent' }), 'customer'), 11000);
    for (const status of ['paid', 'void', 'draft'] as const) {
      assert.equal(outstandingBaseCents(makeInvoice({ amountCents: 5000, status }), 'customer'), 0, status);
    }
  });

  test('rows per customer, by due date; customers who owe nothing are left out', () => {
    const customers = [makeCustomer({ id: 'a', name: 'Acme' }), makeCustomer({ id: 'b', name: 'Bob' }), makeCustomer({ id: 'z', name: 'Zed' })];
    const invoices = [
      makeInvoice({ id: 'i1', customerId: 'a', amountCents: 50000, date: '2026-06-01', dueDate: '2026-07-01', status: 'sent' }),   // not due
      makeInvoice({ id: 'i2', customerId: 'a', amountCents: 20000, amountPaidCents: 5000, date: '2026-04-01', dueDate: '2026-05-01', status: 'partially_paid' }), // 60 days
      makeInvoice({ id: 'i3', customerId: 'b', amountCents: 10000, exchangeRate: 1.1, currency: 'EUR', date: '2026-01-01', dueDate: '2026-01-31', status: 'overdue' }), // 150 days
      makeInvoice({ id: 'i4', customerId: 'z', amountCents: 9999, status: 'paid' }),
    ];
    const rows = computePartyAging(customers, invoices, 'customer', today);
    assert.deepEqual(rows, [
      { partyId: 'a', partyName: 'Acme', buckets: { current: 50000, d1_30: 0, d31_60: 15000, d61_90: 0, d90plus: 0 }, total: 65000 },
      { partyId: 'b', partyName: 'Bob', buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 11000 }, total: 11000 },
    ]);
  });

  test('vendors and bills work the same way', () => {
    const rows = computePartyAging([{ id: 'v', name: 'Power Co' }], [makeBill({ vendorId: 'v', amountCents: 30000, dueDate: '2026-06-15', status: 'approved' })], 'vendor', today);
    assert.deepEqual(rows[0].buckets, { current: 0, d1_30: 30000, d31_60: 0, d61_90: 0, d90plus: 0 });
  });

  test('party page cards: still owed, overdue, lifetime and payments in the base currency', () => {
    const invoices = [
      makeInvoice({ amountCents: 50000, depositCents: 10000, dueDate: '2026-07-10', status: 'sent' }),                  // owes 400, not due
      makeInvoice({ amountCents: 10000, exchangeRate: 1.1, currency: 'EUR', dueDate: '2026-06-01', status: 'overdue' }), // owes 110, overdue
      makeInvoice({ amountCents: 20000, amountPaidCents: 20000, status: 'paid' }),
      makeInvoice({ amountCents: 77700, status: 'cancelled' }),
      makeInvoice({ amountCents: 88800, status: 'draft' }),
    ];
    const payments = [
      makePayment({ direction: 'received', status: 'posted', amountCents: 20000 }),
      makePayment({ direction: 'received', status: 'posted', amountCents: 10000, exchangeRate: 1.1 }),
      makePayment({ direction: 'received', status: 'void', amountCents: 99900 }),
      makePayment({ direction: 'made', status: 'posted', amountCents: 5000 }),
    ];
    assert.deepEqual(partyStats(invoices, payments, 'customer', today), { outstandingCents: 51000, overdueCents: 11000, lifetimeCents: 81000, paymentsCents: 31000 });
  });
});
