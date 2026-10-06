/**
 * "Same as last time" (I-23): a new invoice (bill) copies the lines of the customer's (vendor's)
 * latest one in one click; voided ones and other contacts are ignored; existing documents and
 * filled-in lines don't offer it.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import InvoiceModal from '../components/sales/InvoiceModal';
import BillModal from '../components/purchases/BillModal';
import { latestDocumentFor } from '../lib/repeatDocument';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import type { Bill, Invoice, Workspace } from '../types';
import { makeChartAccount, makeCustomer, makeVendor } from './fixtures';

const line = (id: string, description: string, cents: number) => ({ id, description, quantity: 1, rateCents: cents, amountCents: cents, accountId: 'rev' });
const invoices = [
  { id: 'i1', customerId: 'c1', number: 'INV-1', date: '2026-01-10', status: 'paid', amountCents: 100, items: [line('a', 'Old plan', 100)] },
  { id: 'i2', customerId: 'c1', number: 'INV-2', date: '2026-02-10', status: 'sent', amountCents: 300, items: [line('b', 'Support plan', 200), line('c', 'Hosting', 100)] },
  { id: 'i3', customerId: 'c1', number: 'INV-3', date: '2026-03-10', status: 'void', amountCents: 999, items: [line('d', 'Voided', 999)] },
  { id: 'i4', customerId: 'c2', number: 'INV-4', date: '2026-04-10', status: 'sent', amountCents: 50, items: [line('e', 'Other customer', 50)] },
] as unknown as Invoice[];

test('the latest for the contact, not voided, with lines', () => {
  assert.equal(latestDocumentFor(invoices, d => d.customerId === 'c1', d => d.items)?.id, 'i2');
  assert.equal(latestDocumentFor(invoices, d => d.customerId === 'c9', d => d.items), null);
});

describe('In the dialogs', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({ inventory: [], taxRates: [], invoices, transactions: [],
      bills: [{ id: 'b1', vendorId: 'v1', date: '2026-02-01', status: 'paid', amountCents: 9000, dueDate: '2026-02-15',
        splits: [{ accountId: 'exp', amountCents: 6000, description: 'Rent' }, { accountId: 'exp', amountCents: 3000, description: 'Service charge' }] } as Bill] });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('invoice: pick the customer, one click copies the latest invoice\'s lines', async () => {
    render(<InvoiceModal isOpen onClose={() => {}} onSave={() => {}} customers={[makeCustomer({ id: 'c1', name: 'Acme Ltd' })]} accounts={[makeChartAccount({ id: 'rev', name: 'Sales', type: 'income' })]} />);
    assert.equal(screen.queryByRole('button', { name: /Same as last time/ }), null, 'no customer yet');
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Acme Ltd' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Same as last time (INV-2, 2 lines)' })); });
    const descriptions = [0, 1].map(i => (document.getElementById(`inv-item-desc-${i}`) as HTMLInputElement).value);
    assert.deepEqual(descriptions, ['Support plan', 'Hosting']);
    assert.equal(screen.queryByRole('button', { name: /Same as last time/ }), null, 'gone once the lines are filled');
  });

  test('bill: pick the vendor, one click copies the latest bill\'s lines and amounts; an edited bill offers nothing', async () => {
    render(<BillModal isOpen onClose={() => {}} onSave={() => {}} vendors={[makeVendor({ id: 'v1', name: 'Landlord' })]} accounts={[makeChartAccount({ id: 'exp', name: 'Rent', type: 'expense' })]} />);
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Same as last bill (2 lines)' })); });
    const amounts = screen.getAllByLabelText(/^Amount \(/).map(el => (el as HTMLInputElement).value);
    assert.deepEqual(amounts, ['60', '30']);
    cleanup();
    render(<BillModal isOpen onClose={() => {}} onSave={() => {}} vendors={[makeVendor({ id: 'v1', name: 'Landlord' })]} accounts={[]}
      initialBill={{ id: 'b9', vendorId: 'v1', amountCents: 1, dueDate: '2026-03-01', status: 'pending' }} />);
    assert.equal(screen.queryByRole('button', { name: /Same as last bill/ }), null);
  });
});
