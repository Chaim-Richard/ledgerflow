/**
 * The Account Statement screen (H-08): pick a customer and a period; the opening balance, each
 * invoice, payment and credit note, and the closing balance (credits count, refunds put back; L-160).
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import StatementView from '../components/reporting/StatementView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import type { Workspace } from '../types';
import { makeCreditNote, makeCustomer, makeInvoice, makePayment } from './fixtures';

describe('Account Statement screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({
      customers: [makeCustomer({ id: 'c0', name: 'Zero Ltd' }), makeCustomer({ id: 'c1', name: 'Acme' })],
      vendors: [],
      invoices: [
        makeInvoice({ id: 'i1', number: 'INV-1', customerId: 'c1', amountCents: 100000, date: '2026-01-10', status: 'sent' }),
        makeInvoice({ id: 'i2', number: 'INV-2', customerId: 'c1', amountCents: 50000, date: '2026-03-05', status: 'sent' }),
      ],
      bills: [],
      payments: [makePayment({ id: 'p1', reference: 'PAY-1', contactId: 'c1', direction: 'received', status: 'posted', amountCents: 60000, date: '2026-03-10' })],
      creditNotes: [makeCreditNote({ id: 'cn1', number: 'CN-1', customerId: 'c1', amountCents: 20000, remainingCents: 0, date: '2026-01-20', status: 'applied' })],
      vendorCredits: [],
    });
  });
  afterEach(() => cleanup());

  test('opening balance, the entries in the period and the closing balance for the chosen customer', () => {
    render(<StatementView startDate="2026-03-01" endDate="2026-03-31" />);
    fireEvent.change(screen.getByLabelText(/Select Customer/), { target: { value: 'c1' } });
    assert.match(screen.getByText('Opening Balance').parentElement!.textContent || '', /\$800\.00/);   // 1,000 - 200 credit
    assert.match(screen.getByText('Ending Outstanding Balance').parentElement!.textContent || '', /\$700\.00/);
    const table = screen.getByText('Opening Balance Brought Forward').closest('table')!;
    assert.match(table.textContent || '', /INV-2.*\$500\.00.*\$1,300\.00/);
    assert.match(table.textContent || '', /PAY-1.*\$600\.00.*\$700\.00/);
  });
});
