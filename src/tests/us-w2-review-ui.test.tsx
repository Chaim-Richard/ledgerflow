import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PayRun } from '../types';
import { UsW2Review } from '../components/hr/UsW2Review';
import { exactW2Cents } from '../lib/tax/usW2Review';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';

const run: PayRun = {
  id: 'run1', uid: 'u1', workspaceId: 'ws-1', date: '2026-03-10',
  totalAmountCents: 1000000, employeeCount: 1, status: 'processed', createdAt: '2026-03-10T00:00:00Z',
  employees: [{
    employeeId: 'employee1', name: 'Payroll Example',
    grossCents: 1300000, netCents: 800000, deductionsCents: 0,
    withheldCents: 500000, employerTaxCents: 100000,
  }],
};

function setup(guest = false) {
  useAuthStore.setState({ currentWorkspaceId: 'ws-1', isGuest: guest, user: null });
  useDataNeedsStore.setState({ loaded: { payRuns: true }, loadedWorkspaceId: 'ws-1', failed: {} });
}
afterEach(() => cleanup());

test('E-19 exact USD decimal parser never rounds or turns blanks into zero', () => {
  assert.equal(exactW2Cents('1500.05'), 150005);
  assert.equal(exactW2Cents('0'), 0);
  assert.equal(exactW2Cents('1.5'), 150);
  for (const item of ['', '1.234', '-2', '1e6', '2,000', '9007199254740992', '  ']) {
    assert.equal(exactW2Cents(item), undefined);
  }
});

test('E-19 payroll W-2 review requires all six typed amounts, source review and explicit scope confirmation', () => {
  setup();
  render(<UsW2Review payRuns={[run]} homeCurrency="USD" />);
  fireEvent.click(screen.getByRole('button', { name: 'Review W-2 boxes' }));
  const button = screen.getByRole('button', { name: 'Download W-2 review CSV' }) as HTMLButtonElement;
  assert.equal(button.disabled, true, 'gross from the pay run cannot auto-fill W-2 boxes');
  const fields = [
    ['Box 1 — taxable wages', '10000.00'],
    ['Box 2 — federal income tax withheld', '1500.00'],
    ['Box 3 — Social Security wages', '13000.00'],
    ['Box 4 — employee Social Security tax', '806.00'],
    ['Box 5 — Medicare wages and tips', '13000.00'],
    ['Box 6 — employee Medicare tax', '188.50'],
  ];
  for (const [label, amount] of fields) {
    fireEvent.change(screen.getByLabelText(label + ' for Payroll Example'), { target: { value: amount } });
  }
  assert.equal(button.disabled, true, 'source review still required');
  fireEvent.click(screen.getByRole('checkbox', { name: /These six box figures/ }));
  assert.equal(button.disabled, true, 'acknowledgement for download still required');
  fireEvent.click(screen.getByRole('checkbox', { name: /I understand that this contains reviewed/ }));
  assert.equal(button.disabled, false);
  fireEvent.change(screen.getByLabelText('W-2 review year'), { target: { value: '2025' } });
  assert.equal(button.disabled, true, 'new year must have a separate reviewed dataset');
});

test('E-19 guest, another workspace, failed load and non-USD review cannot download', () => {
  setup(true);
  render(<UsW2Review payRuns={[run]} homeCurrency="USD" />);
  fireEvent.click(screen.getByRole('button', { name: 'Review W-2 boxes' }));
  assert.equal((screen.getByRole('button', { name: 'Download W-2 review CSV' }) as HTMLButtonElement).disabled, true);
  assert.ok(screen.getByText(/Demo payroll/));
  cleanup();

  setup();
  useDataNeedsStore.setState({ loadedWorkspaceId: 'ws-2', failed: { payRuns: 'read failure' } });
  render(<UsW2Review payRuns={[{ ...run, workspaceId: 'ws-2' }]} homeCurrency="ILS" />);
  fireEvent.click(screen.getByRole('button', { name: 'Review W-2 boxes' }));
  assert.ok(screen.getByText(/different workspace/));
  assert.ok(screen.getByText(/could not be loaded/));
  assert.ok(screen.getByText(/requires a USD workspace/));
});
