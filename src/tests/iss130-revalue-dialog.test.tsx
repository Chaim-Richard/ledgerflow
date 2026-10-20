/**
 * ISS-130 on the screen: Revalue stock shows the change in value before saving and sends one request id, kept for a
 * retry; the item form leaves the cost of stock on hand read-only and does not send it.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import StockRevalueDialog from '../components/inventory/StockRevalueDialog';
import InventoryItemDialog from '../components/inventory/InventoryItemDialog';
import type { InventoryItem } from '../types';
import { makeChartAccount } from './fixtures';

const accounts = [
  makeChartAccount({ id: 'inv', name: 'Inventory', type: 'asset', category: 'Inventory' }),
  makeChartAccount({ id: 'cogs', name: 'Cost of Goods Sold', type: 'expense', category: 'COGS' }),
  makeChartAccount({ id: 'shrink', name: 'Inventory Shrinkage', type: 'expense' }),
];
const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'w', uid: 'u1', workspaceId: 'w1', name: 'Widget', sku: 'W-1', unitPriceCents: 2_000, unitCostCents: 1_000,
  quantityAtHand: 10, reorderPoint: 0, createdAt: '2026-01-01', ...overrides,
});

describe('ISS-130 Revalue stock', () => {
  afterEach(() => cleanup());

  test('10 widgets from 10.00 to 12.00: shows +20.00, sends the cost, accounts, reason and one request id', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok', transactionId: 't1', quantity: 10, oldUnitCostCents: 1_000, newUnitCostCents: 1_200, valueCents: 2_000, replayed: false });
    render(<StockRevalueDialog item={item()} workspaceId="w1" accounts={accounts} currency="USD" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('New cost per unit'), { target: { value: '12.00' } });
    assert.match(screen.getByTestId('stock-revalue-value').textContent || '', /20\.00/);
    assert.match(screen.getByRole('alert').textContent || '', /Say why the cost changes/);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Supplier price list' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save revaluation' })); });
    assert.equal(calls.length, 1);
    const body = calls[0].body as Record<string, unknown>;
    assert.equal(calls[0].url, '/api/v1/inventory/revalue');
    assert.deepEqual([body.itemId, body.newUnitCostCents, body.inventoryAccountId, body.offsetAccountId, body.reason], ['w', 1_200, 'inv', 'shrink', 'Supplier price list']);
    assert.match(String(body.requestId), /^reval-[a-z0-9]+-[a-z0-9]+$/);
  });

  test('a write-down shows a negative change, and the same cost is refused before sending', async () => {
    const calls = stubFetchWithBodies(200, {});
    render(<StockRevalueDialog item={item({ quantityAtHand: 3, unitCostCents: 333 })} workspaceId="w1" accounts={accounts} currency="USD" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('New cost per unit'), { target: { value: '2.50' } });
    assert.match(screen.getByTestId('stock-revalue-value').textContent || '', /-.*2\.49|\(.*2\.49|−.*2\.49/, '3 × 2.50 − 3 × 3.33 = −2.49');
    fireEvent.change(screen.getByLabelText('New cost per unit'), { target: { value: '3.33' } });
    assert.match(screen.getByRole('alert').textContent || '', /That is its cost now/);
    assert.equal((screen.getByRole('button', { name: 'Save revaluation' }) as HTMLButtonElement).disabled, true);
    assert.equal(calls.length, 0);
  });
});

describe('ISS-130 item form', () => {
  afterEach(() => cleanup());
  test('stock on hand: the cost is read-only and offers a revaluation; nothing on hand: editable', () => {
    const revalued: string[] = [];
    render(<InventoryItemDialog open editingItem={item()} categories={[]} canChangeStock onClose={() => {}} onSubmit={() => {}} onAdjust={() => {}} onRevalue={it => { revalued.push(it.id); }} />);
    assert.equal((screen.getByLabelText(/Unit Cost/) as HTMLInputElement).readOnly, true);
    assert.match(document.body.textContent || '', /change it with a revaluation, which posts the difference/);
    fireEvent.click(screen.getByRole('button', { name: 'Revalue cost' }));
    assert.deepEqual(revalued, ['w']);
    cleanup();
    render(<InventoryItemDialog open editingItem={item({ quantityAtHand: 0 })} categories={[]} canChangeStock onClose={() => {}} onSubmit={() => {}} onAdjust={() => {}} />);
    assert.equal((screen.getByLabelText(/Unit Cost/) as HTMLInputElement).readOnly, false);
  });
});
