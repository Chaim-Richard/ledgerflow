/**
 * A-63 / A-170 + A-79 / A-171 on screen: Landed cost preview on receipts and barcode scanning
 * onto receipt lines. Spreads freight/duty by value or quantity to the exact cent, scans item
 * barcodes to add receipt lines, refuses unknown/duplicate SKUs, and posts nothing.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import LandedCostPreviewReportView from '../components/reporting/LandedCostPreviewReportView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import type { Bill, InventoryItem, Vendor } from '../types';

const items: InventoryItem[] = [
  {
    id: 'item-a', uid: 'u1', workspaceId: 'component-workspace', name: 'Espresso Grinder', sku: 'GRIND-01',
    unitPriceCents: 30000, unitCostCents: 10000, quantityAtHand: 5, reorderPoint: 2, createdAt: '2026-01-01',
  },
  {
    id: 'item-b', uid: 'u1', workspaceId: 'component-workspace', name: 'Tamper Base', sku: 'TAMP-02',
    unitPriceCents: 5000, unitCostCents: 2000, quantityAtHand: 10, reorderPoint: 3, createdAt: '2026-01-01',
  },
];

const vendors: Vendor[] = [
  { id: 'v-1', uid: 'u1', workspaceId: 'component-workspace', name: 'Milan Roasters', category: 'Equipment', email: 'milan@example.test' },
];

const receiptBill: Bill = {
  id: 'bill-rec-1',
  uid: 'u1',
  workspaceId: 'component-workspace',
  number: 'REC-2026-001',
  vendorId: 'v-1',
  vendorName: 'Milan Roasters',
  date: '2026-10-05',
  dueDate: '2026-11-05',
  status: 'approved',
  currency: 'USD',
  amountCents: 14000,
  splits: [
    { accountId: 'inv', description: 'Espresso Grinder', itemId: 'item-a', quantity: 1, amountCents: 10000 },
    { accountId: 'inv', description: 'Tamper Base', itemId: 'item-b', quantity: 2, amountCents: 4000 },
  ],
};

describe('Landed cost preview on receipts screen (A-63 / A-170 + A-79 / A-171)', () => {
  let fetches: string[] = [];

  beforeEach(() => {
    fetches = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetches.push(String(input));
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('bills', 'inventory', 'vendors');
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      bills: [receiptBill],
      inventory: items,
      vendors,
      truncatedCollections: {},
    });
  });

  afterEach(() => cleanup());

  test('spreads freight and duty across a purchase receipt by value and by quantity without posting', async () => {
    render(<LandedCostPreviewReportView />);
    const freightInput = screen.getByLabelText('Freight, duty and handling');
    await act(async () => {
      fireEvent.change(freightInput, { target: { value: '30.00' } });
    });

    // Goods value = $100.00 + $40.00 = $140.00; extra = $30.00; landed total = $170.00
    assert.match(document.body.textContent || '', /Goods value:\s*\$140\.00/);
    assert.match(document.body.textContent || '', /Landed total:\s*\$170\.00/);

    // Switch basis to quantity (1 grinder + 2 tampers = 3 units -> $10.00 extra per unit)
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Spread basis'), { target: { value: 'quantity' } });
    });
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    assert.equal(rows.length, 2);
    // Grinder: 1 unit, $100.00 + $10.00 allocated = $110.00 ($110.00/unit)
    assert.match(rows[0].textContent || '', /Espresso Grinder/);
    assert.match(rows[0].textContent || '', /\$10\.00/);
    assert.match(rows[0].textContent || '', /\$110\.00/);
    // Tamper: 2 units, $40.00 + $20.00 allocated = $60.00 ($30.00/unit)
    assert.match(rows[1].textContent || '', /Tamper Base/);
    assert.match(rows[1].textContent || '', /\$20\.00/);
    assert.match(rows[1].textContent || '', /\$30\.00/);
    assert.equal(fetches.length, 0, 'preview only — no request is sent');
  });

  test('scans an item barcode onto a draft receipt and refuses unknown barcodes', async () => {
    render(<LandedCostPreviewReportView />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Receipt source'), { target: { value: '__custom__' } });
    });
    const scanInput = screen.getByLabelText('Scan barcode for receipt');
    await act(async () => {
      fireEvent.change(scanInput, { target: { value: 'UNKNOWN-99' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add scanned item' }));
    });
    assert.match(document.body.textContent || '', /No item in this workspace has barcode “UNKNOWN-99”/);

    await act(async () => {
      fireEvent.change(scanInput, { target: { value: 'GRIND-01' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add scanned item' }));
    });
    assert.match(document.body.textContent || '', /Added 1 × Espresso Grinder \(GRIND-01\)/);
    assert.match(within(screen.getByRole('table')).getAllByRole('row')[1].textContent || '', /Espresso Grinder/);
  });
});
