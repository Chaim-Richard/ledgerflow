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
