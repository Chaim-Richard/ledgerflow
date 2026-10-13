/**
 * A-143: customer lifetime value. Hand numbers from one customer's two invoices, the item cost
 * fallback, a credit note, and a lifespan the reader chooses.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { customerLifetimeValue, customerLifetimeValueCsvRows, CUSTOMER_LIFETIME_VALUE_CSV_HEADERS } from '../lib/customerLifetimeValue';
import { makeCreditNote, makeInvoice } from './fixtures';

const items = [{ id: 'paper', name: 'Paper', sku: 'P-1', unitCostCents: 400 }];
const line = (id: string, amountCents: number, quantity: number) => ({ id, itemId: 'paper', description: 'Paper', quantity, rateCents: amountCents / quantity, amountCents, accountId: 'rev' });

const input = (overrides: Record<string, unknown> = {}) => ({
  customers: [{ id: 'c1', name: 'Alpha Ltd' }],
  invoices: [
    makeInvoice({ id: 'i1', customerId: 'c1', date: '2026-01-10', status: 'sent', amountCents: 10000, items: [line('l1', 10000, 10)] }),
    makeInvoice({ id: 'i2', customerId: 'c1', date: '2026-03-20', status: 'paid', amountCents: 20000, items: [line('l2', 20000, 20)] }),
  ],
  creditNotes: [makeCreditNote({ id: 'cn1', customerId: 'c1', date: '2026-04-01', status: 'applied', amountCents: 2000 })],
  items,
  transactions: [],
  accounts: [],
  asOfDate: '2026-10-31',
  ...overrides,
});

describe('A-143 customer lifetime value', () => {
  test('sales, cost, credit note, margin and the recorded history are hand-checkable', () => {
    const report = customerLifetimeValue(input() as never);
    assert.equal(report.rows.length, 1);
    const [row] = report.rows;
    assert.equal(row.name, 'Alpha Ltd');
    assert.equal(row.salesCents, 30000);
    assert.equal(row.costCents, 12000);
    assert.equal(row.creditCents, 2000);
    assert.equal(row.netRevenueCents, 28000);
    assert.equal(row.grossProfitCents, 16000, 'net revenue 28000 less cost 12000');
    assert.equal(row.marginPct, 57.1);
    assert.equal(row.costIsEstimate, true, 'the item-cost fallback is an estimate and says so');
    assert.equal(row.orders, 2);
    assert.equal(row.firstOrder, '2026-01-10');
    assert.equal(row.lastOrder, '2026-03-20');
    assert.equal(row.monthsActive, 2);
    assert.equal(row.monthsOfHistory, 10, 'January through October inclusive');
    assert.equal(row.averageOrderCents, 14000);
    assert.equal(row.ordersPerYear, 2.4);
    assert.equal(row.averageAnnualProfitCents, 19200, '16000 ÷ (10/12)');
    assert.equal(row.projectedProfitCents, 57600, 'three years by default');
    assert.equal(row.active, true, 'the last order is within twelve months of the as-of date');
  });

  test('the lifespan is the reader’s, and an impossible one is refused rather than guessed', () => {
    const report = customerLifetimeValue(input({ lifespanYears: 5 }) as never);
    assert.equal(report.lifespanYears, 5);
    assert.equal(report.rows[0].projectedProfitCents, 96000);
    assert.throws(() => customerLifetimeValue(input({ lifespanYears: 0 }) as never), /whole number of years/);
    assert.throws(() => customerLifetimeValue(input({ lifespanYears: 21 }) as never), /whole number of years/);
    assert.throws(() => customerLifetimeValue(input({ asOfDate: '2026-13-01' }) as never), /valid report end date/);
  });

  test('drafts, voided invoices and voided credit notes are not lifetime value', () => {
    const report = customerLifetimeValue(input({
      invoices: [
        makeInvoice({ id: 'i1', customerId: 'c1', date: '2026-01-10', status: 'sent', amountCents: 10000, items: [line('l1', 10000, 10)] }),
        makeInvoice({ id: 'draft', customerId: 'c1', date: '2026-02-10', status: 'draft', amountCents: 99999, items: [line('l2', 99999, 10)] }),
        makeInvoice({ id: 'void', customerId: 'c1', date: '2026-02-11', status: 'void', amountCents: 99999, items: [line('l3', 99999, 10)] }),
      ],
      creditNotes: [makeCreditNote({ id: 'cn-void', customerId: 'c1', date: '2026-04-01', status: 'void', amountCents: 5000 })],
    }) as never);
    assert.equal(report.rows[0].salesCents, 10000);
    assert.equal(report.rows[0].creditCents, 0);
  });

  test('a customer with nothing issued in the window is not listed, and an inactive one says so', () => {
    const report = customerLifetimeValue(input({
      invoices: [
        makeInvoice({ id: 'i1', customerId: 'c1', date: '2025-01-10', status: 'sent', amountCents: 10000, items: [line('l1', 10000, 10)] }),
        makeInvoice({ id: 'draft', customerId: 'c2', date: '2026-02-10', status: 'draft', amountCents: 100 }),
      ],
      customers: [{ id: 'c1', name: 'Alpha Ltd' }, { id: 'c2', name: 'Beta' }],
    }) as never);
    assert.deepEqual(report.rows.map(row => row.customerId), ['c1']);
    assert.equal(report.rows[0].active, false, 'last order is more than twelve months before the as-of date');
    assert.equal(report.rows[0].monthsOfHistory, 22);
  });

  test('the window keeps its own start date, and the CSV carries the lifespan with every row', () => {
    const report = customerLifetimeValue(input({
      from: '2026-03-01',
      invoices: [
        makeInvoice({ id: 'i1', customerId: 'c1', date: '2026-01-10', status: 'sent', amountCents: 10000, items: [line('l1', 10000, 10)] }),
        makeInvoice({ id: 'i2', customerId: 'c1', date: '2026-03-20', status: 'paid', amountCents: 20000, items: [line('l2', 20000, 20)] }),
      ],
    }) as never);
    assert.equal(report.from, '2026-03-01');
    assert.equal(report.rows[0].salesCents, 20000, 'the January invoice is outside the window');
    const csv = customerLifetimeValueCsvRows(report);
    assert.equal(csv[0].length, CUSTOMER_LIFETIME_VALUE_CSV_HEADERS.length);
    assert.equal(csv[0][17], 3);
    assert.equal(csv[0][18], 45000, 'net revenue 18000 (credit note 2000) − cost 8000 = 10000, ÷ (8/12) × 3');
  });
});
