import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import ImportSettings from '../components/platform/settings/ImportSettings';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';
import { stubFetch } from './helpers/dom';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';

/**
 * E-29 screen: choosing a QuickBooks Desktop IIF in Settings → Import data.
 * The fixture holds 5 usable accounts, 2 customers, 1 vendor, 2 items, 2 transaction records to refuse,
 * and two rows that must be reported (an unknown account type and a customer with no name).
 */
const fixture = (name: string) => readFileSync(new URL('./fixtures/iif/' + name, import.meta.url), 'utf8');

beforeEach(() => {
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('customers', 'vendors', 'inventory', 'accounts', 'transactions');
  useLedgerStore.setState({ customers: [], vendors: [], inventory: [], accounts: [] } as never);
  stubFetch(200, {});
});
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

const uploadIif = async (name: string, text: string) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [{ name, type: 'text/plain', text: async () => text }] } });
  });
};

test('E-29 the IIF panel shows the section counts for the chosen type', async () => {
  render(<ImportSettings />);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'iif' } });
  await uploadIif('lists.iif', fixture('lists.iif'));

  const panel = await screen.findByRole('status');
  const text = panel.textContent || '';
  // counts are always all four sections, so the screen can tell the user to switch type
  assert.match(text, /IIF read: 5 accounts · 2 customers · 1 vendors · 2 items/);
});

test('E-29 the file\'s transactions are refused loudly, and the bad rows are named by line', async () => {
  render(<ImportSettings />);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'iif' } });
  await uploadIif('lists.iif', fixture('lists.iif'));

  const warning = await screen.findByRole('alert');
  assert.match(warning.textContent || '', /2 transaction records .*were not imported/);
  assert.match(warning.textContent || '', /this import moves lists only and never posts/);

  const skipped = screen.getByLabelText('IIF rows that were not imported');
  const lines = within(skipped).getAllByRole('listitem').map(item => item.textContent || '');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /Line 8 \(ACCNT\): account "Ask Me Later" has QuickBooks type "WEIRDTYPE"/);
  assert.match(lines[1], /Line 12 \(CUST\): a CUST row with no NAME was skipped/);
});

test('E-29 switching the import type reads that section of the same file', async () => {
  render(<ImportSettings />);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'iif' } });
  await uploadIif('lists.iif', fixture('lists.iif'));
  await screen.findByRole('status');

  // the kind buttons are the import types; choose Items
  const itemsButton = screen.getAllByRole('button').find(button => button.textContent?.startsWith('Items'));
  assert.ok(itemsButton, 'the Items type button is on the screen');
  fireEvent.click(itemsButton);
  assert.ok(await screen.findByText(/Consulting hour/));
  assert.ok(screen.getByText(/Paper box/));
});

test('E-29 a CSV is still read the ordinary way after an IIF was chosen', async () => {
  render(<ImportSettings />);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'iif' } });
  await uploadIif('lists.iif', fixture('lists.iif'));
  await screen.findByRole('status');

  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'generic' } });
  assert.equal(screen.queryByRole('status'), null, 'the IIF panel goes away with the IIF source');
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [{ name: 'people.csv', type: 'text/csv', text: async () => 'Name,Email\nAcme Ltd,acme@example.com' }] } });
  });
  assert.ok(await screen.findByText(/Acme Ltd/));
});
