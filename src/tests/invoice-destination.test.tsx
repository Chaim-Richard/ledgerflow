/**
 * #255 review, finding 2 (AI #1, 20 Oct): an issued invoice keeps where the sale went — the customer's tax place on
 * the day it was issued — in `metadata.taxPlace`, so moving the customer later does not move the sale between states.
 * Worked figures: a $300,000 Texas sale (30,000,000 cents) issued while the customer is in Austin, TX; the customer
 * then moves to Tulsa, OK. The nexus watch still counts 30,000,000 in Texas and nothing in Oklahoma. An invoice saved
 * before the snapshot existed is still placed by the customer's place now (Oklahoma), as the screen says.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvoiceModal from '../components/sales/InvoiceModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { saleDestinationSnapshot } from '../lib/tax/usInvoiceTax';
import { usNexusWatch, type NexusSaleDocument } from '../lib/tax/usNexusWatch';
import type { Invoice, Workspace } from '../types';
import { makeChartAccount, makeCustomer } from './fixtures';

const TX = { country: 'US', state: 'TX', city: 'Austin' };
const OK = { country: 'US', state: 'OK', city: 'Tulsa' };

test('the snapshot: taken when issued, kept for the same customer, none for a draft, cleared for another customer with no place', () => {
  const customers = [{ id: 'c1', metadata: { taxPlace: TX } }, { id: 'c2', metadata: {} }, { id: 'c3', metadata: { taxPlace: OK } }];
  assert.deepEqual(saleDestinationSnapshot({ status: 'pending', customerId: 'c1', customers }), { taxPlace: TX });
  assert.deepEqual(saleDestinationSnapshot({ status: 'draft', customerId: 'c1', customers }), {}, 'a draft is not a sale yet');
  // issued in Texas; the customer has moved to Oklahoma since: the invoice keeps Texas
  const moved = [{ id: 'c1', metadata: { taxPlace: OK } }];
  assert.deepEqual(saleDestinationSnapshot({ status: 'sent', customerId: 'c1', initial: { customerId: 'c1', metadata: { taxPlace: TX } }, customers: moved }), { taxPlace: TX });
  // the invoice is moved to another customer: that customer's place, or none
  assert.deepEqual(saleDestinationSnapshot({ status: 'sent', customerId: 'c3', initial: { customerId: 'c1', metadata: { taxPlace: TX } }, customers }), { taxPlace: OK });
  assert.deepEqual(saleDestinationSnapshot({ status: 'sent', customerId: 'c2', initial: { customerId: 'c1', metadata: { taxPlace: TX } }, customers }), { taxPlace: null });
  assert.deepEqual(saleDestinationSnapshot({ status: 'sent', customerId: 'c2', customers }), {}, 'no place, nothing to keep');
});

test('worked figures: the customer moves to Oklahoma; the $300,000 sale stays in Texas', () => {
  const sale = (id: string, extra: Partial<NexusSaleDocument> = {}): NexusSaleDocument =>
    ({ id, customerId: 'c1', date: '2026-05-01', status: 'sent', taxVersion: 2, amountCents: 30_000_000, taxAmountCents: 0, ...extra });
  const now = [{ id: 'c1', metadata: { taxPlace: OK } }];
  const kept = usNexusWatch({ asOf: '2026-10-20', invoices: [sale('s1', { metadata: { taxPlace: TX } })], customers: now });
  assert.deepEqual(kept.states.map(s => [s.state, s.thisYear!.salesCents]), [['TX', 30_000_000]]);
  // an invoice saved before the snapshot existed is placed by the customer's place now
  const older = usNexusWatch({ asOf: '2026-10-20', invoices: [sale('s0')], customers: now });
  assert.deepEqual(older.states.map(s => [s.state, s.thisYear!.salesCents]), [['OK', 30_000_000]]);
  // a cleared snapshot (null) falls back to the customer's place as well
  const cleared = usNexusWatch({ asOf: '2026-10-20', invoices: [sale('s2', { metadata: { taxPlace: null } })], customers: now });
  assert.deepEqual(cleared.states.map(s => s.state), ['OK']);
});

describe('the invoice dialog saves the destination when the invoice is issued', () => {
  const accounts = [makeChartAccount({ id: 'rev', name: 'Sales', type: 'income' })];
  const setup = (customerPlace: typeof TX, initialInvoice?: Partial<Invoice>) => {
    const saved: Partial<Invoice>[] = [];
    const customers = [makeCustomer({ id: 'c1', name: 'Acme Ltd', metadata: { taxPlace: customerPlace } } as never)];
    render(<InvoiceModal isOpen onClose={() => {}} onSave={inv => { saved.push(inv); }} customers={customers} accounts={accounts} initialInvoice={initialInvoice} />);
    return saved;
  };
  const fill = () => {
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Acme Ltd' } });
    fireEvent.change(screen.getByLabelText('Item / Description'), { target: { value: 'Design' } });
    fireEvent.change(screen.getByLabelText(/^Rate/), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Income Account'), { target: { value: 'Sales' } });
  };
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({ inventory: [], taxRates: [] });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('Save & Close (issued): the customer\'s Texas place is kept on the invoice', async () => {
    const saved = setup(TX);
    fill();
    await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
    await waitFor(() => assert.equal(saved.length, 1));
    assert.deepEqual((saved[0].metadata as { taxPlace?: unknown }).taxPlace, TX);
  });

  test('Save Draft: no place is kept yet', async () => {
    const saved = setup(TX);
    fill();
    await act(async () => { fireEvent.click(screen.getByText('Save Draft')); });
    await waitFor(() => assert.equal(saved.length, 1));
    assert.equal((saved[0].metadata as { taxPlace?: unknown }).taxPlace, undefined);
  });

  test('editing an invoice issued in Texas after the customer moved to Oklahoma keeps Texas', async () => {
    const saved = setup(OK, {
      id: 'inv-1', number: 'INV-1', customerId: 'c1', status: 'sent', date: '2026-05-01', currency: 'USD', metadata: { taxPlace: TX },
      items: [{ id: 'l1', description: 'Design', quantity: 1, rateCents: 15_000, amountCents: 15_000, accountId: 'rev' }],
    });
    await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
    await waitFor(() => assert.equal(saved.length, 1));
    assert.deepEqual((saved[0].metadata as { taxPlace?: unknown }).taxPlace, TX);
  });
});
