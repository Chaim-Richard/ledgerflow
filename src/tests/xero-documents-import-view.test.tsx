import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import XeroDocumentsImport from '../components/platform/settings/XeroDocumentsImport';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { stubFetch } from './helpers/dom';

/**
 * E-28 screen: the Xero invoices/bills import. The worked figures are the ones in the reader test —
 * INV-1001 net 1,620.50 + tax 275.49 = 1,895.99 and INV-1002 net 1,600.00 + tax 272.00 = 1,872.00,
 * so the preview totals are net 3,220.50 / tax 547.49 / total 3,767.99.
 */
const fixture = (name: string) => readFileSync(new URL('./fixtures/xero/' + name, import.meta.url), 'utf8');

const accounts = [
  { id: 'acc-sales', workspaceId: 'ws1', name: 'Sales', code: '4000', type: 'revenue', category: 'Revenue' },
  { id: 'acc-exp', workspaceId: 'ws1', name: 'Office costs', code: '5000', type: 'expense', category: 'Expenses' },
];
const customers = [{ id: 'cus-acme', workspaceId: 'ws1', name: 'Acme Ltd' }, { id: 'cus-beta', workspaceId: 'ws1', name: 'Beta Co' }];
const vendors = [{ id: 'ven-office', workspaceId: 'ws1', name: 'Office Supplies Ltd' }];

function seed(role: 'owner' | 'viewer' = 'owner') {
  useAuthStore.setState({
    isGuest: false,
    user: { uid: 'u1' } as never,
    currentWorkspaceId: 'ws1',
    workspaces: [{ id: 'ws1', uid: role === 'owner' ? 'u1' : 'someone-else', name: 'Studio', currency: 'ILS', roles: { u1: role } } as never],
  });
  useLedgerStore.setState({ accounts, customers, vendors, invoices: [], bills: [], truncatedCollections: {} as never } as never);
  useDataNeedsStore.setState({
    asked: [],
    loaded: { accounts: true, customers: true, vendors: true, invoices: true, bills: true } as never,
    failed: {} as never,
    loadedWorkspaceId: 'ws1',
  } as never);
}

beforeEach(() => { stubFetch(404); seed(); });
afterEach(() => cleanup());

const upload = async (name: string, text: string) => {
  const input = screen.getByLabelText('Xero CSV file') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [{ name, type: 'text/csv', text: async () => text }] } });
  });
};

test('E-28 the screen will not read a file before the date order is chosen', async () => {
  render(<XeroDocumentsImport onSave={async () => 0} />);
  await upload('sales-invoices.csv', fixture('sales-invoices.csv'));
  assert.match(screen.getByRole('alert').textContent || '', /Choose the date order/);
  assert.equal(screen.queryByRole('button', { name: /^Save \d+ draft/ }), null);
});

test('E-28 previews the drafts with the worked totals before saving anything', async () => {
  let saved = 0;
  render(<XeroDocumentsImport onSave={async docs => { saved = docs.length; return docs.length; }} />);
  fireEvent.change(screen.getByLabelText('Xero date order'), { target: { value: 'dmy' } });
  await upload('sales-invoices.csv', fixture('sales-invoices.csv'));

  assert.ok(await screen.findByText('INV-1001'));
  assert.ok(screen.getByText('INV-1002'));
  // totals line: net 3,220.50 · tax 547.49 · total 3,767.99
  const summary = screen.getByText(/documents ready/);
  assert.match(summary.textContent || '', /net [^·]*3,220\.50/);
  assert.match(summary.textContent || '', /tax [^·]*547\.49/);
  assert.match(summary.textContent || '', /total [^·]*3,767\.99/);
  assert.equal(saved, 0, 'reading a file saves nothing');
});

