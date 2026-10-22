/**
 * A-192 screen: inventory turnover. The server's item details for the Widget of the lib test come
 * back over the stubbed fetch; the screen asks for the chosen period and shows turnover 1.60.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import InventoryTurnoverReportView from '../components/reporting/InventoryTurnoverReportView';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { stubFetchWithBodies } from './helpers/dom';
import { getSupabase } from '../lib/db/client';

const move = (kind: string, quantity: number, valueCents: number) => ({
  key: `${kind}-${quantity}`, date: '2026-01-15', kind, quantity, quantityAfter: 0, valueCents, unitCostCents: 400,
});
const items = [{
  itemId: 'w', itemName: 'Widget',
  opening: { quantity: 100, valueCents: 40_000 },
  moves: [move('purchase', 50, 20_000), move('sale', -110, -44_000), move('return', 1, 400), move('adjustment', -5, -2_000)],
  received: 51, issued: 115,
  closing: { quantity: 36, valueCents: 14_400 },
}];

describe('Inventory turnover screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('asks the server for the stock history and shows the turnover by hand', async () => {
    setComponentWorkspace('owner');
    const calls = stubFetchWithBodies(200, { items });
    render(<InventoryTurnoverReportView />);
    await waitFor(() => assert.ok(screen.getByRole('rowheader', { name: /Widget/ })));
    assert.ok(calls[0].url.startsWith('/api/v1/reports/inventory-details?workspaceId=component-workspace&startDate='));
    const row = screen.getByRole('rowheader', { name: /Widget/ }).parentElement!;
    assert.match(row.textContent || '', /109/, 'sold net of the return');
    assert.match(row.textContent || '', /1\.60/, 'turnover 109 over average 68');
    assert.match(row.textContent || '', /\$436\.00/, 'cost of what sold');
  });
});
