/**
 * A-143 on the screen: the projection follows the lifespan the reader types, an impossible lifespan
 * is refused as an alert rather than guessed, and the credit note reduces the revenue it belongs to.
 * Read-only: the screen only reads the stores.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { CustomerLifetimeValuePanel } from '../components/reporting/CustomerLifetimeValueReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

const previousAuth = useAuthStore.getState();
const previousLedger = useLedgerStore.getState();

beforeEach(() => {
  useLedgerStore.setState({ customers: [], invoices: [], creditNotes: [], inventory: [], transactions: [], accounts: [], truncatedCollections: {} } as never);
});

afterEach(() => {
  cleanup();
  useAuthStore.setState(previousAuth, true);
  useLedgerStore.setState(previousLedger, true);
});

const line = (id: string, amountCents: number, quantity: number) => ({ id, itemId: 'paper', description: 'Paper', quantity, rateCents: amountCents / quantity, amountCents, accountId: 'rev' });

test('the customer row carries the recorded figures and the projection follows the typed lifespan', () => {
  const workspace = { id: 'ws-1', uid: 'u-1', name: 'CLV books', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD' };
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: 'ws-1', workspaces: [workspace] } as never);
  useLedgerStore.setState({
    customers: [{ id: 'c1', name: 'Alpha Ltd', workspaceId: 'ws-1' }],
    inventory: [{ id: 'paper', name: 'Paper', sku: 'P-1', unitCostCents: 400, workspaceId: 'ws-1' }],
    invoices: [
      { id: 'i1', workspaceId: 'ws-1', customerId: 'c1', customerName: 'Alpha Ltd', date: '2026-01-10', status: 'sent', dueDate: '2026-02-10', amountCents: 10000, items: [line('l1', 10000, 10)] },
      { id: 'i2', workspaceId: 'ws-1', customerId: 'c1', customerName: 'Alpha Ltd', date: '2026-03-20', status: 'paid', dueDate: '2026-04-20', amountCents: 20000, items: [line('l2', 20000, 20)] },
      { id: 'draft', workspaceId: 'ws-1', customerId: 'c1', date: '2026-04-01', status: 'draft', dueDate: '2026-05-01', amountCents: 99999, items: [line('l3', 99999, 10)] },
    ],
    creditNotes: [{ id: 'cn1', workspaceId: 'ws-1', customerId: 'c1', date: '2026-04-01', status: 'applied', amountCents: 2000 }],
    truncatedCollections: {},
  } as never);

  render(<CustomerLifetimeValuePanel asOf="2026-10-31" />);
  assert.ok(screen.getByRole('heading', { name: 'Customer lifetime value' }));
  const table = screen.getByRole('table');
  const text = table.textContent || '';
  assert.match(text, /Alpha Ltd/);
  assert.match(text, /\$280\.00/, 'sales 300.00 less the credit note of 20.00');
  assert.match(text, /\$160\.00/, 'net revenue less the estimated cost of 120.00');
  assert.match(text, /57\.1%/);
  assert.match(text, /\$140\.00/, 'average order of two');
  assert.match(text, /2\.40/);
  assert.match(text, /\$192\.00/);
  assert.match(text, /\$576\.00/, 'three years by default');

  fireEvent.change(screen.getByLabelText('Lifespan in years'), { target: { value: '5' } });
  assert.match(screen.getByRole('table').textContent || '', /\$960\.00/);

  fireEvent.change(screen.getByLabelText('Lifespan in years'), { target: { value: '0' } });
  fireEvent.blur(screen.getByLabelText('Lifespan in years'));
  assert.ok(screen.getByRole('alert').textContent?.includes('between 1 and 20'));
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
});
