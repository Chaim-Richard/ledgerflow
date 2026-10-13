/**
 * A-71: vendor price history. Hand-numbered: one item from one vendor in one currency, purchase by
 * purchase, from the bill lines; a second currency is a second series and is never added to it.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { priceTrend, vendorPriceHistory, vendorPriceHistoryCsvRows, VENDOR_PRICE_HISTORY_CSV_HEADERS, type VendorPriceHistoryInput } from '../lib/vendorPriceHistory';

type BillPick = VendorPriceHistoryInput['bills'][number];
const bill = (overrides: Partial<BillPick> = {}): BillPick => ({
  id: 'b1', vendorId: 'v1', number: 'B-1', date: '2026-01-10', currency: 'USD', status: 'approved',
  splits: [{ accountId: 'a', amountCents: 10000, itemId: 'paper', quantity: 10 }],
  ...overrides,
});

const input = (overrides: Partial<VendorPriceHistoryInput> = {}): VendorPriceHistoryInput => ({
  bills: [bill({})],
  vendors: [{ id: 'v1', name: 'Acme Supplies' }],
  items: [{ id: 'paper', name: 'Paper', sku: 'P-1' }],
  ...overrides,
});

describe('A-71 vendor price history', () => {
  test('one purchase gives one point, no change percent and no invented trend', () => {
    const [row] = vendorPriceHistory(input());
    assert.equal(row.vendorName, 'Acme Supplies');
    assert.equal(row.itemName, 'Paper');
    assert.equal(row.sku, 'P-1');
    assert.equal(row.points.length, 1);
    assert.equal(row.firstUnitCents, 10000 / 10);
    assert.equal(row.lastUnitCents, 1000);
    assert.equal(row.changePercent, undefined);
    assert.equal(row.changes, 0);
    assert.equal(priceTrend(row), 'single');
    const [first] = row.points;
    assert.deepEqual(first, { date: '2026-01-10', documentId: 'b1', documentNumber: 'B-1', quantity: 10, amountCents: 10000, unitCents: 1000 });
  });

  test('points are in date order and the change is last against first, with moves counted', () => {
    const [row] = vendorPriceHistory(input({
      bills: [
        bill({ id: 'b2', number: 'B-2', date: '2026-03-05', splits: [{ accountId: 'a', amountCents: 12500, itemId: 'paper', quantity: 10 }] }),
        bill({ id: 'b1', date: '2026-01-10' }),
        bill({ id: 'b3', number: 'B-3', date: '2026-04-01', splits: [{ accountId: 'a', amountCents: 9900, itemId: 'paper', quantity: 9 }] }),
      ],
    }));
    assert.deepEqual(row.points.map(point => point.date), ['2026-01-10', '2026-03-05', '2026-04-01']);
    assert.equal(row.firstUnitCents, 1000);
    assert.equal(row.lastUnitCents, 1100);
    assert.equal(row.minUnitCents, 1000);
    assert.equal(row.maxUnitCents, 1250);
    assert.equal(row.changes, 2);
    assert.equal(row.changePercent, 10);
    assert.equal(row.units, 29);
    assert.equal(row.totalCents, 32400);
    assert.equal(priceTrend(row), 'up');
  });

  test('the same item in another currency is a second series, never added to the first', () => {
    const rows = vendorPriceHistory(input({
      bills: [
        bill({}),
        bill({ id: 'b2', number: 'B-2', date: '2026-02-01', currency: 'EUR', splits: [{ accountId: 'a', amountCents: 20000, itemId: 'paper', quantity: 10 }] }),
      ],
    }));
    assert.equal(rows.length, 2);
    const eur = rows.find(row => row.currency === 'EUR');
    assert.equal(eur?.firstUnitCents, 2000);
    assert.equal(eur?.changePercent, undefined, 'the EUR series has one point of its own');
    assert.equal(rows.find(row => row.currency === 'USD')?.lastUnitCents, 1000);
  });

  test('draft, void, cancelled and rejected bills are not prices paid', () => {
    const rows = vendorPriceHistory(input({
      bills: (['draft', 'void', 'cancelled', 'rejected'] as const).map((status, index) => bill({ id: `x${index}`, status, date: `2026-0${index + 2}-01` })),
    }));
    assert.equal(rows.length, 0);
  });

  test('the window is inclusive on the bill date, and a vendor or item filter narrows the series', () => {
    const bills = [
      bill({ id: 'b1', date: '2026-01-01' }),
      bill({ id: 'b2', date: '2026-02-01', splits: [{ accountId: 'a', amountCents: 20000, itemId: 'ink', quantity: 10 }] }),
      bill({ id: 'b3', vendorId: 'v2', date: '2026-02-15', splits: [{ accountId: 'a', amountCents: 3000, itemId: 'paper', quantity: 10 }] }),
    ];
    const vendors = [{ id: 'v1', name: 'Acme Supplies' }, { id: 'v2', name: 'Other Vendor' }];
    const inWindow = vendorPriceHistory(input({ bills, vendors, from: '2026-02-01', to: '2026-02-28' }));
    assert.deepEqual(inWindow.map(row => `${row.vendorId}/${row.itemId}`), ['v1/ink', 'v2/paper']);
    const onlyVendor = vendorPriceHistory(input({ bills, vendors, vendorId: 'v1' }));
    assert.deepEqual(onlyVendor.map(row => row.itemId), ['paper', 'ink']);
    const onlyItem = vendorPriceHistory(input({ bills, vendors, itemId: 'paper' }));
    assert.deepEqual(onlyItem.map(row => row.vendorId), ['v1', 'v2']);
    const noUnits = vendorPriceHistory(input({ bills: [bill({ splits: [{ accountId: 'a', amountCents: 10000, itemId: 'paper', quantity: 0 }] })] }));
    assert.equal(noUnits.length, 0, 'a line without units has no unit cost and is left out');
  });

  test('the CSV has one row per purchase and never a total across currencies', () => {
    const rows = vendorPriceHistory(input({
      bills: [
        bill({}),
        bill({ id: 'b2', number: 'B-2', date: '2026-02-01', currency: 'EUR', splits: [{ accountId: 'a', amountCents: 20000, itemId: 'paper', quantity: 10 }] }),
      ],
    }));
    const csv = vendorPriceHistoryCsvRows(rows);
    assert.equal(csv.length, 2);
    assert.equal(VENDOR_PRICE_HISTORY_CSV_HEADERS.length, csv[0].length);
    const usd = csv.find(row => row[3] === 'USD');
    const eur = csv.find(row => row[3] === 'EUR');
    assert.equal(usd?.[8], 1000);
    assert.equal(eur?.[8], 2000);
    assert.equal(usd?.[9], '', 'one point has no change percent');
    assert.match(String(usd?.[0]), /Acme Supplies/);
  });
});
