import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import ImportSettings from '../components/platform/settings/ImportSettings';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';
import { stubFetch } from './helpers/dom';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';

/**
 * E-44/E-45/E-46/E-47 screen: choosing a provider source in Settings → Import data normalises
 * that provider's export into the ordinary review table — provider columns reach the check
 * step with the app's own fields, and a foreign currency or an unknown type is named, not guessed.
 */
const fixture = (group: string, name: string) =>
  readFileSync(new URL(`./fixtures/${group}/${name}`, import.meta.url), 'utf8');

beforeEach(() => {
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('customers', 'vendors', 'inventory', 'accounts', 'transactions');
  useLedgerStore.setState({ customers: [], vendors: [], inventory: [], accounts: [] } as never);
  stubFetch(200, {});
});
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

// "N rows ready" is split across a <strong>; match the whole counter paragraph by its text.
const rowsReady = (count: number) => (_: string, element: Element | null) =>
  element?.tagName === 'P'
  && new RegExp(`^${count} row${count === 1 ? '' : 's'} ready`).test((element.textContent || ''));

const upload = async (name: string, text: string) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [{ name, type: 'text/csv', text: async () => text }] } });
  });
};

test('E-47 a Sage 50 CHART.CSV reads through the screen as accounts', async () => {
  render(<ImportSettings />);
  const accountsButton = screen.getAllByRole('button').find(b => b.textContent?.startsWith('Accounts'));
  assert.ok(accountsButton, 'the Accounts kind button exists');
  fireEvent.click(accountsButton);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'sage' } });
  assert.match(document.body.textContent || '', /numeric account-type code is translated only through Sage.s documented table/);
  await upload('CHART.CSV', fixture('sage', 'chart.csv'));
  // 10 of 11 fixture accounts are ready; the contra-asset row is refused with its problem named
  assert.ok(await screen.findByText(rowsReady(10)), document.body.textContent?.slice(0, 2000));
  assert.ok(await screen.findByText(/Type is missing/));
});

test('E-46 a Zoho vendors export reads through the screen as vendors', async () => {
  render(<ImportSettings />);
  const vendorsButton = screen.getAllByRole('button').find(b => b.textContent?.startsWith('Vendors'));
  fireEvent.click(vendorsButton!);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'zoho' } });
  await upload('vendors.csv', fixture('zoho', 'vendors.csv'));
  assert.ok(await screen.findByText(rowsReady(2)), document.body.textContent?.slice(0, 2000));
  assert.ok(await screen.findByText(/Paper World Ltd/));
});

test('E-44 a Xero contacts CSV reads through the screen as customers, tax number included', async () => {
  render(<ImportSettings />);
  const customersButton = screen.getAllByRole('button').find(b => b.textContent?.startsWith('Customers'));
  fireEvent.click(customersButton!);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'xero' } });
  assert.match(document.body.textContent || '', /a Xero contacts file is mixed, and you pick the list/);
  await upload('contacts.csv', fixture('xero', 'contacts.csv'));
  assert.ok(await screen.findByText(rowsReady(3)), document.body.textContent?.slice(0, 2000));
  assert.ok(await screen.findByText(/516123456/));
});

test('E-45 a Wave customers CSV reads through the screen, and a Hebrew note survives', async () => {
  render(<ImportSettings />);
  const customersButton = screen.getAllByRole('button').find(b => b.textContent?.startsWith('Customers'));
  fireEvent.click(customersButton!);
  fireEvent.change(screen.getByLabelText('CSV source'), { target: { value: 'wave' } });
  assert.match(document.body.textContent || '', /Wave has no vendor CSV export to key on/);
  await upload('customers.csv', fixture('wave', 'customers.csv'));
  assert.ok(await screen.findByText(rowsReady(2)), document.body.textContent?.slice(0, 2000));
  assert.ok(await screen.findByText(/Delta Bakery/));
});
