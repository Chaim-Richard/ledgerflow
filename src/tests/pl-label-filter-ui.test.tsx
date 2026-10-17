/**
 * AU-2: the P&L can be narrowed to one label (location, class, project, department). Only the
 * lines that carry the label count; the server's figures, which know no label, are not used then.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import ProfitAndLossView from '../components/ledger/ProfitAndLossView';
import { getSupabase } from '../lib/db/client';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount, makeTransaction } from './fixtures';

const chart = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' }),
  makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', category: 'Operating' }),
];
/** Tel Aviv sells 300.00 and pays 100.00 rent; Haifa sells 200.00. */
const ledger = [
  makeTransaction({ id: 't1', date: '2026-03-02', status: 'completed', posted: true,
    lines: [{ accountId: 'cash', amountCents: 30000, dimensions: { location: 'Tel Aviv' } }, { accountId: 'sales', amountCents: -30000, dimensions: { location: 'Tel Aviv' } }] }),
  makeTransaction({ id: 't2', date: '2026-03-03', status: 'completed', posted: true,
    lines: [{ accountId: 'cash', amountCents: 20000, dimensions: { location: 'Haifa' } }, { accountId: 'sales', amountCents: -20000, dimensions: { location: 'Haifa' } }] }),
  makeTransaction({ id: 't3', date: '2026-03-04', status: 'completed', posted: true,
    lines: [{ accountId: 'rent', amountCents: 10000, dimensions: { location: 'Tel Aviv' } }, { accountId: 'cash', amountCents: -10000, dimensions: { location: 'Tel Aviv' } }] }),
];

beforeEach(() => {
  stubFetch(404);
  useAuthStore.setState({ user: null, currentWorkspaceId: null, workspaces: [] });
  useLedgerStore.setState({ transactions: ledger, accounts: chart, journalEntries: [], isDataTruncated: false });
});
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

const has = (view: ReturnType<typeof render>, text: string) => view.queryAllByText(text).length > 0;

test('all lines count until a label is chosen; then only that label\'s lines do', async () => {
  const view = render(<ProfitAndLossView startDate="2026-03-01" endDate="2026-03-31" />);
  await waitFor(() => assert.ok(has(view, '$500.00'), 'income 300.00 + 200.00'));
  fireEvent.change(view.getByLabelText('Label kind'), { target: { value: 'location' } });
  fireEvent.change(view.getByLabelText('Label value'), { target: { value: 'tel aviv' } });
  await waitFor(() => assert.ok(has(view, '$300.00'), 'Tel Aviv income only'));
  assert.ok(!has(view, '$500.00'), 'Haifa is left out');
  assert.ok(has(view, '$200.00'), 'net profit 300.00 - 100.00');
  fireEvent.change(view.getByLabelText('Label value'), { target: { value: 'Haifa' } });
  await waitFor(() => assert.ok(!has(view, '$100.00'), 'Haifa paid no rent'));
  fireEvent.change(view.getByLabelText('Label kind'), { target: { value: '' } });
  await waitFor(() => assert.ok(has(view, '$500.00'), 'back to everything'));
});