test('E-28 a contact or an account code that is not here blocks the document with the reason', async () => {
  const csv = [
    'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount',
    'Acme Ltd,INV-1,01/02/2024,15/02/2024,Known,1,100.00,4000,17.00',
    'Nobody Ltd,INV-2,01/02/2024,15/02/2024,Unknown customer,1,100.00,4000,17.00',
    'Acme Ltd,INV-3,01/02/2024,15/02/2024,Unknown account,1,100.00,6000,17.00',
  ].join('\n');
  render(<XeroDocumentsImport onSave={async docs => docs.length} />);
  fireEvent.change(screen.getByLabelText('Xero date order'), { target: { value: 'dmy' } });
  await upload('invoices.csv', csv);

  assert.ok(await screen.findByText('INV-1'));
  assert.equal(screen.queryByText('INV-2', { selector: 'td' }), null, 'a blocked document is not offered as a draft');
  const reasons = screen.getByLabelText('Documents that will not be imported').textContent || '';
  assert.match(reasons, /INV-2: "Nobody Ltd" is not in Customers/);
  assert.match(reasons, /INV-3: Account code 6000 is not in the chart of accounts/);
  assert.match(screen.getByRole('button', { name: /Save 1 draft/ }).textContent || '', /Save 1 draft/);
});

test('E-28 saving creates drafts only: status draft, unposted, with the matched account ids', async () => {
  const calls: unknown[][] = [];
  render(<XeroDocumentsImport onSave={async docs => { calls.push(docs); return docs.length; }} />);
  fireEvent.change(screen.getByLabelText('Xero date order'), { target: { value: 'dmy' } });
  await upload('sales-invoices.csv', fixture('sales-invoices.csv'));
  await screen.findByText('INV-1001');

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save 2 draft/ })); });

  assert.equal(calls.length, 1);
  const docs = calls[0] as Array<Record<string, unknown> & { items: Array<{ accountId: string; amountCents: number }> }>;
  assert.equal(docs.length, 2);
  const [first, second] = docs;
  assert.equal(first.number, 'INV-1001');
  assert.equal(first.customerId, 'cus-acme');
  assert.equal(first.customerName, 'Acme Ltd');
  assert.equal(first.status, 'draft');
  assert.equal(first.posted, false);
  assert.equal(first.amountCents, 189599, 'the draft total includes tax');
  assert.equal(first.taxAmountCents, 27549);
  assert.equal(first.lineSumCents, 162050);
  assert.equal(first.taxVersion, 2);
  assert.equal(first.currency, 'ILS');
  assert.equal(first.date, '2024-02-01');
  assert.equal(first.dueDate, '2024-02-15');
  assert.equal(first.reference, 'PO-77');
  assert.deepEqual(first.items.map(item => [item.accountId, item.amountCents]), [['acc-sales', 150000], ['acc-sales', 12050]]);
  assert.equal(second.customerId, 'cus-beta');
  assert.match(screen.getByRole('status').textContent || '', /2 draft documents saved/);
  assert.match(screen.getByRole('status').textContent || '', /that step posts the ledger/);
});

test('E-28 bills use the vendor list, and a number already in the books is skipped, not duplicated', async () => {
  useLedgerStore.setState({ bills: [{ id: 'existing', workspaceId: 'ws1', number: 'BILL-500' }] as never } as never);
  render(<XeroDocumentsImport onSave={async docs => docs.length} />);
  fireEvent.change(screen.getByLabelText('Xero document type'), { target: { value: 'bills' } });
  fireEvent.change(screen.getByLabelText('Xero date order'), { target: { value: 'dmy' } });
  await upload('bills.csv', fixture('bills.csv'));
  assert.match(screen.getByRole('alert').textContent || '', /No document in this file can be imported/);
  const reasons = screen.getByLabelText('Documents that will not be imported').textContent || '';
  assert.match(reasons, /BILL-500 \(row 2\): already exists/);
});

test('E-28 a viewer can neither upload nor save, and the screen says why', () => {
  seed('viewer');
  render(<XeroDocumentsImport onSave={async docs => docs.length} />);
  assert.equal((screen.getByLabelText('Xero CSV file') as HTMLInputElement).disabled, true);
  assert.match(document.body.textContent || '', /A viewer cannot import documents/);
});
