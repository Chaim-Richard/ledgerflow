/**
 * The read counter (C-17): rows and reads per table, the most first; started again on request; and
 * shown in Settings → Developer only with the developer switch on, updating as reads happen.
 */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readCounts, recordRead, resetReadCounts } from '../lib/db/readCounter';
import ReadCounterPanel from '../components/platform/settings/ReadCounterPanel';

afterEach(() => { cleanup(); resetReadCounts(); });

test('rows and reads per table, the most rows first; started again', () => {
  resetReadCounts();
  recordRead('invoices', 40);
  recordRead('transactions', 500);
  recordRead('invoices', 2);
  assert.deepEqual(readCounts(), [{ table: 'transactions', rows: 500, reads: 1 }, { table: 'invoices', rows: 42, reads: 2 }]);
  resetReadCounts();
  assert.deepEqual(readCounts(), []);
});

test('the panel shows the counts and follows new reads', () => {
  resetReadCounts();
  recordRead('bills', 7);
  render(<ReadCounterPanel />);
  assert.match(screen.getByRole('rowheader', { name: 'bills' }).parentElement!.textContent || '', /71/);
  act(() => { recordRead('bills', 3); });
  assert.match(screen.getByRole('rowheader', { name: 'bills' }).parentElement!.textContent || '', /102/);
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
  assert.match(document.body.textContent || '', /0 rows in all/);
});
