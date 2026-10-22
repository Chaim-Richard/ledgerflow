/**
 * A-187: aged receivables by salesperson. Hand-checked: the customer buckets are the A/R Aging
 * screen's own (src/lib/aging.ts), the rep groups only add them up; a customer with no rep keeps
 * their balance in "No sales rep"; a paid invoice and a draft owe nothing; the group totals add
 * back to the whole aging to the cent.
 *
 * Figures (USD cents, read at 2026-10-22):
 * - Acme (rep Dana): invoice 120,000 due 2026-10-30 (current) + 30,000 due 2026-09-15 (37 days → 31–60)
 * - Beta (rep Dana): invoice 50,000, 20,000 paid, due 2026-06-01 → 30,000 over 90 days
 * - Casa (no rep): invoice 10,000 due 2026-10-20 → 2 days → 1–30
 * - Dana's list also names Beta twice and a second rep claims Beta too: Beta counts once, with Dana.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { agedReceivablesByRep, agedByRepCsvRows, NO_REP_NAME } from '../lib/agedReceivablesByRep';

const customers = [
  { id: 'c1', name: 'Acme Ltd' },
  { id: 'c2', name: 'Beta GmbH' },
  { id: 'c3', name: 'Casa SRL' },
];
const invoice = (over: Record<string, unknown>) => ({
  id: 'i', customerId: 'c1', status: 'sent', amountCents: 0, amountPaidCents: 0, currency: 'USD',
  date: '2026-01-05', dueDate: '2026-02-05', ...over,
});
const invoices = [
  invoice({ id: 'i1', customerId: 'c1', amountCents: 120_000, dueDate: '2026-10-30' }),
  invoice({ id: 'i2', customerId: 'c1', amountCents: 30_000, dueDate: '2026-09-15' }),
  invoice({ id: 'i3', customerId: 'c2', amountCents: 50_000, amountPaidCents: 20_000, dueDate: '2026-06-01' }),
  invoice({ id: 'i4', customerId: 'c3', amountCents: 10_000, dueDate: '2026-10-20' }),
  invoice({ id: 'i5', customerId: 'c1', amountCents: 999_000, status: 'draft', dueDate: '2026-01-01' }),
  invoice({ id: 'i6', customerId: 'c3', amountCents: 7_000, amountPaidCents: 7_000, status: 'paid', dueDate: '2026-01-01' }),
];
const reps = [
  { id: 'sr_dana01', name: 'Dana', commissionPercent: 5, customerIds: ['c1', 'c2', 'c2'] },
  { id: 'sr_eli002', name: 'Eli', commissionPercent: 6, customerIds: ['c2'] },
];

const report = agedReceivablesByRep({ customers, invoices: invoices as never, reps, asOf: '2026-10-22' });

test('a rep group is the sum of its customers aging buckets, by hand', () => {
  const Dana = report.find(r => r.repName === 'Dana')!;
  assert.ok(Dana, 'Dana has a group');
  // Acme: 120,000 current + 30,000 at 31-60; Beta: 30,000 over 90
  assert.deepEqual(Dana.buckets, { current: 120_000, d1_30: 0, d31_60: 30_000, d61_90: 0, d90plus: 30_000 });
  assert.equal(Dana.totalCents, 180_000);
  assert.equal(Dana.overdueCents, 60_000, 'everything but Current is overdue');
  assert.deepEqual(Dana.customers.map(c => c.partyName).sort(), ['Acme Ltd', 'Beta GmbH']);
});

test('a customer no rep looks after is its own group, and a rep with no open balance has none', () => {
  const none = report.find(r => r.repId === '')!;
  assert.ok(none, 'the no-rep group exists');
  assert.equal(none.repName, NO_REP_NAME);
  assert.equal(none.totalCents, 10_000);
  assert.equal(none.buckets.d1_30, 10_000);
  assert.equal(report.find(r => r.repName === 'Eli'), undefined, 'Eli only claimed a customer Dana already had');
});

test('the groups add back to the whole aging, with drafts and paid invoices owing nothing', () => {
  const total = report.reduce((sum, r) => sum + r.totalCents, 0);
  assert.equal(total, 190_000, '150,000 Acme + 30,000 Beta + 10,000 Casa; the 999,000 draft and the paid 7,000 are out');
  assert.equal(report[0].repName, 'Dana', 'the largest balance is first');
  const csv = agedByRepCsvRows(report);
  assert.equal(csv.filter(row => row[1] === 'Beta GmbH').length, 1, 'Beta is exported once, not per claim');
});
