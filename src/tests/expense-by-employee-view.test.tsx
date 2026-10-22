/**
 * A-191 screen: expense by employee. In guest mode the attachment index is unavailable, so the
 * claim without a receipt URL is not-checked rather than missing (lib test works the verdicts).
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import ExpenseByEmployeeReportView from '../components/reporting/ExpenseByEmployeeReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

describe('Expense by employee screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({
      isGuest: true, user: null, currentWorkspaceId: 'w1',
      workspaces: [{ id: 'w1', name: 'W', currency: 'ILS' }],
    } as never);
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      bills: [
        { id: 'b1', number: 'B-1', vendorId: 'v1', vendorName: 'Noa Levi', date: '2026-09-05', currency: 'ILS', amountCents: 12_000, amountPaidCents: 0, status: 'draft', receiptUrl: 'https://example.test/r/1', workspaceId: 'w1',
          metadata: { expenseClaim: { state: 'approved', submittedByName: 'Noa Levi' } } },
        { id: 'b2', number: 'B-2', vendorId: 'v1', vendorName: 'Noa Levi', date: '2026-09-07', currency: 'ILS', amountCents: 3_500, amountPaidCents: 0, status: 'draft', workspaceId: 'w1',
          metadata: { expenseClaim: { state: 'submitted', submittedByName: 'Noa Levi' } } },
      ],
      truncatedCollections: {},
    } as never);
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('one row for the employee: two claims, their ILS total, and both claims behind it', () => {
    render(<ExpenseByEmployeeReportView />);
    const row = screen.getAllByRole('rowheader', { name: 'Noa Levi' })[0].parentElement!;
    assert.match(row.textContent || '', /155\.00/, '₪120 + ₪35 in minor units, ILS only');
    assert.ok(screen.getByText('Receipt URL recorded; link not verified'));
    assert.ok(screen.getByText('Not checked', { selector: 'td' }), 'without the attachment index nothing is called missing');
  });
});
