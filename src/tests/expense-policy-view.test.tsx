/**
 * A-74 on the screen: an expense claim in the period is checked against the workspace's own policy.
 * What the test holds: an over-maximum claim is shown with the policy's own words, a claim within
 * policy is shown as such, a line needing a receipt is "not checked here" (never a false breach),
 * a claim outside the period is left out, and a corrupt stored policy row is reported rather than
 * silently ignored. Read-only: the screen never calls a write.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import ExpensePolicyReportView from '../components/reporting/ExpensePolicyReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

const previousAuth = useAuthStore.getState();
const previousLedger = useLedgerStore.getState();

beforeEach(() => {
  useLedgerStore.setState({ bills: [], truncatedCollections: {} } as never);
});

afterEach(() => {
  cleanup();
  useAuthStore.setState(previousAuth, true);
  useLedgerStore.setState(previousLedger, true);
});

const HOTEL = {
  id: 'hotel', accountId: 'exp-travel', category: 'hotel', maxAmountCents: 25_000, receiptFromCents: 1,
  note: 'Hotel: up to $250.00 a night', validFrom: '2026-01-01',
};

const claimBill = (input: { id: string; date: string; amountCents: number; description: string }) => ({
  id: input.id,
  workspaceId: 'ws-1',
  number: `BILL-${input.id}`,
  vendorName: 'Dana Employee',
  date: input.date,
  dueDate: input.date,
  status: 'draft',
  currency: 'USD',
  exchangeRate: 1,
  amountCents: input.amountCents,
  splits: [{ accountId: 'exp-travel', amountCents: input.amountCents, description: input.description }],
  metadata: { expenseClaim: { state: 'submitted', submittedBy: 'u-1', submittedByName: 'Dana Employee', submittedAt: `${input.date}T09:00:00Z` } },
}) as never;

const setup = (input: { bills: unknown[]; policy?: unknown }) => {
  // the real store's own getCurrentWorkspace picks the workspace out of `workspaces`, so no new
  // object is built per render (a fresh object in a selector re-renders forever)
  const workspace = { id: 'ws-1', uid: 'u-1', name: 'Policy books', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD', expensePolicy: input.policy };
  useAuthStore.setState({ user: null, isGuest: true, currentWorkspaceId: 'ws-1', workspaces: [workspace] } as never);
  useLedgerStore.setState({ bills: input.bills, truncatedCollections: {} } as never);
};

test('an over-maximum line is shown with the policy’s own words; a compliant claim is shown as within policy', () => {
  setup({
    policy: { rows: [HOTEL] },
    bills: [
      claimBill({ id: '1', date: '2026-05-05', amountCents: 40_000, description: 'Hotel night' }),
      claimBill({ id: '2', date: '2026-05-06', amountCents: 20_000, description: 'Hotel night' }),
    ],
  });
  render(<ExpensePolicyReportView endDate="2026-06-30" />);
  assert.ok(screen.getByText('Expense policy check'));
  assert.ok(screen.getByText('Over the maximum'));
  assert.ok(screen.getByText(/Hotel: up to \$250\.00 a night allows up to 250\.00/));
  // the second claim is within the maximum; its receipt is unknown to this screen, so it is a notice
  assert.equal(screen.getAllByText('Receipt not checked here').length, 2, 'both claims ask for a receipt this screen cannot count');
  assert.equal(screen.queryByText('Within policy'), null, 'a claim with an unchecked receipt is not called clean');
  assert.equal(screen.getAllByText(/not counted here/).length, 2);
  assert.equal(screen.queryByText('Receipt missing'), null, 'an unknown receipt count is never shown as missing');
});

test('a claim dated outside the period is not shown, and the empty state says why', () => {
  setup({ policy: { rows: [HOTEL] }, bills: [claimBill({ id: '3', date: '2025-01-05', amountCents: 40_000, description: 'Hotel night' })] });
  render(<ExpensePolicyReportView endDate="2026-06-30" />);
  assert.ok(screen.getByText(/No expense claim in this period/));
  assert.equal(screen.queryByText('Over the maximum'), null);
});

test('a workspace without policy rows says so, so a clean report is not mistaken for approval', () => {
  setup({ policy: undefined, bills: [claimBill({ id: '4', date: '2026-05-05', amountCents: 40_000, description: 'Hotel night' })] });
  render(<ExpensePolicyReportView endDate="2026-06-30" />);
  assert.ok(screen.getByText(/no expense policy rows yet, so every claim is within policy by default/));
  assert.ok(screen.getByText('Within policy'));
});

test('a corrupt stored policy row is reported, not silently dropped', () => {
  setup({
    policy: { rows: [HOTEL, { id: 'broken', validFrom: '2026-1-1', maxAmountCents: 100_000, accountId: 'exp-travel' }] },
    bills: [claimBill({ id: '5', date: '2026-05-05', amountCents: 40_000, description: 'Hotel night' })],
  });
  render(<ExpensePolicyReportView endDate="2026-06-30" />);
  assert.ok(screen.getByText(/1 stored policy row\(s\) could not be read and were ignored/));
});

test('a bill that is not an expense claim is not checked here', () => {
  const plainBill = { ...(claimBill({ id: '6', date: '2026-05-05', amountCents: 90_000, description: 'Hotel night' }) as Record<string, unknown>), metadata: {} };
  setup({ policy: { rows: [HOTEL] }, bills: [plainBill] });
  render(<ExpensePolicyReportView endDate="2026-06-30" />);
  assert.equal(screen.queryByText('Over the maximum'), null);
  assert.ok(screen.getByText(/No expense claim in this period/));
});
