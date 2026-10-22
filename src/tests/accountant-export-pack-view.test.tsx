import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import AccountantExportPackView from '../components/reporting/AccountantExportPackView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';

/** E-58: the accountant export pack screen, on the worked-figure books of the pack test. */

const accounts = [
  { id: 'cash', workspaceId: 'ws1', name: 'Cash', code: '1000', type: 'asset', category: 'Cash', openingBalanceCents: 100000 },
  { id: 'ar', workspaceId: 'ws1', name: 'Accounts Receivable', code: '1100', type: 'asset', category: 'Receivables' },
  { id: 'inventory', workspaceId: 'ws1', name: 'Inventory', code: '1200', type: 'asset', category: 'Current Assets', openingBalanceCents: 200000 },
  { id: 'ap', workspaceId: 'ws1', name: 'Accounts Payable', code: '2000', type: 'liability', category: 'Payables' },
  { id: 'tax', workspaceId: 'ws1', name: 'Sales tax payable', code: '2200', type: 'liability', category: 'Payables' },
  { id: 'equity', workspaceId: 'ws1', name: 'Owner equity', code: '3000', type: 'equity', category: 'Equity', openingBalanceCents: 300000 },
  { id: 'sales', workspaceId: 'ws1', name: 'Sales', code: '4000', type: 'revenue', category: 'Revenue' },
  { id: 'cogs', workspaceId: 'ws1', name: 'Cost of goods sold', code: '5000', type: 'cost_of_goods', category: 'COGS' },
];

const line = (accountId: string, amountCents: number) => ({ accountId, amountCents });
const transactions = [
  { id: 't1', workspaceId: 'ws1', date: '2026-01-10', description: 'Invoice INV-1', status: 'posted', lines: [line('ar', 120000), line('sales', -100000), line('tax', -20000)] },
  { id: 't2', workspaceId: 'ws1', date: '2026-01-20', description: 'Bill BILL-1', status: 'posted', lines: [line('cogs', 50000), line('ap', -50000)] },
  { id: 't3', workspaceId: 'ws1', date: '2026-02-05', description: 'Receipt INV-1', status: 'posted', lines: [line('cash', 120000), line('ar', -120000)] },
  { id: 't5', workspaceId: 'ws1', date: '2026-02-20', description: 'Invoice INV-2', status: 'posted', lines: [line('ar', 55000), line('sales', -50000), line('tax', -5000)] },
];
const customers = [{ id: 'c1', workspaceId: 'ws1', name: 'Alpha Ltd' }];
const vendors = [{ id: 'v2', workspaceId: 'ws1', name: 'Delta Parts' }];
const invoices = [
  { id: 'inv1', workspaceId: 'ws1', customerId: 'c1', date: '2026-01-10', dueDate: '2026-02-09', status: 'paid', amountCents: 120000, amountPaidCents: 120000, taxCents: 20000, taxTreatment: 'standard' },
  { id: 'inv2', workspaceId: 'ws1', customerId: 'c1', date: '2026-02-20', dueDate: '2026-02-25', status: 'sent', amountCents: 55000, taxCents: 5000, taxTreatment: 'standard' },
];
const bills = [
  { id: 'bill2', workspaceId: 'ws1', vendorId: 'v2', date: '2026-02-10', dueDate: '2026-03-10', status: 'unpaid', amountCents: 21400, taxCents: 1400, taxTreatment: 'standard' },
];

function seedWorkspace() {
  useAuthStore.setState({
    isGuest: false, user: { uid: 'u1' } as never, currentWorkspaceId: 'ws1',
    workspaces: [{ id: 'ws1', uid: 'u1', name: 'Galil Design Studio', currency: 'USD' } as never],
  });
  useLedgerStore.setState({
    accounts, transactions, customers, vendors, invoices, bills, creditNotes: [], vendorCredits: [],
    truncatedCollections: {} as never,
  } as never);
  useDataNeedsStore.setState({
    asked: [], loaded: {
      accounts: true, transactions: true, customers: true, vendors: true, invoices: true, bills: true, creditNotes: true, vendorCredits: true,
    } as never,
    failed: {} as never, loadedWorkspaceId: 'ws1',
  } as never);
}

beforeEach(seedWorkspace);
afterEach(() => cleanup());

async function prepare() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Prepare pack' }));
    await new Promise(resolve => setTimeout(resolve, 10));
  });
}

