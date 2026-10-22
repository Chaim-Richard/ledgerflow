/**
 * A-187 screen: aged receivables by sales rep. Dana's customer owes $1,200.00 in total (the
 * lib test works the buckets by hand); a customer with no rep is its own group on screen.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import AgedReceivablesByRepReportView from '../components/reporting/AgedReceivablesByRepReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

describe('Aged receivables by sales rep screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({
      isGuest: false, user: { uid: 'u1' }, currentWorkspaceId: 'w1',
      workspaces: [{ id: 'w1', name: 'W', currency: 'USD', uid: 'u1', salesReps: [{ id: 'sr_dana01', name: 'Dana', commissionPercent: 5, customerIds: ['c1'] }] }],
    } as never);
    useDataNeedsStore.setState({ failed: {} as never });
    useLedgerStore.setState({
      customers: [{ id: 'c1', name: 'Acme Ltd', workspaceId: 'w1' }, { id: 'c2', name: 'Casa SRL', workspaceId: 'w1' }],
      invoices: [
        { id: 'i1', customerId: 'c1', amountCents: 120_000, amountPaidCents: 0, currency: 'USD', status: 'sent', date: '2026-01-10', dueDate: '2099-02-01', workspaceId: 'w1' },
        { id: 'i2', customerId: 'c2', amountCents: 10_000, amountPaidCents: 0, currency: 'USD', status: 'sent', date: '2026-01-10', dueDate: '2099-02-01', workspaceId: 'w1' },
      ],
      truncatedCollections: {},
    } as never);
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the rep group and the no-rep group are both on screen with their totals', () => {
    render(<AgedReceivablesByRepReportView />);
    const danaRow = screen.getByRole('rowheader', { name: /Dana/ }).parentElement!;
    assert.match(danaRow.textContent || '', /1,200\.00/);
    assert.match(danaRow.textContent || '', /1 customer/);
    const acmeRow = screen.getByRole('rowheader', { name: 'Acme Ltd' }).parentElement!;
    assert.match(acmeRow.textContent || '', /1,200\.00/);
    const noneRow = screen.getByRole('rowheader', { name: /No sales rep/ }).parentElement!;
    assert.match(noneRow.textContent || '', /100\.00/);
    assert.ok(screen.getByText(/1,300\.00.*owed in all/), 'the whole aging adds up on screen');
  });
});
