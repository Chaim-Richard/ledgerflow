/**
 * The bill dialog (J-08): a line can name a stock item and its units; then it says it posts to
 * Inventory, or what is missing, and the bill is saved with the item and the units on the line.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BillModal, { type BillDraft } from '../components/purchases/BillModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { stubFetch } from './helpers/dom';
import { markComponentCollectionsLoaded } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import type { InventoryItem, Workspace } from '../types';
import { makeChartAccount, makeVendor } from './fixtures';

beforeEach(() => {
  stubFetch(404);
  useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
  markComponentCollectionsLoaded('inventory');
  useLedgerStore.setState({ bills: [], transactions: [], taxRates: [], inventory: [{ id: 'chair', name: 'Chair', quantityAtHand: 2, unitCostCents: 1000 } as InventoryItem] });
});
afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

test('a line buys 3 chairs: it says what is missing until the units are in, and saves the item and units', async () => {
  const saved: BillDraft[] = [];
  render(<BillModal isOpen onClose={() => {}} onSave={b => { saved.push(b); }} vendors={[makeVendor({ id: 'v1', name: 'Furniture Co' })]} accounts={[makeChartAccount({ id: 'exp', name: 'Purchases', type: 'expense' })]} />);
  fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
  fireEvent.change(screen.getByLabelText('Expense Account'), { target: { value: 'exp' } });
  fireEvent.change(screen.getByLabelText(/^Amount \(/), { target: { value: '36' } });
  fireEvent.change(screen.getByLabelText('Stock item on line 1'), { target: { value: 'chair' } });
  assert.ok(screen.getByText('Enter how many units came in'));
  fireEvent.change(screen.getByLabelText('Units on line 1'), { target: { value: '3' } });
  assert.ok(screen.getByText('Posts to Inventory; the units come in with the bill.'));
  await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
  await waitFor(() => assert.equal(saved.length, 1));
  assert.deepEqual(saved[0].splits?.map(s => [s.itemId, s.quantity, s.amountCents]), [['chair', 3, 3600]]);
});

test('with a stock item on the bill, another line can be spread over the items (BA-03)', async () => {
  const saved: BillDraft[] = [];
  render(<BillModal isOpen onClose={() => {}} onSave={b => { saved.push(b); }} vendors={[makeVendor({ id: 'v1', name: 'Furniture Co' })]} accounts={[makeChartAccount({ id: 'exp', name: 'Purchases', type: 'expense' })]} />);
  fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
  fireEvent.change(screen.getByLabelText('Expense Account'), { target: { value: 'exp' } });
  fireEvent.change(screen.getByLabelText(/^Amount \(/), { target: { value: '36' } });
  fireEvent.click(screen.getByLabelText('Add Split Expense'));
  fireEvent.change(screen.getAllByLabelText('Expense Account')[1], { target: { value: 'exp' } });
  fireEvent.change(screen.getAllByLabelText(/^Amount \(/)[1], { target: { value: '4' } });
  assert.equal(screen.queryByLabelText('Spread line 2 over the items'), null, 'no stock item yet');
  fireEvent.change(screen.getByLabelText('Stock item on line 1'), { target: { value: 'chair' } });
  fireEvent.change(screen.getByLabelText('Units on line 1'), { target: { value: '3' } });
  fireEvent.click(screen.getByLabelText('Spread line 2 over the items'));
  await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
  await waitFor(() => assert.equal(saved.length, 1));
  assert.deepEqual(saved[0].splits?.map(s => [s.itemId, s.landedCost, s.amountCents]), [['chair', undefined, 3600], [undefined, true, 400]]);
});

test('a bill opened again keeps its item lines and landed cost (so saving it does not lose the stock)', async () => {
  const saved: BillDraft[] = [];
  render(<BillModal isOpen onClose={() => {}} onSave={b => { saved.push(b); }} vendors={[makeVendor({ id: 'v1', name: 'Furniture Co' })]} accounts={[makeChartAccount({ id: 'exp', name: 'Purchases', type: 'expense' })]}
    initialBill={{ id: 'b1', vendorId: 'v1', vendorName: 'Furniture Co', status: 'pending', amountCents: 4000, date: '2026-04-01', dueDate: '2026-05-01',
      splits: [{ amountCents: 3600, accountId: 'exp', description: 'Chairs', itemId: 'chair', quantity: 3 }, { amountCents: 400, accountId: 'exp', description: 'Freight', landedCost: true }] }} />);
  assert.equal((screen.getByLabelText('Units on line 1') as HTMLInputElement).value, '3');
  assert.equal((screen.getByLabelText('Spread line 2 over the items') as HTMLInputElement).checked, true);
  await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
  await waitFor(() => assert.equal(saved.length, 1));
  assert.deepEqual(saved[0].splits?.map(s => [s.itemId, s.quantity, s.landedCost]), [['chair', 3, undefined], [undefined, undefined, true]]);
});
