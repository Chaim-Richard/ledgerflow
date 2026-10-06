/**
 * The bill dialog (H-02): what it saves is what the vendor is owed. Amounts as on the vendor's
 * bill (tax included by default) or before tax; approval over the limit waits; an edited bill
 * keeps its number; nothing is saved without a vendor.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BillModal, { type BillDraft } from '../components/purchases/BillModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import type { Bill, Workspace } from '../types';
import { makeChartAccount, makeVendor } from './fixtures';

const vendors = [makeVendor({ id: 'v1', name: 'Paper Co' })];
const accounts = [makeChartAccount({ id: 'exp', name: 'Office supplies', type: 'expense' }), makeChartAccount({ id: 'exp2', name: 'Postage', type: 'expense' })];
let fetched: string[] = [];

function setup(initialBill?: Partial<Bill>) {
  const saved: BillDraft[] = [];
  render(<BillModal isOpen onClose={() => {}} onSave={b => { saved.push(b); }} vendors={vendors} accounts={accounts} initialBill={initialBill} />);
  return saved;
}
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const click = (text: string) => act(async () => { fireEvent.click(screen.getByText(text)); });

function fillTwoLines() {
  fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
  type(screen.getByLabelText('Description'), 'Paper');
  fireEvent.change(screen.getByLabelText('Expense Account'), { target: { value: 'exp' } });
  type(screen.getByLabelText(/^Amount \(/), '100');
  fireEvent.click(screen.getByLabelText('Add Split Expense'));
  fireEvent.change(screen.getAllByLabelText('Expense Account')[1], { target: { value: 'exp2' } });
  type(screen.getAllByLabelText(/^Amount \(/)[1], '50');
  fireEvent.change(screen.getByLabelText('Tax'), { target: { value: 'gst' } });
}

describe('Bill dialog', () => {
  beforeEach(() => {
    fetched = stubFetch(404);
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({
      bills: [], transactions: [],
      taxRates: [{ id: 'gst', uid: 'u', workspaceId: 'w1', name: 'GST', rate: 10, type: 'Sales', createdAt: '2026-01-01' }],
    });
  });
  // the Files panel (K-07) opens the database client: close it so the test process ends
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('amounts as on the vendor\'s bill (tax included): owed 150.00, of which tax 13.64', async () => {
    const saved = setup();
    fillTwoLines();
    await click('Save & Close');
    await waitFor(() => assert.equal(saved.length, 1));
    const bill = saved[0];
    assert.equal(bill.status, 'pending');
    assert.equal(bill.vendorId, 'v1');
    assert.equal(bill.amountCents, 15000);
    assert.equal(bill.lineSumCents, 15000);
    assert.equal(bill.taxAmountCents, 1364);
    assert.equal(bill.taxVersion, 2);
    assert.equal(bill.pricesIncludeTax, true);
    assert.deepEqual(bill.splits?.map(s => [s.accountId, s.amountCents]), [['exp', 10000], ['exp2', 5000]]);
  });

  test('Repeat (BE-08): the chosen frequency goes with the save; editing a bill offers no Repeat', async () => {
    const saved = setup();
    fillTwoLines();
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'monthly' } });
    await click('Save & Close');
    await waitFor(() => assert.equal(saved.length, 1));
    assert.equal(saved[0].recurringInterval, 'monthly');
    cleanup();
    setup({ id: 'b1', vendorId: 'v1', number: 'V-1', amountCents: 100, dueDate: '2026-02-01', status: 'pending' });
    assert.equal(screen.queryByLabelText('Repeat'), null);
  });

  test('amounts before tax: owed 165.00, tax 15.00', async () => {
    const saved = setup();
    fillTwoLines();
    fireEvent.click(screen.getByLabelText(/Amounts include tax/));
    await click('Save Draft');
    await waitFor(() => assert.equal(saved.length, 1));
    assert.equal(saved[0].status, 'draft');
    assert.equal(saved[0].amountCents, 16500);
    assert.equal(saved[0].taxAmountCents, 1500);
  });

  test('approving a bill over 5,000 leaves it pending; under, it is approved', async () => {
    let saved = setup();
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
    type(screen.getByLabelText(/^Amount \(/), '6000');
    await click('Approve Bill');
    await waitFor(() => assert.equal(saved.length, 1));
    assert.equal(saved[0].status, 'pending');
    cleanup();
    saved = setup();
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
    type(screen.getByLabelText(/^Amount \(/), '60');
    await click('Approve Bill');
    await waitFor(() => assert.equal(saved.length, 1));
    assert.equal(saved[0].status, 'approved');
  });

  test('an edited bill keeps its number (no new number is asked for); no vendor, no save', async () => {
    const saved = setup({ id: 'b1', number: 'A-100', vendorId: 'v1', vendorName: 'Paper Co', status: 'pending', date: '2026-09-01', dueDate: '2026-09-30', splits: [{ amountCents: 2500, accountId: 'exp', description: 'Ink' }] });
    await click('Save & Close');
    await waitFor(() => assert.equal(saved.length, 1));
    assert.equal(saved[0].id, 'b1');
    assert.equal(saved[0].number, 'A-100');
    assert.equal(saved[0].amountCents, 2500);
    assert.equal(fetched.filter(u => u.includes('next-number')).length, 0);
    cleanup();
    const none = setup();
    await click('Save & Close');
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(none.length, 0);
  });
});