test('E-58 prepares the five sections from the books and offers the ZIP, per-section CSV and PDF', async () => {
  render(<AccountantExportPackView startDate="2026-01-01" endDate="2026-02-28" />);
  assert.ok(screen.getByRole('heading', { name: 'Accountant export pack' }));
  assert.equal((screen.getByLabelText('Pack start date') as HTMLInputElement).value, '2026-01-01');
  assert.equal((screen.getByLabelText('Pack end date') as HTMLInputElement).value, '2026-02-28');

  await prepare();

  // The summary repeats the hand-worked figures of the pack test.
  const text = document.body.textContent || '';
  // Trial balance debits = credits = 6,450.00 for this fixture (opening 3,000 equity; 1,200 cash after
  // the receipt; 550 receivable; 500 payable; 250 sales tax; 500 cost of goods sold).
  assert.match(text, /\$6,450\.00 \/ \$6,450\.00/);
  assert.match(text, /Accounts receivable open\$550\.00/);
  assert.match(text, /Accounts payable open\$214\.00/);
  assert.match(text, /Tax liability for the period \(negative: to reclaim\)\$236\.00/);
  for (const title of ['Trial balance', 'General ledger', 'Accounts receivable', 'Accounts payable', 'Tax liability by period']) {
    assert.ok(screen.getAllByText(new RegExp(title)).length > 0, `${title} is in the pack`);
  }
  assert.ok(screen.getByRole('button', { name: 'Download CSV pack (ZIP)' }));
  assert.ok(screen.getByRole('button', { name: 'Print / Save as PDF' }));
  assert.ok(screen.getByRole('button', { name: 'Download trial-balance.csv' }));
  assert.ok(screen.getByRole('button', { name: 'Download tax-liability-by-period.csv' }));
  // the pack says what it is not
  assert.match(document.body.textContent || '', /not a statutory filing/);
});

test('E-58 a changed period clears the prepared pack, so no stale figures can be downloaded', async () => {
  render(<AccountantExportPackView startDate="2026-01-01" endDate="2026-02-28" />);
  await prepare();
  assert.ok(screen.getByRole('button', { name: 'Download CSV pack (ZIP)' }));
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Pack end date'), { target: { value: '2026-01-31' } });
  });
  assert.equal(screen.queryByRole('button', { name: 'Download CSV pack (ZIP)' }), null);
  assert.ok(screen.getByRole('button', { name: 'Prepare pack' }));
});

test('E-58 the demo workspace and an incomplete browser list block the download with a reason', async () => {
  useAuthStore.setState({ isGuest: true, user: null, currentWorkspaceId: null });
  const { unmount } = render(<AccountantExportPackView startDate="2026-01-01" endDate="2026-02-28" />);
  assert.match(document.body.textContent || '', /demo workspace/i);
  assert.equal((screen.getByRole('button', { name: 'Prepare pack' }) as HTMLButtonElement).disabled, true);
  unmount();

  seedWorkspace();
  useLedgerStore.setState({ truncatedCollections: { invoices: true } as never } as never);
  render(<AccountantExportPackView startDate="2026-01-01" endDate="2026-02-28" />);
  const alert = screen.getByRole('alert', { name: 'Why the pack cannot be prepared' });
  assert.match(alert.textContent || '', /invoices/);
  assert.equal((screen.getByRole('button', { name: 'Prepare pack' }) as HTMLButtonElement).disabled, true);
});

test('E-58 records of another workspace never reach the pack', async () => {
  useLedgerStore.setState({
    customers: [...customers, { id: 'c9', workspaceId: 'ws2', name: 'Other Workspace Ltd' }] as never,
    invoices: [...invoices, { id: 'inv9', workspaceId: 'ws2', customerId: 'c9', date: '2026-02-01', dueDate: '2026-02-01', status: 'sent', amountCents: 999900, taxCents: 0 }] as never,
  } as never);
  render(<AccountantExportPackView startDate="2026-01-01" endDate="2026-02-28" />);
  await prepare();
  assert.doesNotMatch(document.body.textContent || '', /Other Workspace Ltd/);
  assert.doesNotMatch(document.body.textContent || '', /9,999\.00/);
  // the workspace's own receivable figure is unchanged
  assert.match(document.body.textContent || '', /Accounts receivable open\$550\.00/);
});

test('E-58 an impossible period is refused before anything is read', () => {
  render(<AccountantExportPackView startDate="2026-02-28" endDate="2026-01-01" />);
  assert.match(screen.getByRole('alert', { name: 'Why the pack cannot be prepared' }).textContent || '', /start not after the end/);
  assert.equal((screen.getByRole('button', { name: 'Prepare pack' }) as HTMLButtonElement).disabled, true);
});
