/**
 * A-115: reorder suggestions by location. Hand-checked: total mode is unchanged (nothing below the
 * reorder point suggests nothing); location mode suggests a top-up to the maximum where a location
 * fell below its minimum, priced from the last purchase; an item whose history does not prove the
 * split is listed as unplaced with the reason, never suggested; with no levels the screen says
 * where to set them. Nothing is written.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ReorderSuggestionsReportView from '../components/reporting/ReorderSuggestionsReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const inventory = [
  { id: 'i1', workspaceId: 'w1', name: 'Widget', sku: 'W-1', quantityAtHand: 5, reorderPoint: 0, unitCostCents: 500, measurementUnit: 'pcs', locationLevels: { 'loc-a': { min: 4, max: 10 }, 'loc-b': { min: 2, max: 6 } } },
  { id: 'i2', workspaceId: 'w1', name: 'Ghost', sku: 'G-9', quantityAtHand: 3, reorderPoint: 0, unitCostCents: 100, locationLevels: { 'loc-a': { min: 1, max: 5 } } },
];
const nodes = [
  { id: 'loc-a', dimensionId: 'location', description: 'Shelf A', status: 'active' },
  { id: 'loc-b', dimensionId: 'location', description: 'Shelf B', status: 'active' },
];
const vendors = [{ id: 'v1', workspaceId: 'w1', name: 'Vendor One' }];
const bills = [
  { id: 'b1', workspaceId: 'w1', vendorId: 'v1', date: '2026-09-01', currency: 'USD', splits: [{ itemId: 'i1', description: 'Widget', amountCents: 10000, quantity: 10 }] },
];
const history = [
  { workspaceId: 'w1', itemId: 'i1', date: '2026-10-01', kind: 'purchase', quantity: 6, quantityBefore: 0, quantityAfter: 6, seq: 'a', locationId: 'loc-a' },
  { workspaceId: 'w1', itemId: 'i1', date: '2026-10-02', kind: 'transfer-out', quantity: -2, quantityBefore: 6, quantityAfter: 4, seq: 'b', locationId: 'loc-a' },
  { workspaceId: 'w1', itemId: 'i1', date: '2026-10-02', kind: 'transfer-in', quantity: 2, quantityBefore: 4, quantityAfter: 6, seq: 'c', locationId: 'loc-b' },
  { workspaceId: 'w1', itemId: 'i1', date: '2026-10-03', kind: 'sale', quantity: -1, quantityBefore: 6, quantityAfter: 5, seq: 'd', locationId: 'loc-a' },
];
const movesFor = (itemId: string) => Promise.resolve((itemId === 'i1' ? history : []) as never);

describe('Reorder suggestions by location', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] } as never);
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      inventory: inventory as never, vendors: vendors as never, bills: bills as never,
      dimensionNodes: nodes as never, truncatedCollections: {} as never,
    });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('location mode suggests the top-up to the maximum and lists the unplaced with the reason', async () => {
    render(<ReorderSuggestionsReportView loadItemMoves={movesFor} />);
    assert.ok(screen.getByText('Nothing is below its reorder point. Reorder points are set on the items in Inventory.'));
    fireEvent.change(screen.getByLabelText('Suggest by'), { target: { value: 'location' } });
    await waitFor(() => assert.match(
      screen.getByText(/location\(s\) below their minimum/).textContent || '',
      /1 location\(s\) below their minimum across 1 group\(s\)/,
    ));
    const table = screen.getByRole('table', { name: /What to reorder from Vendor One/ });
    const row = within(table).getAllByRole('row').slice(1)[0];
    assert.match(row.textContent || '', /WidgetW-1Shelf A3 pcs4 pcs10 pcs7 pcs\$10\.00\$70\.00last purchase/);
    assert.match(screen.getByText(/Not placed by location/).textContent || '', /Not placed by location \(1\)/);
    const unplaced = screen.getByText((_, el) => el?.tagName === 'LI' && (el.textContent || '').includes('Ghost'));
    assert.match(unplaced.textContent || '', /before the stock history/);
  });

  test('with no levels the screen says where to set them', async () => {
    useLedgerStore.setState({ inventory: [{ id: 'i1', workspaceId: 'w1', name: 'Widget', quantityAtHand: 5, reorderPoint: 0 }] as never });
    render(<ReorderSuggestionsReportView loadItemMoves={movesFor} />);
    fireEvent.change(screen.getByLabelText('Suggest by'), { target: { value: 'location' } });
    await waitFor(() => assert.ok(screen.getByText(/No item has stock levels per location yet/)));
  });

  test('an unreadable history says so instead of suggesting', async () => {
    render(<ReorderSuggestionsReportView loadItemMoves={async () => { throw new Error('offline'); }} />);
    fireEvent.change(screen.getByLabelText('Suggest by'), { target: { value: 'location' } });
    await waitFor(() => assert.ok(screen.getByText(/The stock history could not be read: offline/)));
  });
});
