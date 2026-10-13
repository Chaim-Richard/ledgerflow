/**
 * A-68: subscription plans. Hand numbers: a quarterly plan is a third of its amount a month, a
 * yearly plan a twelfth, and a weekly plan is flagged approximate because a month is not a whole
 * number of weeks. Currencies stay in their own totals.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyValueCents, subscriptionPlans, subscriptionPlansCsvRows, SUBSCRIPTION_PLANS_CSV_HEADERS, addMonths, type SubscriptionPlansInput } from '../lib/subscriptionPlans';

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1', description: 'Care plan', amountCents: 12000, frequency: 'monthly' as const,
  nextOccurrence: '2026-11-01', isActive: true, status: 'active' as const, createdAt: '2026-01-15T10:00:00.000Z',
  generatedCount: 9, invoiceTemplate: { customerId: 'c1', customerName: 'Alpha Ltd' },
  ...overrides,
});

const input = (overrides: Partial<SubscriptionPlansInput> = {}): SubscriptionPlansInput => ({
  plans: [plan({})],
  customers: [{ id: 'c1', name: 'Alpha Ltd' }],
  homeCurrency: 'USD',
  to: '2026-10',
  ...overrides,
});

describe('A-68 subscription plans', () => {
  test('the monthly value normalises each frequency, and weekly and daily are approximate', () => {
    assert.deepEqual(monthlyValueCents(12000, 'monthly'), { monthlyCents: 12000, approximate: false });
    assert.deepEqual(monthlyValueCents(12000, 'quarterly'), { monthlyCents: 4000, approximate: false });
    assert.deepEqual(monthlyValueCents(12000, 'yearly'), { monthlyCents: 1000, approximate: false });
    assert.deepEqual(monthlyValueCents(12000, 'weekly'), { monthlyCents: 52000, approximate: true });
    assert.deepEqual(monthlyValueCents(36525, 'daily'), { monthlyCents: 1111730, approximate: true });
  });

  test('the window defaults to the twelve months ending at the given month', () => {
    const report = subscriptionPlans(input());
    assert.deepEqual(report.window, { from: '2025-11', to: '2026-10' });
    assert.equal(report.months.length, 12);
    assert.equal(report.months[0].month, '2025-11');
    assert.equal(addMonths('2026-10', -11), '2025-11');
  });

  test('MRR and ARR are per currency and never added together', () => {
    const report = subscriptionPlans(input({
      plans: [
        plan({}),
        plan({ id: 'p2', amountCents: 6000, frequency: 'yearly', invoiceTemplate: { customerId: 'c1', currency: 'ILS' } }),
        plan({ id: 'p3', amountCents: 8000, frequency: 'quarterly' }),
      ],
      customers: [{ id: 'c1', name: 'Alpha Ltd' }],
    }));
    const usd = report.byCurrency.find(total => total.currency === 'USD');
    const ils = report.byCurrency.find(total => total.currency === 'ILS');
    assert.equal(usd?.activePlans, 2);
    assert.equal(usd?.monthlyCents, 12000 + Math.round(8000 / 3));
    assert.equal(usd?.annualCents, usd.monthlyCents * 12);
    assert.equal(ils?.monthlyCents, 500);
    assert.equal(ils?.approximatePlans, 0);
  });

  test('a plan counts from its created month, and a stopped plan leaves in its last-occurrence month', () => {
    const report = subscriptionPlans(input({
      plans: [
        plan({ id: 'old', createdAt: '2025-11-20T00:00:00.000Z', amountCents: 5000 }),
        plan({ id: 'gone', createdAt: '2025-11-01T00:00:00.000Z', isActive: false, status: 'completed', lastOccurrence: '2026-02-01', amountCents: 9000 }),
        plan({ id: 'new', createdAt: '2026-03-05T00:00:00.000Z', amountCents: 3000 }),
      ],
    }));
    const byMonth = new Map(report.months.map(month => [month.month, month]));
    assert.equal(byMonth.get('2025-11')?.activePlans, 2);
    assert.equal(byMonth.get('2026-02')?.activePlans, 2);
    assert.equal(byMonth.get('2026-02')?.stoppedPlans, 1);
    assert.equal(byMonth.get('2026-02')?.stoppedMonthlyCents, 9000);
    assert.equal(byMonth.get('2026-03')?.activePlans, 2, 'the stopped plan is gone, the new one counts');
    assert.equal(byMonth.get('2026-03')?.startedPlans, 1);
    assert.equal(byMonth.get('2026-03')?.newMonthlyCents, 3000);
    assert.equal(byMonth.get('2026-10')?.monthlyCents, 5000 + 3000);
    assert.equal(report.undatedStops, 0);
  });

  test('recurring rules without an invoice template are not subscriptions, and an undatable stop is counted', () => {
    const report = subscriptionPlans(input({
      plans: [
        plan({ id: 'journal', invoiceTemplate: undefined }),
        plan({ id: 'template-without-customer', invoiceTemplate: { number: 'INV/1' } }),
        plan({ id: 'stopped', isActive: false, status: 'completed', lastOccurrence: undefined }),
      ],
    }));
    assert.deepEqual(report.rows.map(row => row.planId), ['stopped']);
    assert.equal(report.undatedStops, 1);
    assert.equal(report.byCurrency.find(total => total.currency === 'USD')?.activePlans, 0);
  });

  test('the CSV carries one row per plan with its own currency and an honest flag', () => {
    const report = subscriptionPlans(input({ plans: [plan({ frequency: 'weekly' as const, amountCents: 1000 })] }));
    const rows = subscriptionPlansCsvRows(report);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].length, SUBSCRIPTION_PLANS_CSV_HEADERS.length);
    assert.equal(rows[0][5], 1000);
    assert.equal(rows[0][6], 4333);
    assert.match(String(rows[0][8]), /^Yes \(a month is not a whole number of weeks\)$/);
    assert.equal(rows[0][9], '2026-01-15');
  });
});
