/** A-9 (W-09) screen: the list, the "no sale in N days" filter and the empty state, from the loaded items and invoices. */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import SlowMovingStockView from '../components/reporting/SlowMovingStockView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

describe('Slow-moving items screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null });
    useDataNeedsStore.setState({ loaded: { inventory: true, invoices: true } as never });
    useLedgerStore.setState({
      inventory: [
        { id: 'a', name: 'Bolt', sku: 'B-1', quantityAtHand: 3, unitCostCents: 1250 } as never,
        { id: 'b', name: 'Nut', sku: '', quantityAtHand: 10, unitCostCents: 99 } as never,
      ],
      invoices: [{ id: 'i1', date: '2026-08-01', status: 'paid', items: [{ itemId: 'a', quantity: 1 }] }] as never,
    });
  });
  // the data hook opens the database client: close it so the test process ends
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('lists items with value and last sale; never sold first', () => {
    render(<SlowMovingStockView />);
    const rows = screen.getAllByRole('row').slice(1);
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent || '', /Nut/);
    assert.match(rows[0].textContent || '', /never/);
    assert.match(rows[1].textContent || '', /Bolt/);
    assert.match(rows[1].textContent || '', /2026-08-01/);
  });

  test('"no sale in N days" hides items sold more recently than N days before the day shown', () => {
    render(<SlowMovingStockView />);
    // as of 2026-08-10 Bolt was sold 9 days earlier and Nut was never sold
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText(/no sale in/i), { target: { value: '30' } });
    const table = screen.getByRole('table');
    assert.equal(within(table).queryByRole('rowheader', { name: /Bolt/ }), null);
    assert.ok(within(table).getByRole('rowheader', { name: /Nut/ }));
  });
});
