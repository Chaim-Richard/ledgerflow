/**
 * A-47: vendor scorecard. On-time delivery against the expected date, price changes per item in
 * date order (whole cents, one currency at a time), and returns from vendor credits; read-only.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { unitCostCents, vendorScorecard, vendorScorecardCsvRows, VENDOR_SCORECARD_CSV_HEADERS, type VendorScorecardInput } from '../lib/vendorScorecard';

const vendors = [{ id: 'v1', name: 'Acme Supplies' }, { id: 'v2', name: 'Quiet Vendor' }];

const input = (overrides: Partial<VendorScorecardInput> = {}): VendorScorecardInput => ({
  vendors,
  orders: [
    { vendorId: 'v1', expectedDeliveryDate: '2026-09-10', issueDate: '2026-09-01', status: 'received', receipts: [{ receivedDate: '2026-09-09' } as never] },
    { vendorId: 'v1', expectedDeliveryDate: '2026-09-20', issueDate: '2026-09-12', status: 'received', receipts: [{ receivedDate: '2026-09-25' } as never, { receivedDate: '2026-09-30' } as never] },
    { vendorId: 'v1', expectedDeliveryDate: '2026-09-30', issueDate: '2026-09-15', status: 'received', receipts: [{ receivedDate: '2026-09-30' } as never] },
    { vendorId: 'v1', expectedDeliveryDate: '2026-10-01', issueDate: '2026-09-16', status: 'approved', receipts: [] },
    { vendorId: 'v1', expectedDeliveryDate: '2026-09-01', issueDate: '2026-08-20', status: 'cancelled', receipts: [{ receivedDate: '2026-09-15' } as never] },
  ],
  bills: [
    { vendorId: 'v1', date: '2026-09-02', currency: 'USD', splits: [{ accountId: 'a', amountCents: 10000, itemId: 'paper', quantity: 10 }] },
    { vendorId: 'v1', date: '2026-09-15', currency: 'USD', splits: [{ accountId: 'a', amountCents: 12000, itemId: 'paper', quantity: 10 }] },
    { vendorId: 'v1', date: '2026-09-20', currency: 'USD', splits: [{ accountId: 'a', amountCents: 12000, itemId: 'paper', quantity: 10 }] },
    { vendorId: 'v1', date: '2026-09-22', currency: 'EUR', splits: [{ accountId: 'a', amountCents: 9000, itemId: 'paper', quantity: 10 }] },
    { vendorId: 'v2', date: '2026-09-03', splits: [{ accountId: 'a', amountCents: 500, itemId: 'paper', quantity: 1 }] },
  ],
  credits: [
    { vendorId: 'v1', date: '2026-09-28', status: 'applied', amountCents: 3000, returnedGoods: [{ billLine: 1, itemId: 'paper', quantity: 3, valueCents: 3000 }] },
    { vendorId: 'v1', date: '2026-09-29', status: 'void', amountCents: 9999, returnedGoods: [{ billLine: 1, itemId: 'paper', quantity: 9, valueCents: 9999 }] },
    { vendorId: 'v1', date: '2026-09-29', status: 'open', amountCents: 500 },
  ],
  ...overrides,
});

describe('A-47 vendor scorecard', () => {
  test('on-time delivery compares the first receipt with the expected date', () => {
    const [acme] = vendorScorecard(input());
    assert.equal(acme.orders.withDates, 3, 'cancelled and not-yet-received orders are left out');
    assert.equal(acme.orders.onTime, 2, 'the early one and the one on the day are on time');
    assert.equal(acme.orders.late, 1);
    assert.equal(acme.orders.onTimeRate, 66.67);
    assert.equal(acme.orders.averageDaysLate, 5, 'five days late on the first receipt (25th against 20th)');
  });

  test('a vendor with no dated orders has no on-time rate, not a perfect one', () => {
    const [, quiet] = vendorScorecard(input());
    assert.equal(quiet.orders.withDates, 0);
    assert.equal(quiet.orders.onTimeRate, null);
    assert.equal(quiet.orders.averageDaysLate, null);
  });

  test('price changes are counted in date order, within one currency only', () => {
    const [acme] = vendorScorecard(input());
    const usd = acme.priceChanges.find(p => p.currency === 'USD');
    const eur = acme.priceChanges.find(p => p.currency === 'EUR');
    assert.ok(usd && eur);
    assert.equal(usd.firstUnitCents, 1000);
    assert.equal(usd.lastUnitCents, 1200);
    assert.equal(usd.changes, 1, 'one move: 1000 to 1200; the repeat at 1200 is not a change');
    assert.equal(usd.changePercent, 20);
    assert.equal(eur.changes, 0, 'the EUR purchase is never compared with the USD ones');
    assert.equal(acme.priceChangeCount, 1);
  });

  test('returns: only live credits that send stock back count; void and plain credits do not', () => {
    const [acme] = vendorScorecard(input());
    assert.deepEqual(acme.returns, { credits: 1, units: 3, cents: 3000 });
  });

  test('a date window limits the orders and the bills it reads', () => {
    const [acme] = vendorScorecard(input({ from: '2026-09-14', to: '2026-09-30' }));
    assert.equal(acme.orders.withDates, 2);
    assert.equal(acme.priceChanges.find(p => p.currency === 'USD')?.firstUnitCents, 1200, 'the first USD purchase in the window');
  });

  test('unit costs round to whole cents and refuse zero units', () => {
    assert.equal(unitCostCents(1000, 3), 333);
    assert.equal(unitCostCents(1000, 0), undefined);
    assert.equal(unitCostCents(Number.NaN, 2), undefined);
  });

  test('CSV: one row per item price line, a vendor with none gets one row, headers match the columns', () => {
    const rows = vendorScorecardCsvRows(vendorScorecard(input()));
    assert.ok(rows.every(r => r.length === VENDOR_SCORECARD_CSV_HEADERS.length));
    assert.equal(rows.length, 2 + 1, 'Acme: USD and EUR lines; the quiet vendor: one empty line');
    assert.equal(rows[0][0], 'Acme Supplies');
  });
});
