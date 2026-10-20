import { inlineEditName } from './helpers/inlineEditName';
/**
 * A-62 screen: blanket purchase orders. Hand-checked from the orders and bills given to the
 * panel: the marked agreement shows what is left and how it was drawn, the unlinked bill never
 * counts, the mark form refuses a missing date, the validity is editable in place, and a guest
 * reads everything but cannot mark or edit.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BlanketOrdersPanel } from '../components/reporting/BlanketOrdersReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const orders = [
  {
    id: 'po1', poNumber: 'PO-1', vendorName: 'Acme Ltd', issueDate: '2026-01-05', status: 'approved',
    workspaceId: 'w1', totalAmountCents: 1_000_000, currency: 'USD',
    blanket: { validUntil: '2026-11-14' },
    receipts: [{ id: 'r1', items: [{ poItemId: 'li1', description: 'Widgets', quantityReceived: 10, unitPriceCents: 5_000, condition: 'good' }] }],
  },
  { id: 'po2', poNumber: 'PO-2', vendorName: 'Beta GmbH', issueDate: '2026-02-01', status: 'approved', workspaceId: 'w1', totalAmountCents: 200_000, currency: 'USD', receipts: [] },
];

const bills = [
  { id: 'b1', workspaceId: 'w1', vendorId: 'v1', amountCents: 70_000, currency: 'USD', status: 'approved', metadata: { poNumber: 'PO-1' } },
  { id: 'b2', workspaceId: 'w1', vendorId: 'v1', amountCents: 50_000, currency: 'USD', status: 'approved', metadata: {} },
];

describe('Blanket purchase orders screen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isGuest: false, user: { uid: 'u1', email: 'lee@shop.test' } as never,
      currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', uid: 'u1', name: 'W', currency: 'USD' }] as never,
    });
    useDataNeedsStore.setState({ loaded: { bills: true } as never, failed: {} as never });
    useLedgerStore.setState({ bills: bills as never, truncatedCollections: {} as never });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the marked agreement shows what is drawn and what is left, with the unlinked bill left out', () => {
    render(<BlanketOrdersPanel orders={orders as never} today="2026-10-15" />);
    const table = screen.getByRole('table', { name: /Blanket purchase orders with/ });
    const rows = within(table).getAllByRole('row').slice(1);
    assert.equal(rows.length, 1);
    const text = rows[0].textContent || '';
    assert.match(text, /PO-1/);
    assert.match(text, /500\.00/, '10 good units × 5.00 received');
    assert.match(text, /700\.00/, 'the linked USD bill');
    assert.match(text, /9,300\.00/, 'what is left of the 10,000.00 order total');
    assert.match(text, /Expiring \(30 days\)/);
    assert.match(text, /higher of the two/);
    assert.ok(!text.includes('1,200.00'), 'the unlinked bill never draws the agreement');
  });

  test('the mark form refuses a missing date, and the validity is editable in place', async () => {
    render(<BlanketOrdersPanel orders={orders as never} today="2026-10-15" />);
    const editable = screen.getByLabelText(inlineEditName('Edit Last valid day of PO-1'));
    assert.equal(editable.tagName, 'BUTTON', 'the validity is edited in place');
    const mark = screen.getByRole('button', { name: /Mark as blanket order PO-2/ });
    fireEvent.click(mark);
    const alert = await screen.findByRole('alert');
    assert.match(alert.textContent || '', /last valid day/);
  });

  test('a guest reads the agreements and the orders to mark, but cannot change them', () => {
    useAuthStore.setState({ isGuest: true, user: null, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' }] } as never);
    render(<BlanketOrdersPanel orders={orders as never} today="2026-10-15" />);
    assert.ok((screen.getByRole('button', { name: /Mark as blanket order PO-2/ }) as HTMLButtonElement).disabled);
    assert.ok(screen.getByText(/reads the agreements but cannot mark/));
    assert.equal(screen.queryByRole('button', { name: /Unmark/ }), null, 'no unmark for a guest');
  });
});
