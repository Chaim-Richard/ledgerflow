/**
 * A-50 screen (task A-173): reorder suggestions. Hand-checked: an item 8 under its point in packages of
 * 4 suggests 8, grouped under the vendor on its home-currency bill; the EUR bill is never a unit cost
 * (no rate is guessed); an item never bought sits with "no preferred vendor" at the item's own cost; a
 * guest reads the report but cannot create draft purchase orders.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import ReorderSuggestionsReportView from '../components/reporting/ReorderSuggestionsReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const inventory = [
  { id: 'a', workspaceId: 'w1', name: 'Widget', sku: 'W-1', quantityAtHand: 2, reorderPoint: 10, unitsPerPackage: 4, unitCostCents: 500, measurementUnit: 'each' },
  { id: 'b', workspaceId: 'w1', name: 'Gadget', sku: 'G-1', quantityAtHand: 50, reorderPoint: 3, unitCostCents: 700 },
  { id: 'c', workspaceId: 'w1', name: 'Ribbon', sku: 'R-1', quantityAtHand: 0, reorderPoint: 5, unitCostCents: 300 },
  { id: 'd', workspaceId: 'w1', name: 'Advice', sku: 'A-9', itemType: 'service', quantityAtHand: 0, reorderPoint: 9 },
];
const vendors = [{ id: 'v1', workspaceId: 'w1', name: 'Vendor One' }];
const bills = [
  { id: 'b1', workspaceId: 'w1', vendorId: 'v1', date: '2026-09-01', currency: 'USD', status: 'sent', splits: [{ itemId: 'a', description: 'Widget', amountCents: 1000, quantity: 2 }] },
  { id: 'b2', workspaceId: 'w1', vendorId: 'v1', date: '2026-09-20', currency: 'EUR', status: 'sent', splits: [{ itemId: 'a', description: 'Widget', amountCents: 99900, quantity: 1 }] },
];

const tableText = () => screen.getAllByRole('table').map(t => t.textContent || '').join('\n');

describe('Reorder suggestions screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] } as never);
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      inventory: inventory as never, vendors: vendors as never, bills: bills as never, truncatedCollections: {} as never,
    });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('whole packages against the point, grouped by the last home-currency vendor', () => {
    render(<ReorderSuggestionsReportView />);
    assert.match(screen.getByText(/item\(s\) below their reorder point/).textContent || '', /2 item\(s\) below their reorder point across 2 group\(s\)/);
    const vendorGroup = screen.getByRole('heading', { name: /Vendor One/ });
    assert.match(vendorGroup.textContent || '', /1 item\(s\) · about \$40\.00/, '8 units on the 5.00 home-currency bill, not the EUR one');
    const firstTable = within(screen.getAllByRole('table')[0]);
    const row = firstTable.getAllByRole('row').slice(1)[0];
    assert.match(row.textContent || '', /WidgetW-12 each10 each8 each\$5\.00\$40\.00last purchase/);
    assert.ok(!tableText().includes('Gadget'), 'above its point, not suggested');
    assert.ok(!tableText().includes('Advice'), 'a service is never suggested');
  });

  test('an item never bought sits with no vendor at the item cost, and a guest cannot create drafts', () => {
    render(<ReorderSuggestionsReportView />);
    assert.match(screen.getByRole('heading', { name: /No preferred vendor yet/ }).textContent || '', /1 item\(s\) · about \$15\.00/);
    assert.match(tableText(), /RibbonR-1055\$3\.00\$15\.00item record/);
    const create = screen.getByRole('button', { name: /Create 1 draft purchase order/ });
    assert.ok((create as HTMLButtonElement).disabled, 'a guest workspace has no signed-in user to write the drafts');
    assert.ok(screen.getByText(/A guest workspace has no signed-in user/));
  });
});
