import { stubFetch } from './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import Reconciliation from '../components/ledger/Reconciliation';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

afterEach(cleanup);

test('reconciliation retains search while switching between empty streams and matched history', () => {
  stubFetch(404);
  useAuthStore.setState({ user: null, currentWorkspaceId: null, workspaces: [] });
  useLedgerStore.setState({ transactions: [], accounts: [], bankLines: [], autoRules: [] });
  const view = render(<Reconciliation />);
  assert.ok(view.getByText('Zero Pending Streams'));
  const search = view.getByRole('textbox', { name: 'Search reconciliation amounts or descriptions' });
  fireEvent.change(search, { target: { value: 'קבלה receipt' } });
  fireEvent.click(view.getByRole('button', { name: 'Matched History (0)' }));
  assert.ok(view.getByText('No cleared alignment history found'));
  assert.equal((search as HTMLInputElement).value, 'קבלה receipt');
  fireEvent.click(view.getByRole('button', { name: 'Streams (0)' }));
  assert.ok(view.getByText('Zero Pending Streams'));
});
