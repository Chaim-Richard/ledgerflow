/**
 * Item categories (K-12 BA-05): counts, and renaming, merging or removing a category on all its
 * items in one database write.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CategoryManagerDialog from '../components/inventory/CategoryManagerDialog';
import { categoryCounts, renameCategoryPlan } from '../lib/itemCategories';
import { getSupabase } from '../lib/db/client';
import type { InventoryItem } from '../types';
import { setComponentWorkspace } from './helpers/componentFixtures';

const item = (id: string, category?: string): InventoryItem => ({
  id, uid: 'u', workspaceId: 'component-workspace', name: id, sku: id, unitPriceCents: 0, unitCostCents: 0, quantityAtHand: 0, reorderPoint: 0, createdAt: '2026-01-01', category,
});
const items = [item('a', 'Parts'), item('b', ' Parts '), item('c', 'Tools'), item('d'), item('e', '')];

describe('Item categories', () => {
  test('counts by category, spaces ignored, blank left out, by name', () => {
    assert.deepEqual(categoryCounts(items), [{ name: 'Parts', count: 2 }, { name: 'Tools', count: 1 }]);
  });

  test('rename, merge into an existing one, remove; nothing for the same name or an unknown one', () => {
    assert.deepEqual(renameCategoryPlan(items, 'Parts', 'Spare parts'), { ids: ['a', 'b'], to: 'Spare parts', merges: false });
    assert.deepEqual(renameCategoryPlan(items, 'Tools', ' Parts'), { ids: ['c'], to: 'Parts', merges: true });
    assert.deepEqual(renameCategoryPlan(items, 'Tools', '  '), { ids: ['c'], to: '', merges: false });
    assert.deepEqual(renameCategoryPlan(items, 'Parts', 'Parts ').ids, []);
    assert.deepEqual(renameCategoryPlan(items, 'Nope', 'X').ids, []);
  });
});

describe('Category manager', () => {
  beforeEach(() => setComponentWorkspace());
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('merging Tools into Parts updates every Tools item in one batch', async () => {
    const calls = stubFetchWithBodies(200, null);
    render(<CategoryManagerDialog items={items} onClose={() => {}} />);
    assert.ok(screen.getByText('2 items'));
    fireEvent.change(screen.getByLabelText('New name for Tools'), { target: { value: 'Parts' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Merge into Parts' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.includes('/rpc/lf_batch'))));
    const ops = (calls.find(c => c.url.includes('/rpc/lf_batch'))!.body as { p_ops: Array<{ op: string; table: string; id: string; data: Record<string, unknown> }> }).p_ops;
    assert.deepEqual(ops.map(o => [o.op, o.table, o.id, o.data.category]), [['update', 'inventory', 'c', 'Parts']]);
  });

  test('clearing the name removes the category; unchanged names cannot be saved', async () => {
    const calls = stubFetchWithBodies(200, null);
    render(<CategoryManagerDialog items={items} onClose={() => {}} />);
    assert.equal((screen.getAllByRole('button', { name: 'Rename' })[0] as HTMLButtonElement).disabled, true);
    fireEvent.change(screen.getByLabelText('New name for Parts'), { target: { value: '' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.includes('/rpc/lf_batch'))));
    const ops = (calls.find(c => c.url.includes('/rpc/lf_batch'))!.body as { p_ops: Array<{ id: string; data: Record<string, unknown> }> }).p_ops;
    assert.deepEqual(ops.map(o => [o.id, o.data.category]), [['a', ''], ['b', '']]);
  });
});
