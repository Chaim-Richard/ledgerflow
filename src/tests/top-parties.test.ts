/**
 * A-190: top customers/vendors with a 12-month trend. Hand-checked against the period summary's
 * rules (issued invoices only; balance = invoiced − credited − paid, everything in base cents):
 *
 * Period 2026-01-01 → 2026-10-22. Big Ltd: Dec 2025 5,000 (in the trend, before the period),
 * Jan 100,000, Oct 50,000 → invoiced in period 150,000; a 10,000 credit note in February and a
 * 40,000 payment in March → closing 155,000 − 10,000 − 40,000 = 105,000.
 * Small Ltd: one 20,000 invoice in June. Silent Ltd: nothing — never listed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { topParties, trendMonths, topPartiesCsvRows } from '../lib/topParties';

const parties = {
  customers: [
    { id: 'c1', name: 'Big Ltd' }, { id: 'c2', name: 'Small Ltd' }, { id: 'c3', name: 'Silent Ltd' },
  ],
  vendors: [],
  invoices: [
    { id: 'i0', customerId: 'c1', status: 'sent', date: '2025-12-15', amountCents: 5_000, amountPaidCents: 0, currency: 'USD' },
    { id: 'i1', customerId: 'c1', status: 'sent', date: '2026-01-10', amountCents: 100_000, amountPaidCents: 0, currency: 'USD' },
    { id: 'i2', customerId: 'c1', status: 'sent', date: '2026-10-05', amountCents: 50_000, amountPaidCents: 0, currency: 'USD' },
    { id: 'i3', customerId: 'c1', status: 'draft', date: '2026-05-01', amountCents: 999_000, amountPaidCents: 0, currency: 'USD' },
    { id: 'i4', customerId: 'c2', status: 'sent', date: '2026-06-12', amountCents: 20_000, amountPaidCents: 0, currency: 'USD' },
  ],
  bills: [],
  payments: [
    { id: 'p1', contactId: 'c1', direction: 'received', date: '2026-03-02', amountCents: 40_000, allocations: [] },
  ],
  creditNotes: [
    { id: 'cn1', customerId: 'c1', status: 'open', date: '2026-02-01', amountCents: 10_000, remainingCents: 10_000 },
  ],
  vendorCredits: [],
};
const period = { startDate: '2026-01-01', endDate: '2026-10-22' };

test('the ranking is by what was invoiced in the period, by hand', () => {
  const { rows, moreCount, months } = topParties({ kind: 'customer', parties: parties as never, period });
  assert.deepEqual(rows.map(r => r.name), ['Big Ltd', 'Small Ltd'], 'Silent Ltd has nothing and is not listed');
  assert.equal(moreCount, 0);
  const big = rows[0];
  assert.equal(big.invoicedCents, 150_000, 'the draft 999,000 and the pre-period 5,000 are not in the period figure');
  assert.equal(big.creditedCents, 10_000);
  assert.equal(big.paidCents, 40_000);
  assert.equal(big.closingCents, 105_000, '155,000 invoiced to date − 10,000 credit − 40,000 paid');
  assert.deepEqual(months, trendMonths('2026-10-22'));
  assert.equal(months[0], '2025-11');
  assert.equal(months[11], '2026-10');
  // trend: Nov 0, Dec 5,000, Jan 100,000, Feb–Sep 0, Oct 50,000
  assert.deepEqual(big.monthlyCents, [0, 5_000, 100_000, 0, 0, 0, 0, 0, 0, 0, 0, 50_000]);
  assert.deepEqual(rows[1].monthlyCents, [0, 0, 0, 0, 0, 0, 0, 20_000, 0, 0, 0, 0], 'June is the eighth of the twelve months');
});

test('the list is capped and says how many more there were', () => {
  const { rows, moreCount } = topParties({ kind: 'customer', parties: parties as never, period, limit: 1 });
  assert.deepEqual(rows.map(r => r.name), ['Big Ltd']);
  assert.equal(moreCount, 1);
  assert.equal(topPartiesCsvRows(rows)[0][1], 150_000, 'the CSV carries the same cents');
});

test('a broken period gives an empty report, never a guess', () => {
  const { rows } = topParties({ kind: 'customer', parties: parties as never, period: { startDate: '2026-10-22', endDate: '2026-01-01' } });
  assert.deepEqual(rows, []);
});
