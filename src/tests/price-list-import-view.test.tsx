/**
 * A-80 screen (task A-174): import price lists. Hand-checked: two good rows import (one changing a
 * saved list's price, one adding to it), an unknown SKU and a non-amount are named by their record
 * number and left out, the preview shows what changes before saving, and a guest cannot save.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import PriceListImportView from '../components/platform/settings/PriceListImportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const CSV = ['Item,List,Price', 'SKU-001,Wholesale,12.50', 'SKU-002,Wholesale,8', 'SKU-009,Wholesale,1.00', 'SKU-001,Retail,not-a-price'].join('\n');

const inventory = [
  { id: 'it-1', workspaceId: 'w1', name: 'Widget', sku: 'SKU-001' },
  { id: 'it-2', workspaceId: 'w1', name: 'Gadget', sku: 'SKU-002' },
];

const renderView = () => render(<PriceListImportView />);

describe('Import price lists screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({
      isGuest: true, user: null, currentWorkspaceId: 'w1',
      workspaces: [{ id: 'w1', name: 'W', currency: 'USD', priceLists: [{ id: 'pl_wholesale', name: 'Wholesale', prices: { 'it-2': 900 } }] }],
    } as never);
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({ inventory: inventory as never, truncatedCollections: {} as never });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('good rows import, bad rows are named by their record number and left out', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('CSV to import'), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Read the file' }));
    assert.match(screen.getByText(/row\(s\) read/).textContent || '', /2 row\(s\) read, 2 row\(s\) left out/);
    const problems = within(screen.getByRole('table', { name: /Rows left out of the import/ }));
    const rows = problems.getAllByRole('row').slice(1);
    assert.match(rows[0].textContent || '', /4No item has the SKU “SKU-009”/);
    assert.match(rows[1].textContent || '', /5The price “not-a-price” is not an amount/);
    const importing = within(screen.getByRole('table', { name: /Rows that import/ }));
    const good = importing.getAllByRole('row').slice(1).map(r => r.textContent || '');
    assert.match(good[0], /2WidgetWholesale1250USD/);
    assert.match(good[1], /3GadgetWholesale800USD/);
  });

  test('the preview shows the change before saving, and a guest cannot save', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('CSV to import'), { target: { value: CSV } });
    fireEvent.click(screen.getByRole('button', { name: 'Read the file' }));
    assert.match(screen.getByRole('heading', { name: /Preview/ }).textContent || '', /2 price\(s\) set on 1 list\(s\)/);
    const after = within(screen.getByRole('table', { name: /The lists after the import/ }));
    assert.match(after.getAllByRole('row')[1].textContent || '', /WholesaleUSD2/, 'the saved list with both prices on it');
    const save = screen.getByRole('button', { name: 'Save the import' });
    assert.ok((save as HTMLButtonElement).disabled, 'a guest workspace can read and preview but not save');
    assert.ok(screen.getByText(/A guest workspace has no server/));
  });

  test('a header without the needed columns is refused as a whole, not row by row', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('CSV to import'), { target: { value: 'Name,Phone\nDana,123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Read the file' }));
    assert.ok(screen.getByText(/The first row needs the columns Item, List and Price/));
  });
});
