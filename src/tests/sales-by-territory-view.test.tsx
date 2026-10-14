import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { SalesByTerritoryPanel } from '../components/reporting/SalesByTerritoryReportView';
import { salesByTerritory, type SalesByTerritoryInput } from '../lib/salesByTerritory';

const input: SalesByTerritoryInput = {
  invoices: [
    { id: 'i1', uid: 'u', workspaceId: 'ws', customerId: 'c', date: '2026-03-01', dueDate: '2026-03-31', status: 'sent', amountCents: 11000, exchangeRate: 1.1, items: [{ id: 'l1', description: 'Sale', quantity: 1, rateCents: 10000, amountCents: 10000, accountId: 'revenue', dimensions: { location: 'L1' } }] },
    { id: 'i2', uid: 'u', workspaceId: 'ws', customerId: 'c', date: '2026-03-02', dueDate: '2026-04-01', status: 'paid', amountCents: 5000, items: [{ id: 'l2', description: 'Sale', quantity: 1, rateCents: 5000, amountCents: 5000, accountId: 'revenue' }] },
  ],
  dimensionNodes: [{ id: 'L1', dimensionId: 'location', description: 'East office' }],
  homeCurrency: 'USD',
};

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

test('A-142 screen exposes the Location grouping, base-currency figures and Unassigned bucket', async () => {
  const report = salesByTerritory(input);
  render(<SalesByTerritoryPanel report={report} from="2026-03-01" to="2026-03-31" locationLabel="Location" currency="USD" />);
  await flushReportTable();
  const table = screen.getByRole('table');
  assert.ok(screen.getByRole('heading', { name: 'Sales by territory' }));
  assert.match(table.textContent || '', /East office/);
  assert.match(table.textContent || '', /Unassigned/);
  assert.match(table.textContent || '', /\$110\.00/);
  assert.match(table.textContent || '', /\$50\.00/);
  assert.match(screen.getByText(/drafts, voided/).textContent || '', /opening-balance invoices are excluded/);
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
});

test('A-142 screen disables CSV when the issued-invoice cache is incomplete', async () => {
  const report = salesByTerritory(input);
  render(<SalesByTerritoryPanel report={report} partial />);
  await flushReportTable();
  assert.ok(screen.getByRole('alert').textContent?.includes('history is capped or failed'));
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});
