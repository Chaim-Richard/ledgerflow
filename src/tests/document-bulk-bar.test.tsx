/** Selecting documents in a list and downloading their PDFs in one zip (K-06 Y-18). */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentBulkBar from '../components/ui/DocumentBulkBar';
import { setComponentWorkspace } from './helpers/componentFixtures';

afterEach(() => cleanup());

test('nothing selected: no bar; selected: one request for all of them; clear', async () => {
  setComponentWorkspace();
  const calls = stubFetchWithBodies(200, {});
  URL.createObjectURL = () => 'blob:zip';
  URL.revokeObjectURL = () => {};
  const { rerender } = render(<DocumentBulkBar type="invoice" noun="invoice" ids={[]} workspaceId="w1" onClear={() => {}} />);
  assert.equal(screen.queryByRole('toolbar'), null);
  let cleared = 0;
  rerender(<DocumentBulkBar type="invoice" noun="invoice" ids={['i1', 'i2']} workspaceId="w1" onClear={() => { cleared++; }} />);
  assert.ok(screen.getByText('2 invoices selected'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Download PDFs/ })); });
  await waitFor(() => assert.equal(calls.length, 1));
  assert.equal(calls[0].url, '/api/v1/documents/zip');
  assert.deepEqual(calls[0].body, { workspaceId: 'w1', type: 'invoice', ids: ['i1', 'i2'] });
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  assert.equal(cleared, 1);
});

test('invoices: email them and record payment (not for viewers); bills: pay them', async () => {
  setComponentWorkspace('bookkeeper');
  const calls = stubFetchWithBodies(200, { status: 'success', to: 'ap@acme.test' });
  const docs = [
    { id: 'i1', number: 'INV-1', status: 'sent', customerId: 'c1', customerName: 'Acme', amountCents: 1000 },
    { id: 'i2', number: 'INV-2', status: 'draft', customerId: 'c1', customerName: 'Acme', amountCents: 500 },
  ];
  render(<DocumentBulkBar type="invoice" noun="invoice" ids={['i1', 'i2']} documents={docs} workspaceId="w1" onClear={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Email to customers' })); });
  await waitFor(() => assert.equal(calls.length, 1));
  assert.equal(calls[0].url, '/api/v1/workspaces/w1/emails/invoices/i1', 'the draft is not emailed');
  fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
  assert.ok(screen.getByRole('dialog', { name: 'Receive payment for 2 invoices' }));
  cleanup();
  setComponentWorkspace('viewer');
  render(<DocumentBulkBar type="invoice" noun="invoice" ids={['i1']} documents={docs.slice(0, 1)} workspaceId="w1" onClear={() => {}} />);
  assert.equal(screen.queryByRole('button', { name: 'Record payment' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Email to customers' }), null);
  assert.ok(screen.getByRole('button', { name: /Download PDFs/ }), 'viewers can still download');
  cleanup();
  setComponentWorkspace('owner');
  render(<DocumentBulkBar type="bill" noun="bill" ids={['b1']} documents={[{ id: 'b1', status: 'open', vendorId: 'v1', amountCents: 300 }]} workspaceId="w1" onClear={() => {}} />);
  assert.equal(screen.queryByRole('button', { name: 'Email to customers' }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Pay bills' }));
  assert.ok(screen.getByRole('dialog', { name: 'Pay 1 bill' }));
});
