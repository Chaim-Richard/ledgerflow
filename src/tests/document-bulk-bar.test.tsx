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
