/**
 * Deposits from estimates on the screen (BE-05): "Deposit" on an open estimate records a payment linked
 * to it (applied to nothing); the estimate shows what was received; the issued invoice made from it
 * offers "Apply deposit", which applies the waiting deposits up to what is due.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import EstimateDepositDialog from '../components/sales/EstimateDepositDialog';
import EstimatesView from '../components/sales/EstimatesView';
import Sales from '../components/sales/Sales';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount } from './fixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import type { Estimate, Invoice } from '../types';

const accounts = [
  makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'dep', code: '2300', name: 'Customer Deposits', type: 'liability', category: 'Current Liabilities' }),
];
const estimate = { id: 'e1', uid: 'u', workspaceId: 'component-workspace', customerId: 'c1', customerName: 'Acme', number: 'E-1', amountCents: 100000, date: '2026-09-01', status: 'accepted', lines: [], createdAt: '' } as Estimate;
const deposit = { id: 'p1', direction: 'received', contactId: 'c1', customerId: 'c1', estimateId: 'e1', amountCents: 30000, unappliedCents: 30000, status: 'posted', date: '2026-09-02', currency: 'USD' };

describe('The deposit dialog', () => {
  beforeEach(() => {
    setComponentWorkspace('bookkeeper');
    useLedgerStore.setState({ accounts });
  });
  afterEach(() => cleanup());

  test('half by default, quick shares, says where it waits, and sends one linked payment', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success', data: { paymentId: 'p' } });
    let closed = 0;
    render(<EstimateDepositDialog estimate={estimate} onClose={() => closed++} />);
    assert.equal((screen.getByLabelText('Deposit (USD)') as HTMLInputElement).value, '500.00');
    assert.match(document.body.textContent || '', /It waits in Customer Deposits until the invoice is issued/);
    fireEvent.click(screen.getByRole('button', { name: '25%' }));
    assert.equal((screen.getByLabelText('Deposit (USD)') as HTMLInputElement).value, '250.00');
    fireEvent.change(screen.getByLabelText('Deposit (USD)'), { target: { value: '1000.01' } });
    assert.equal(screen.getByRole('alert').textContent, 'That is more than the estimate');
    fireEvent.change(screen.getByLabelText('Deposit (USD)'), { target: { value: '300' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record $300.00 deposit' })); });
    const sent = calls.filter(c => c.url === '/api/v1/payments');
    assert.equal(sent.length, 1);
    const body = sent[0].body as Record<string, unknown>;
    assert.deepEqual([body.customerId, body.estimateId, body.amountCents, body.cashAccountId, body.allocations], ['c1', 'e1', 30000, 'bank', []]);
    assert.equal(closed, 1);
  });
});

describe('Estimates and the invoice made from one', () => {
  beforeEach(() => {
    markComponentCollectionsLoaded('estimates', 'customers', 'payments', 'invoices', 'creditNotes');
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the estimate shows the deposit received and offers Deposit while open', () => {
    setComponentWorkspace('owner');
    stubFetchWithBodies(200, []);
    useLedgerStore.setState({ accounts, estimates: [estimate, { ...estimate, id: 'e2', number: 'E-2', status: 'converted' }] as never, payments: [deposit] as never, customers: [] as never });
    render(<EstimatesView />);
    assert.match(document.body.textContent || '', /Deposit received \$300\.00/);
    assert.ok(screen.getByRole('button', { name: 'Take a deposit for estimate E-1' }));
    assert.equal(screen.queryByRole('button', { name: 'Take a deposit for estimate E-2' }), null, 'not on a converted one');
  });

  test('the issued invoice applies the waiting deposit up to what is due; a draft does not offer it', async () => {
    setComponentWorkspace('owner');
    const calls = stubFetchWithBodies(200, { status: 'success', data: {} });
    const invoice = { id: 'i1', uid: 'u', workspaceId: 'component-workspace', customerId: 'c1', customerName: 'Acme', number: 'INV-1', amountCents: 20000, status: 'sent', date: '2026-09-20', dueDate: '2026-10-20', currency: 'USD', metadata: { convertedFromEstimateId: 'e1' } } as Invoice;
    useLedgerStore.setState({ accounts, invoices: [invoice, { ...invoice, id: 'i2', number: 'INV-2', status: 'draft' }], payments: [deposit] as never, customers: [{ id: 'c1', name: 'Acme' }] as never });
    render(<Sales />);
    assert.equal(screen.queryByRole('button', { name: "Apply the estimate's deposit to invoice INV-2" }), null);
    const button = screen.getByRole('button', { name: "Apply the estimate's deposit to invoice INV-1" });
    assert.equal(button.textContent, 'Apply deposit $200.00', 'only what the invoice still owes');
    await act(async () => { fireEvent.click(button); });
    const applied = calls.filter(c => c.url.includes('/apply'));
    assert.deepEqual(applied.map(c => c.url), ['/api/v1/payments/p1/apply']);
    assert.deepEqual((applied[0].body as { allocations: unknown[] }).allocations, [{ documentId: 'i1', documentType: 'invoice', amountCents: 20000 }]);
  });
});
