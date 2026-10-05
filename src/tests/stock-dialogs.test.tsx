/**
 * Adjust stock and stock count (K-13 BA-04 W-04 W-05): the default accounts, the value shown
 * before saving, and what is sent to the server (which posts the entry and changes the stock).
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StockAdjustDialog from '../components/inventory/StockAdjustDialog';
import StockCountDialog from '../components/inventory/StockCountDialog';
import { countDifferences, defaultOffsetAccount, inventoryAccountsOf, offsetAccountChoices } from '../lib/inventoryAccounts';
import { useAuthStore } from '../stores/useAuthStore';
import type { InventoryItem, Workspace } from '../types';
import { makeChartAccount } from './fixtures';

const accounts = [
  makeChartAccount({ id: 'bank', name: 'Business Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'inv-old', name: 'Old Inventory', type: 'asset', category: 'Inventory', isArchived: true }),
  makeChartAccount({ id: 'inv', name: 'Inventory', type: 'asset', category: 'Inventory' }),
  makeChartAccount({ id: 'ap', name: 'Accounts Payable', type: 'liability', category: 'Payables' }),
  makeChartAccount({ id: 'equity', name: "Owner's Equity", type: 'equity' }),
  makeChartAccount({ id: 'obe', name: 'Opening Balance Equity', type: 'equity' }),
  makeChartAccount({ id: 'cogs', name: 'Cost of Goods Sold', type: 'expense', category: 'COGS' }),
  makeChartAccount({ id: 'shrink', name: 'Inventory Shrinkage', type: 'expense' }),
];

const item = (overrides: Partial<InventoryItem>): InventoryItem => ({
  id: 'a', uid: 'u1', workspaceId: 'w1', name: 'Widget', sku: 'W-1', unitPriceCents: 900, unitCostCents: 400,
  quantityAtHand: 10, reorderPoint: 0, createdAt: '2026-01-01', ...overrides,
});

const clickText = (text: string) => act(async () => { fireEvent.click(screen.getByText(text)); });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const withoutDate = (body: unknown) => {
  const { date, ...rest } = body as Record<string, unknown>;
  assert.match(String(date), /^\d{4}-\d{2}-\d{2}$/);
  return rest;
};

describe('stock accounts', () => {
  test('inventory accounts skip archived ones; the other side never offers an inventory account', () => {
    assert.deepEqual(inventoryAccountsOf(accounts).map(a => a.id), ['inv']);
    assert.ok(!offsetAccountChoices(accounts).some(a => a.id.startsWith('inv')));
  });

  test('default other side by reason', () => {
    assert.equal(defaultOffsetAccount(accounts, 'opening')?.id, 'obe', 'Opening Balance Equity, not the first equity account');
    assert.equal(defaultOffsetAccount(accounts, 'purchase')?.id, 'bank');
    assert.equal(defaultOffsetAccount(accounts, 'adjustment')?.id, 'shrink', 'an expense named shrinkage');
    assert.equal(defaultOffsetAccount(accounts, 'count')?.id, 'shrink');
    const plain = accounts.filter(a => a.id !== 'shrink' && a.id !== 'obe' && a.id !== 'bank');
    assert.equal(defaultOffsetAccount(plain, 'adjustment')?.id, 'cogs', 'falls back to Cost of Goods Sold');
    assert.equal(defaultOffsetAccount(plain, 'opening')?.id, 'equity', 'falls back to the first equity account');
    assert.equal(defaultOffsetAccount(plain, 'purchase')?.id, 'ap', 'no bank: Accounts Payable');
  });

  test('count differences: blank, unchanged and invalid rows are skipped; value at cost', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', quantityAtHand: 3 }), item({ id: 'c' }), item({ id: 'd', unitCostCents: 0 })];
    const rows = countDifferences(items, { a: '8', b: '3', c: '', d: '12', x: '5' });
    assert.deepEqual(rows.map(r => [r.item.id, r.counted, r.difference, r.valueCents]), [['a', 8, -2, -800], ['d', 12, 2, 0]]);
    assert.deepEqual(countDifferences(items, { a: '-1' }), []);
  });
});

describe('Adjust stock dialog', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { uid: 'u1' } as never, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
  });
  afterEach(() => cleanup());

  test('removing 3 damaged units posts −12.00 against the shrinkage account', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok', transactionId: 't1', valueCents: -1200, items: [], newQuantity: 7 });
    let closed = 0;
    render(<StockAdjustDialog item={item({})} workspaceId="w1" accounts={accounts} currency="USD" onClose={() => { closed++; }} />);
    type('Quantity', '3');
    type('Note (optional)', 'Water damage');
    assert.equal(screen.getByTestId('stock-adjust-value').textContent, '-$12.00');
    assert.match(document.body.textContent || '', /Stock 10 → 7/);
    await clickText('Save adjustment');
    await waitFor(() => assert.equal(closed, 1));
    assert.equal(calls[0].url, '/api/v1/inventory/adjust');
    assert.deepEqual(withoutDate(calls[0].body), {
      workspaceId: 'w1', itemId: 'a', quantityChange: -3, type: 'adjustment', inventoryAccountId: 'inv', offsetAccountId: 'shrink', reason: 'Water damage',
    });
  });

  test('stock received sends the cost per unit and pays from the bank', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok', transactionId: 't2', valueCents: 3000, items: [], newQuantity: 15 });
    render(<StockAdjustDialog item={item({})} workspaceId="w1" accounts={accounts} currency="USD" onClose={() => {}} />);
    type('Why', 'purchase');
    type('Quantity', '5');
    type('Cost per unit', '6.00');
    assert.equal(screen.getByTestId('stock-adjust-value').textContent, '$30.00');
    await clickText('Save adjustment');
    await waitFor(() => assert.equal(calls.length, 1));
    assert.deepEqual(withoutDate(calls[0].body), {
      workspaceId: 'w1', itemId: 'a', quantityChange: 5, type: 'purchase', inventoryAccountId: 'inv', offsetAccountId: 'bank', unitCostCents: 600,
    });
  });

  test('cannot remove more than is on hand, and needs an Inventory account', async () => {
    const calls = stubFetchWithBodies(200, {});
    render(<StockAdjustDialog item={item({})} workspaceId="w1" accounts={accounts} onClose={() => {}} />);
    type('Quantity', '11');
    assert.match(screen.getByRole('alert').textContent || '', /Only 10 on hand/);
    assert.equal((screen.getByText('Save adjustment') as HTMLButtonElement).disabled, true);
    cleanup();
    render(<StockAdjustDialog item={item({})} workspaceId="w1" accounts={accounts.filter(a => a.id !== 'inv')} onClose={() => {}} />);
    assert.match(screen.getByRole('alert').textContent || '', /Add an Inventory account/);
    assert.equal(calls.length, 0);
  });

  test('a refusal from the server keeps the dialog open', async () => {
    const calls = stubFetchWithBodies(400, { error: 'This period is locked' });
    let closed = 0;
    render(<StockAdjustDialog item={item({})} workspaceId="w1" accounts={accounts} onClose={() => { closed++; }} />);
    type('Quantity', '1');
    await clickText('Save adjustment');
    await waitFor(() => assert.equal(calls.length, 1));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(closed, 0);
  });
});

describe('Stock count dialog', () => {
  afterEach(() => cleanup());

  test('sends only the counted items that differ; total variance shown first', async () => {
    const calls = stubFetchWithBodies(200, { status: 'ok', transactionId: 't3', valueCents: -800, items: [{ itemId: 'a' }] });
    let closed = 0;
    const items = [item({ id: 'a', name: 'Widget' }), item({ id: 'b', name: 'Gadget', quantityAtHand: 4, unitCostCents: 250 })];
    render(<StockCountDialog items={items} workspaceId="w1" accounts={accounts} currency="USD" onClose={() => { closed++; }} />);
    assert.equal((screen.getByText('Save count') as HTMLButtonElement).disabled, true, 'nothing counted yet');
    type('Counted quantity of Widget', '8');
    type('Counted quantity of Gadget', '4');
    assert.equal(screen.getByTestId('stock-count-total').textContent, '-$8.00');
    assert.equal((screen.getByLabelText('Variance account') as HTMLSelectElement).value, 'shrink');
    await clickText('Save count');
    await waitFor(() => assert.equal(closed, 1));
    assert.equal(calls[0].url, '/api/v1/inventory/count');
    assert.deepEqual(withoutDate(calls[0].body), {
      workspaceId: 'w1', inventoryAccountId: 'inv', offsetAccountId: 'shrink', counts: [{ itemId: 'a', counted: 8 }],
    });
  });

  test('the filter narrows the rows but keeps what was already counted', async () => {
    stubFetchWithBodies(200, {});
    const items = [item({ id: 'a', name: 'Widget' }), item({ id: 'b', name: 'Gadget', category: 'Parts' })];
    render(<StockCountDialog items={items} workspaceId="w1" accounts={accounts} onClose={() => {}} />);
    type('Counted quantity of Widget', '9');
    type('Filter items to count', 'parts');
    assert.equal(screen.queryByLabelText('Counted quantity of Widget'), null);
    assert.ok(screen.getByLabelText('Counted quantity of Gadget'));
    assert.match(document.body.textContent || '', /1 item differ/);
  });
});
