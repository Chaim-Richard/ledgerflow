import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ImportSettings from '../components/platform/settings/ImportSettings';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';
import { stubFetch } from './helpers/dom';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';

/**
 * A-182 screen: choosing an address-book file in Settings → Import data.
 * A vCard and a Google Contacts CSV both land in the ordinary checked import, and the
 * duplicate check compares the rows with the customers already in the workspace.
 */

beforeEach(() => {
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('customers', 'vendors', 'inventory', 'accounts', 'transactions');
  useLedgerStore.setState({
    customers: [{ id: 'c1', uid: 'test-user', workspaceId: 'component-workspace', name: 'Acme Ltd', email: 'hello@acme.example', phone: '212-555-0100' }],
    vendors: [], inventory: [], accounts: [],
  } as never);
  stubFetch(200, {});
});
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

const upload = async (name: string, text: string) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [{ name, type: 'text/plain', text: async () => text }] } });
  });
};

const VCARD = [
  'BEGIN:VCARD',
  'FN:Acme Ltd',
  'EMAIL:accounts@acme.example',
  'END:VCARD',
  'BEGIN:VCARD',
  'FN:New Person',
  'EMAIL:new@example.com',
  'TEL:050-9998887',
  'END:VCARD',
].join('\r\n');

test('A-182 a vCard is read into the checked import and the exact-name duplicate is called out', async () => {
  render(<ImportSettings />);
  await upload('phone-contacts.vcf', VCARD);

  const status = await screen.findByRole('status');
  assert.match(status.textContent || '', /Address book read: 2 contacts/);
  // both rows are valid for the ordinary import…
  assert.match(document.body.textContent || '', /2 rows ready/);
  // …and the duplicate check says the Acme row will be skipped, naming the existing record
  const skipped = await screen.findByLabelText('Rows that will be skipped as duplicates');
  const lines = within(skipped).getAllByRole('listitem').map(item => item.textContent || '');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Row 2: “Acme Ltd” matches “Acme Ltd”/);
});

test('A-182 a Google Contacts CSV is recognised and a same-email different-name row is flagged', async () => {
  render(<ImportSettings />);
  const csv = [
    'Name,First Name,Last Name,E-mail 1 - Value,Phone 1 - Value,Organization 1 - Name',
    ',,,hello@acme.example,,Acme Holdings',
  ].join('\n');
  await upload('contacts.csv', csv);

  const status = await screen.findByRole('status');
  assert.match(status.textContent || '', /Address book read: 1 contact/);
  const possible = await screen.findByLabelText('Rows that look like existing contacts');
  const lines = within(possible).getAllByRole('listitem').map(item => item.textContent || '');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Row 2: “Acme Holdings” looks like “Acme Ltd” \(same email address\)/);
});

test('A-182 an address book cannot be switched to items mid-import', async () => {
  render(<ImportSettings />);
  await upload('phone-contacts.vcf', VCARD);
  await screen.findByRole('status');
  const itemsButton = screen.getAllByRole('button').find(button => button.textContent?.startsWith('Items'));
  assert.ok(itemsButton, 'the Items type button is on the screen');
  fireEvent.click(itemsButton);
  // still on customers with the contacts import intact (an error toast explains why)
  assert.match(screen.getByRole('status').textContent || '', /Address book read: 2 contacts/);
  assert.match(document.body.textContent || '', /2 rows ready/);
});
