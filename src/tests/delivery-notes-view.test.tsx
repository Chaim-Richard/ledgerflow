/**
 * A-46 / A-172 on screen: Printable delivery notes from sales orders and invoices in English (LTR)
 * and Hebrew (RTL), numbered in the DN-YYYY-NNN series, with prices hidden by default and an
 * option to show them.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeliveryNotesReportView from '../components/reporting/DeliveryNotesReportView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import type { Customer, Estimate, InventoryItem } from '../types';

const customer: Customer = {
  id: 'cust-1',
  uid: 'u1',
  workspaceId: 'component-workspace',
  name: 'קפה הכרמל בע"מ',
  address: 'רחוב הנמל 12, חיפה',
  currency: 'ILS',
};

const item: InventoryItem = {
  id: 'item-1',
  uid: 'u1',
  workspaceId: 'component-workspace',
  name: 'פולי קפה קלויים',
  sku: 'BEAN-500',
  measurementUnit: 'kg',
  unitPriceCents: 8500,
  unitCostCents: 4000,
  quantityAtHand: 40,
  reorderPoint: 10,
  createdAt: '2026-01-01',
};

const order: Estimate = {
  id: 'est-1',
  uid: 'u1',
  workspaceId: 'component-workspace',
  number: 'SO-2026-014',
  customerId: 'cust-1',
  customerName: 'קפה הכרמל בע"מ',
  date: '2026-10-10',
  expiryDate: '2026-11-10',
  status: 'accepted',
  amountCents: 42500,
  createdAt: '2026-10-10',
  lines: [
    { description: 'פולי קפה קלויים', quantity: 5, unitPriceCents: 8500, amountCents: 42500, itemId: 'item-1' },
  ],
};

describe('Delivery notes screen (A-46 / A-172)', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('estimates', 'invoices', 'inventory', 'customers');
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      estimates: [order],
      invoices: [],
      inventory: [item],
      customers: [customer],
      transactions: [],
      truncatedCollections: {},
    });
  });

  afterEach(() => cleanup());

  test('renders a delivery note in English (LTR) with no prices by default, and shows prices when toggled', async () => {
    render(<DeliveryNotesReportView />);
    const card = screen.getByRole('article', { name: 'Printable delivery note' });
    assert.equal(card.getAttribute('dir'), 'ltr');
    assert.match(card.textContent || '', /Delivery note/);
    assert.match(card.textContent || '', /DN-2026-001/);
    assert.match(card.textContent || '', /SO-2026-014/);
    assert.match(card.textContent || '', /Goods only; prices are on the invoice\./);
    assert.doesNotMatch(card.textContent || '', /425\.00/);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Show prices on delivery note'));
    });
    assert.match(card.textContent || '', /425\.00/);
  });

  test('switches the delivery note to Hebrew (RTL) with Hebrew labels', async () => {
    render(<DeliveryNotesReportView />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Delivery note language'), { target: { value: 'he' } });
    });
    const card = screen.getByRole('article', { name: 'Printable delivery note' });
    assert.equal(card.getAttribute('dir'), 'rtl');
    assert.match(card.textContent || '', /תעודת משלוח/);
    assert.match(card.textContent || '', /הזמנה/);
    assert.match(card.textContent || '', /סחורה בלבד; המחירים מופיעים בחשבונית\./);
    assert.match(card.textContent || '', /התקבל על ידי/);
  });
});
