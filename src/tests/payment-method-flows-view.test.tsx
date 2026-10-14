import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import PaymentFlowsByMethodPanel from '../components/reporting/PaymentFlowsByMethodPanel';
import PaymentMethodSummaryView from '../components/reporting/PaymentMethodSummaryView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makePayment } from './fixtures';

const auth = useAuthStore.getState();
const ledger = useLedgerStore.getState();
const needs = useDataNeedsStore.getState();
afterEach(() => {
  cleanup();
  useAuthStore.setState(auth, true);
  useLedgerStore.setState(ledger, true);
  useDataNeedsStore.setState(needs, true);
});

const payment = makePayment({ id: 'p1', workspaceId: 'component-workspace', amountCents: 12500,
  currency: 'USD', method: 'bank_transfer', direction: 'made', date: '2026-03-10', status: 'posted' });

test('E-23 read-only panel shows outgoing payments and makes CSV available for reviewed records', () => {
  render(<PaymentFlowsByMethodPanel payments={[payment]} workspaceId="component-workspace"
    homeCurrency="USD" startDate="2026-01-01" endDate="2026-12-31" loading={false} incomplete={false} />);
  const panel = screen.getByRole('region', { name: 'Payment in and out by method' });
  assert.match(panel.textContent || '', /Money in and out by payment method/);
  assert.ok(screen.getByText('bank_transfer'));
  assert.ok(screen.getByText(/1 \/ /));
  assert.equal((screen.getByRole('button', { name: 'Download payment method CSV' }) as HTMLButtonElement).disabled, false);
});

test('E-23 archive/export is blocked on incomplete or unverified payment history', () => {
  render(<PaymentFlowsByMethodPanel payments={[payment]} workspaceId="component-workspace"
    homeCurrency="USD" startDate="2026-01-01" endDate="2026-12-31" loading={false} incomplete />);
  assert.equal((screen.getByRole('button', { name: 'Download payment method CSV' }) as HTMLButtonElement).disabled, true);
  assert.match(screen.getByRole('alert').textContent || '', /incomplete/);
  cleanup();
  render(<PaymentFlowsByMethodPanel payments={[{ ...payment, date: '' }]} workspaceId="component-workspace"
    homeCurrency="USD" startDate="2026-01-01" endDate="2026-12-31" loading={false} incomplete={false} />);
  assert.equal((screen.getByRole('button', { name: 'Download payment method CSV' }) as HTMLButtonElement).disabled, true);
  assert.match(screen.getByRole('alert').textContent || '', /lack a valid date/);
});

test('E-23 new in/out section is reachable on the existing payment method report screen', () => {
  setComponentWorkspace();
  useLedgerStore.setState({ customers: [], payments: [payment] });
  useDataNeedsStore.setState({ loaded: { customers: true, payments: true }, loadedWorkspaceId: 'component-workspace', failed: {} });
  render(<PaymentMethodSummaryView startDate="2026-01-01" endDate="2026-12-31" />);
  assert.ok(screen.getByText('Sales payment summary by method'));
  assert.ok(screen.getByRole('region', { name: 'Payment in and out by method' }));
});
