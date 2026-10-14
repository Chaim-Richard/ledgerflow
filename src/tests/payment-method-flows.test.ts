import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentMethodFlows } from '../lib/paymentMethodFlows';
import { makePayment } from './fixtures';
const period = { startDate: '2026-01-01', endDate: '2026-12-31' };

test('E-23 counts posted received and outgoing payments once across allocations, separately by method and currency', () => {
  const payments = [
    makePayment({ id: 'recv1', date: '2026-02-03', direction: 'received', method: 'bank_transfer', amountCents: 12001, currency: 'USD',
      allocations: [{ documentId: 'i1', amountCents: 6000 }, { documentId: 'i2', amountCents: 6001 }] as never }),
    makePayment({ id: 'sent1', date: '2026-02-04', direction: 'made', method: 'bank_transfer', amountCents: 5550, currency: 'USD' }),
    makePayment({ id: 'recvEUR', date: '2026-02-05', direction: 'received', method: 'bank_transfer', amountCents: 9000, currency: 'EUR' }),
    makePayment({ id: 'cash', date: '2026-02-05', direction: 'made', method: 'cash', amountCents: 201, currency: 'USD' }),
    makePayment({ id: 'draft', date: '2026-02-07', status: 'draft', method: 'cash', amountCents: 99999 }),
    makePayment({ id: 'void', date: '2026-02-07', status: 'void', method: 'card', amountCents: 99999 }),
    makePayment({ id: 'other', workspaceId: 'ws-2', date: '2026-02-07', amountCents: 88888 }),
    makePayment({ id: 'past', date: '2025-12-31', amountCents: 77777 }),
  ];
  const original = JSON.stringify(payments);
  const summary = paymentMethodFlows(payments, period, 'ws-1', 'USD');
  assert.deepEqual(summary.rows.map(row => [
    row.method, row.currency, row.receivedCount, row.receivedCents, row.madeCount, row.madeCents,
  ]), [
    ['bank_transfer', 'EUR', 1, 9000, 0, 0],
    ['bank_transfer', 'USD', 1, 12001, 1, 5550],
    ['cash', 'USD', 0, 0, 1, 201],
  ]);
  assert.equal(summary.readyForExport, true);
  assert.equal(JSON.stringify(payments), original, 'summarising must not mutate payments');
});

test('E-23 refuses unsafe amounts and dates without silently inserting zero rows', () => {
  const payments = [
    makePayment({ id: 'no-date', date: undefined as never, amountCents: 100 }),
    makePayment({ id: 'not-day', date: '2026-02-30', amountCents: 100 }),
    makePayment({ id: 'invalid', date: '2026-02-01', amountCents: 1.5 }),
    makePayment({ id: 'negative', date: '2026-02-01', amountCents: -1 }),
    makePayment({ id: 'large', date: '2026-02-01', amountCents: Number.MAX_SAFE_INTEGER + 1 }),
    makePayment({ id: 'bad-currency', date: '2026-02-01', currency: 'FAKE', amountCents: 100 }),
    makePayment({ id: 'valid', date: '2026-02-01', amountCents: 100 }),
  ];
  const result = paymentMethodFlows(payments, period, 'ws-1', 'USD');
  assert.equal(result.undatedCount, 2);
  assert.equal(result.unverifiedCount, 4);
  assert.equal(result.readyForExport, false);
  assert.deepEqual(result.rows.map(r => r.receivedCents), [100]);
  assert.throws(() => paymentMethodFlows([], { startDate: '2026-02-30', endDate: '2026-03-31' }, 'ws-1', 'USD'));
});

test('E-23 handles missing legacy currency as home currency, never guesses another exchange rate', () => {
  const payments = [
    makePayment({ id: 'legacy', date: '2026-01-01', method: 'check', currency: undefined, amountCents: 1250 }),
    makePayment({ id: 'zero', date: '2026-01-01', method: 'check', currency: 'EUR', amountCents: 7500 }),
  ];
  const result = paymentMethodFlows(payments, period, 'ws-1', 'ILS');
  assert.deepEqual(result.rows.map(r => [r.currency, r.receivedCents]), [['EUR', 7500], ['ILS', 1250]]);
  assert.equal(result.impliedCurrencyCount, 1);
  assert.equal(result.readyForExport, true);
  assert.equal(paymentMethodFlows(payments, period, '', 'ILS').readyForExport, false);
  assert.deepEqual(paymentMethodFlows(payments, period, '', 'ILS').rows, []);
});
