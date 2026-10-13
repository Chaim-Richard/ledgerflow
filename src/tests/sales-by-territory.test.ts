import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInvoice } from './fixtures';
import { salesByTerritory, salesByTerritoryCsvRows, SALES_BY_TERRITORY_CSV_HEADERS, NO_LOCATION_KEY } from '../lib/salesByTerritory';
import { OPENING_DOCUMENT_TYPE } from '../lib/partyOpeningBalance';

const line = (id: string, amountCents: number, dimensions?: Record<string, string>) => ({
  id, itemId: 'item-1', description: 'Sale', quantity: 1, rateCents: amountCents, amountCents, accountId: 'revenue', dimensions,
});

const locationNodes = [{ id: 'L1', dimensionId: 'location', description: 'Northern store', aliases: ['North'] }];

test('A-142 groups issued invoice lines by canonical Location and retains an explicit Unassigned bucket', () => {
  const report = salesByTerritory({
    invoices: [
      makeInvoice({ id: 'north-1', date: '2026-01-10', status: 'sent', exchangeRate: 1.1, items: [line('l1', 10000, { location: 'L1' })] }),
      makeInvoice({ id: 'north-2', date: '2026-02-10', status: 'paid', items: [line('l2', 3000, { location: 'North' })] }),
      makeInvoice({ id: 'unassigned', date: '2026-03-10', status: 'overdue', items: [line('l3', 5000)] }),
      makeInvoice({ id: 'draft', date: '2026-02-01', status: 'draft', items: [line('l4', 999999, { location: 'L1' })] }),
      makeInvoice({ id: 'opening', date: '2026-02-01', status: 'sent', metadata: { type: OPENING_DOCUMENT_TYPE }, items: [line('l5', 888888, { location: 'L1' })] }),
      makeInvoice({ id: 'void', date: '2026-02-01', status: 'void', items: [line('l6', 777777, { location: 'L1' })] }),
    ],
    dimensionNodes: locationNodes,
    locationDimensionId: 'location',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    homeCurrency: 'USD',
  });

  const northern = report.rows.find(row => row.locationValue === 'L1');
  const unassigned = report.rows.find(row => row.key === NO_LOCATION_KEY);
  assert.equal(northern?.locationName, 'Northern store');
  assert.equal(northern?.salesCents, 14000, '10,000 × stored rate 1.1, plus 3,000');
  assert.equal(northern?.invoiceCount, 2);
  assert.equal(unassigned?.salesCents, 5000);
  assert.equal(report.totalSalesCents, 19000);
  assert.equal(report.invoiceCount, 3);
});

test('the date window is inclusive and invalid periods return no sales', () => {
  const invoices = [
    makeInvoice({ id: 'start', date: '2026-04-01', status: 'sent', items: [line('l1', 100)] }),
    makeInvoice({ id: 'outside', date: '2026-04-02', status: 'sent', items: [line('l2', 200)] }),
  ];
  const inRange = salesByTerritory({ invoices, startDate: '2026-04-01', endDate: '2026-04-01' });
  assert.equal(inRange.totalSalesCents, 100);
  assert.deepEqual(salesByTerritory({ invoices, startDate: '2026-04-31', endDate: '2026-05-01' }).rows, []);
});

test('CSV reports base minor units and the unassigned label', () => {
  const report = salesByTerritory({ invoices: [makeInvoice({ date: '2026-01-01', status: 'sent', items: [line('l1', 1250)] })] });
  const csv = salesByTerritoryCsvRows(report.rows);
  assert.equal(csv[0].length, SALES_BY_TERRITORY_CSV_HEADERS.length);
  assert.equal(csv[0][0], 'Unassigned');
  assert.equal(csv[0][4], 1250);
});
