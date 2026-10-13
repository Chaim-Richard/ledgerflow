import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PurchasePriceVariancePanel } from '../components/reporting/PurchasePriceVarianceReportView';
import { purchasePriceVariance, type PurchasePriceVarianceInput } from '../lib/purchasePriceVariance';

const input: PurchasePriceVarianceInput = {
  bills: [
    { id: 'a', vendorId: 'v1', number: 'A-1', date: '2026-01-01', currency: 'USD', status: 'approved', splits: [{ accountId: 'expense', itemId: 'paper', description: 'Paper', amountCents: 10000, quantity: 10 }] },
    { id: 'b', vendorId: 'v2', number: 'B-1', date: '2026-01-02', currency: 'USD', status: 'paid', splits: [{ accountId: 'expense', itemId: 'paper', description: 'Paper', amountCents: 15000, quantity: 10 }] },
  ],
  vendors: [{ id: 'v1', name: 'Vendor One' }, { id: 'v2', name: 'Vendor Two' }],
  items: [{ id: 'paper', name: 'Paper', sku: 'P-1' }],
  homeCurrency: 'USD',
};

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

test('A-141 screen explains and shows unit-cost variance against the comparable peer baseline', async () => {
  const rows = purchasePriceVariance(input);
  render(<PurchasePriceVariancePanel rows={rows} from="2026-01-01" to="2026-12-31" />);
  await flushReportTable();
  assert.ok(screen.getByRole('heading', { name: 'Purchase price variance by vendor' }));
  const table = screen.getByRole('table');
  assert.match(table.textContent || '', /\$10\.00/);
  assert.match(table.textContent || '', /\$15\.00/);
  assert.match(table.textContent || '', /-33\.33%/);
  assert.match(table.textContent || '', /\+50\.00%/);
  assert.match(screen.getByText(/median of the other vendors/).textContent || '', /same item and currency/);
  fireEvent.change(screen.getByLabelText('Variance vendor'), { target: { value: 'v1' } });
  assert.doesNotMatch(screen.getByRole('table').textContent || '', /Vendor Two/);
});

test('A-141 screen makes the absence of a peer baseline explicit', async () => {
  const rows = purchasePriceVariance({ ...input, bills: [input.bills[0]], vendors: [input.vendors[0]] });
  render(<PurchasePriceVariancePanel rows={rows} />);
  await flushReportTable();
  assert.match(screen.getByRole('table').textContent || '', /No peer baseline/);
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, false);
});
