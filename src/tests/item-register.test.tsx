/**
 * Item-wise registers (CB-12, CB-13): one row per invoice or bill line with a stock item in the
 * period (drafts, void documents and landed costs left out), for one item or all, oldest first, with
 * each item's units and amount; on screen, switching sides and opening a document.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { purchaseRegister, registerTotals, salesRegister } from '../lib/itemRegister';
import ItemRegisterReportView from '../components/reporting/ItemRegisterReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import type { Bill, Invoice, InventoryItem } from '../types';

const items = [{ id: 'chair', name: 'Chair' }, { id: 'desk', name: 'Desk' }] as InventoryItem[];
const nameOf = (id: string) => items.find(i => i.id === id)?.name || '';
const invoices = [
  { id: 'i2', number: 'INV-2', date: '2026-03-10', status: 'sent', customerName: 'Acme', items: [{ id: 'a', itemId: 'chair', description: 'Chair', quantity: 2, rateCents: 5000, amountCents: 10000, accountId: 's' }, { id: 'b', description: 'Delivery', quantity: 1, rateCents: 1500, amountCents: 1500, accountId: 's' }] },
  { id: 'i1', number: 'INV-1', date: '2026-02-01', status: 'paid', customerName: 'Bolt', currency: 'EUR', items: [{ id: 'c', itemId: 'desk', description: 'Desk', quantity: 1, rateCents: 20000, amountCents: 20000, accountId: 's' }] },
  { id: 'i3', number: 'INV-3', date: '2026-03-11', status: 'draft', customerName: 'Acme', items: [{ id: 'd', itemId: 'chair', description: 'Chair', quantity: 9, rateCents: 5000, amountCents: 45000, accountId: 's' }] },
  { id: 'i4', number: 'INV-4', date: '2025-12-31', status: 'sent', customerName: 'Acme', items: [{ id: 'e', itemId: 'chair', description: 'Chair', quantity: 1, rateCents: 5000, amountCents: 5000, accountId: 's' }] },
] as unknown as Invoice[];
const bills = [
  { id: 'b1', number: 'B-77', date: '2026-01-15', status: 'approved', vendorName: 'Supplier', dueDate: '', splits: [{ itemId: 'chair', quantity: 10, amountCents: 30000, accountId: 'inv' }, { itemId: 'chair', amountCents: 2000, accountId: 'inv', landedCost: true }] },
  { id: 'b2', number: 'B-78', date: '2026-01-20', status: 'void', vendorName: 'Supplier', dueDate: '', splits: [{ itemId: 'desk', quantity: 1, amountCents: 9000, accountId: 'inv' }] },
] as unknown as Bill[];

describe('Item-wise registers', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('sales: issued invoices\' item lines in the period, oldest first; one item; totals by currency', () => {
    const rows = salesRegister(invoices, nameOf, '2026-01-01', '2026-12-31');
    assert.deepEqual(rows.map(r => [r.number, r.party, r.itemName, r.quantity, r.unitCents, r.amountCents, r.currency]), [
      ['INV-1', 'Bolt', 'Desk', 1, 20000, 20000, 'EUR'],
      ['INV-2', 'Acme', 'Chair', 2, 5000, 10000, undefined],
    ]);
    assert.deepEqual(salesRegister(invoices, nameOf, '2026-01-01', '2026-12-31', 'chair').map(r => r.number), ['INV-2']);
    assert.deepEqual(registerTotals(rows, 'USD').map(t => [t.itemName, t.quantity, t.amounts]), [['Chair', 2, { USD: 10000 }], ['Desk', 1, { EUR: 20000 }]]);
  });

  test('purchases: bills\' item lines, the price per unit; landed costs and void bills left out', () => {
    assert.deepEqual(purchaseRegister(bills, nameOf, '2026-01-01', '2026-12-31').map(r => [r.number, r.itemName, r.quantity, r.unitCents, r.amountCents]), [['B-77', 'Chair', 10, 3000, 30000]]);
  });

  test('on screen: sold lines, then bought ones; a document opens', async () => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ inventory: items, invoices, bills } as never);
    markComponentCollectionsLoaded('inventory', 'invoices', 'bills');
    render(<ItemRegisterReportView />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    assert.match(screen.getByRole('rowheader', { name: 'Total Chair' }).parentElement!.textContent || '', /2\$100\.00/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^INV-2\s*: open it$/ })); });
    assert.deepEqual(useUIStore.getState().focusRecord, { type: 'invoice', id: 'i2' });
    fireEvent.change(screen.getByLabelText('Lines'), { target: { value: 'purchases' } });
    assert.ok(screen.getByRole('button', { name: /^B-77\s*: open it$/ }));
  });
});
