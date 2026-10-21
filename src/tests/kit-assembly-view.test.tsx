/**
 * A-116 screen: kit assembly. Hand-checked against the same worked figures as kit-assembly.test.ts
 * (Starter kit = 2 × Part A + 1 × Part B, on hand 5 and 3): "2 kits can be built", the plan for 3
 * kits names the shortfall, and the screen records nothing. Nothing is written.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import KitAssemblyReportView from '../components/reporting/KitAssemblyReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const items = [
  { id: 'kit', name: 'Starter kit', sku: 'KIT-1', workspaceId: 'w1', quantityAtHand: 0, unitPriceCents: 900, unitCostCents: 700, reorderPoint: 0, createdAt: '2026-01-01', uid: 'u', assembleOnDemand: true,
    bundleParts: [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 1 }] },
  { id: 'a', name: 'Part A', sku: 'A-1', workspaceId: 'w1', quantityAtHand: 5, unitPriceCents: 100, unitCostCents: 50, reorderPoint: 0, createdAt: '2026-01-01', uid: 'u' },
  { id: 'b', name: 'Part B', sku: 'B-1', workspaceId: 'w1', quantityAtHand: 3, unitPriceCents: 200, unitCostCents: 100, reorderPoint: 0, createdAt: '2026-01-01', uid: 'u' },
];

describe('Kit assembly screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({
      isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] as never,
    });
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({ inventory: items as never, truncatedCollections: {} as never });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('two kits from stock today; asking for 3 names the shortfall and shows the consumption', async () => {
    render(<KitAssemblyReportView />);
    const table = await screen.findByRole('table');
    const line = screen.getByText((_, el) => el?.tagName === 'P' && /can be built from what is on hand/.test(el.textContent || ''));
    assert.match(line.textContent || '', /2 kits can be built from what is on hand/);
    assert.match(line.textContent || '', /Marked “Assemble on demand”/);
    let rows = within(table).getAllByRole('row').map(r => (r.textContent || '').replace(/\s+/g, ' '));
    assert.ok(rows.some(t => /Part A/.test(t) && /2/.test(t) && /5/.test(t) && /2/.test(t)), rows.join(' | '));
    assert.ok(rows.some(t => /Part B/.test(t) && /1/.test(t) && /3/.test(t) && /3/.test(t)), rows.join(' | '));

    fireEvent.change(screen.getByLabelText('How many kits'), { target: { value: '3' } });
    await waitFor(() => assert.ok(screen.getByRole('alert')));
    assert.match(screen.getByRole('alert').textContent || '', /Only 2 kits can be built/);
    assert.match(screen.getByRole('alert').textContent || '', /Part A is short 1/);
    rows = within(table).getAllByRole('row').map(r => (r.textContent || '').replace(/\s+/g, ' '));
    assert.ok(rows.some(t => /Part A/.test(t) && /6/.test(t) && /-1/.test(t)), rows.join(' | '));
    assert.ok(rows.some(t => /Part B/.test(t) && /3/.test(t) && /0/.test(t)), rows.join(' | '));
    assert.ok(screen.getByText(/nothing is reserved, issued or posted/));
  });

  test('with no kits the screen says where to make one', async () => {
    useLedgerStore.setState({ inventory: [] as never, truncatedCollections: {} as never });
    render(<KitAssemblyReportView />);
    await waitFor(() => assert.ok(screen.getByText(/No kits yet/)));
  });
});
