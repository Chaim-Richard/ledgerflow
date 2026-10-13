import test from 'node:test';
import assert from 'node:assert/strict';
import { purchasePriceVariance, purchasePriceVarianceCsvRows, PURCHASE_PRICE_VARIANCE_CSV_HEADERS, type PurchasePriceVarianceInput } from '../lib/purchasePriceVariance';
import type { Bill } from '../types';

const bill = (id: string, vendorId: string, amountCents: number, quantity: number, currency = 'USD', date = '2026-04-01', status: Bill['status'] = 'approved') => ({
  id, vendorId, number: id.toUpperCase(), date, currency, status,
  splits: [{ accountId: 'expense', itemId: 'paper', description: 'Paper', amountCents, quantity }],
});

const input = (overrides: Partial<PurchasePriceVarianceInput> = {}): PurchasePriceVarianceInput => ({
  bills: [
    bill('a-1', 'a', 1001, 1, 'USD', '2026-01-01'),
    bill('a-2', 'a', 1999, 2, 'USD', '2026-02-01'),
    bill('b-1', 'b', 5000, 2),
    bill('c-1', 'c', 2000, 2),
    bill('eur-1', 'd', 7000, 2, 'EUR'),
  ],
  vendors: [{ id: 'a', name: 'Vendor A' }, { id: 'b', name: 'Vendor B' }, { id: 'c', name: 'Vendor C' }, { id: 'd', name: 'Vendor D' }],
  items: [{ id: 'paper', name: 'Paper', sku: 'P-1' }],
  homeCurrency: 'USD',
  ...overrides,
});

test('A-141 uses weighted vendor unit costs and the median peer baseline in the same item and currency', () => {
  const rows = purchasePriceVariance(input());
  const vendorA = rows.find(row => row.vendorId === 'a');
  const vendorB = rows.find(row => row.vendorId === 'b');
  assert.equal(vendorA?.units, 3);
  assert.equal(vendorA?.totalCents, 3000);
  assert.equal(vendorA?.averageUnitCents, 1000, '3,000 cents ÷ 3 units');
  assert.equal(vendorA?.peerVendors, 2);
  assert.equal(vendorA?.peerMedianUnitCents, 1750, 'median of peer prices 1,000 and 2,500');
  assert.equal(vendorA?.varianceUnitCents, -750);
  assert.equal(vendorA?.variancePercent, -42.86);
  assert.equal(vendorB?.peerMedianUnitCents, 1000);
  assert.equal(vendorB?.varianceUnitCents, 1500);
  assert.equal(vendorB?.variancePercent, 150);
});

test('currencies are separate and no peer baseline or percent is invented for a single vendor', () => {
  const rows = purchasePriceVariance(input({ bills: [bill('a', 'a', 2500, 2), bill('eur', 'd', 7000, 2, 'EUR')] }));
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.currency === 'USD')?.peerMedianUnitCents, undefined);
  assert.equal(rows.find(row => row.currency === 'USD')?.variancePercent, undefined);
  assert.equal(rows.find(row => row.currency === 'EUR')?.peerMedianUnitCents, undefined);
});

test('draft, void, cancelled and rejected bills do not enter the baseline; window is inclusive', () => {
  const rows = purchasePriceVariance(input({
    from: '2026-02-01',
    to: '2026-04-01',
    bills: [
      bill('start', 'a', 2000, 2, 'USD', '2026-02-01'),
      bill('end', 'b', 4000, 2, 'USD', '2026-04-01'),
      bill('draft', 'c', 100000, 2, 'USD', '2026-03-01', 'draft'),
      bill('void', 'd', 100000, 2, 'USD', '2026-03-02', 'void'),
    ],
    vendors: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }],
  }));
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.vendorId === 'a')?.peerMedianUnitCents, 2000);
  assert.equal(rows.find(row => row.vendorId === 'b')?.peerMedianUnitCents, 1000);
});

test('CSV identifies all amounts as minor units in their recorded currency', () => {
  const rows = purchasePriceVariance(input());
  const csv = purchasePriceVarianceCsvRows(rows);
  assert.equal(csv.length, rows.length);
  assert.equal(csv[0].length, PURCHASE_PRICE_VARIANCE_CSV_HEADERS.length);
  const eur = csv.find(row => row[3] === 'EUR');
  assert.equal(eur?.[7], 3500);
  assert.equal(eur?.[8], 0);
  assert.equal(eur?.[9], '');
});
