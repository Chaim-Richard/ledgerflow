/** Settings → Document numbering (BA-07): the series, a live preview, saving one series. */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NumberingSettings from '../components/platform/settings/NumberingSettings';
import { previewNumber } from '../lib/documentNumbers';
import { setComponentWorkspace } from './helpers/componentFixtures';

const series = [
  { type: 'invoice', prefix: 'INV-2026-', nextNumber: 10, padding: 4, next: 'INV-2026-0010', highestUsed: 9 },
  { type: 'bill', prefix: 'BIL-2026-', nextNumber: 1, padding: 4, next: 'BIL-2026-0001', highestUsed: 0 },
  { type: 'estimate', prefix: 'EST-2026-', nextNumber: 1, padding: 4, next: 'EST-2026-0001', highestUsed: 0 },
];

beforeEach(() => setComponentWorkspace('owner'));
afterEach(() => cleanup());

test('preview follows what is typed', () => {
  assert.equal(previewNumber('F/', 7, 3), 'F/007');
  assert.equal(previewNumber('X', Number.NaN, 0), 'X1');
});

test('shows each series and saves a new prefix for invoices', async () => {
  const calls = stubFetchWithBodies(200, { status: 'success', series });
  render(<NumberingSettings />);
  await waitFor(() => assert.ok(screen.getByText('Invoices')));
  assert.equal(screen.getByTestId('next-invoice').textContent, 'INV-2026-0010');
  assert.match(document.body.textContent || '', /highest used with this prefix: 9/);
  const [prefix] = screen.getAllByLabelText('Prefix');
  const [next] = screen.getAllByLabelText('Next number');
  const [digits] = screen.getAllByLabelText('Digits');
  fireEvent.change(prefix, { target: { value: 'F2027/' } });
  fireEvent.change(next, { target: { value: '1' } });
  fireEvent.change(digits, { target: { value: '3' } });
  assert.equal(screen.getByTestId('next-invoice').textContent, 'F2027/001');
  const saveCalls = stubFetchWithBodies(200, { status: 'success', series: { ...series[0], prefix: 'F2027/', nextNumber: 1, padding: 3, next: 'F2027/001', highestUsed: 0 } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save invoices' })); });
  await waitFor(() => assert.equal(saveCalls.length, 1));
  assert.equal(calls[0].url, '/api/v1/workspaces/component-workspace/numbering/');
  assert.equal(saveCalls[0].url, '/api/v1/workspaces/component-workspace/numbering/invoice');
  assert.equal(saveCalls[0].method, 'PUT');
  assert.deepEqual(saveCalls[0].body, { prefix: 'F2027/', nextNumber: 1, padding: 3 });
});

test('a bookkeeper sees why they cannot change numbering; nothing is loaded', () => {
  setComponentWorkspace('bookkeeper');
  const calls = stubFetchWithBodies(200, { series });
  render(<NumberingSettings />);
  assert.ok(screen.getByText('Only owners and accountants change document numbers.'));
  assert.equal(calls.length, 0);
});
