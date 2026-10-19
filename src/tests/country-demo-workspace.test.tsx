import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { seedCountryDemoWorkspace } from '../lib/countryDemoWorkspace';
import GuestCountrySamplePicker from '../components/onboarding/GuestCountrySamplePicker';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, isGuest: false, currentWorkspaceId: null, workspaces: [] });
  useLedgerStore.getState().resetStore();
});

test('IL and US sample books are synthetic, one-year, currency-specific and every entry balances', () => {
  for (const [country, currency] of [['IL', 'ILS'], ['US', 'USD']] as const) {
    const sample = seedCountryDemoWorkspace('guest', country);
    assert.equal(sample.country, country);
    assert.equal(sample.currency, currency);
    assert.equal(sample.transactions.length, 25, 'one opening record and two records for each month');
    assert.equal(sample.transactions[0].date, '2025-01-01');
    assert.equal(sample.transactions.at(-1)?.date, '2025-12-01');
    assert.ok(sample.companyName.includes('(demo)'));
    assert.ok(sample.customers.every(party => party.name.includes('(demo)')));
    assert.ok(sample.vendors.every(party => party.name.includes('(demo)')));
    assert.ok(sample.transactions.every(tx => tx.currency === currency && tx.totalAmountCents > 0));
    assert.ok(sample.transactions.every(tx => tx.lines.reduce((sum, line) => sum + line.amountCents, 0) === 0));
    assert.ok(sample.accounts.every(account => account.workspaceId === 'guest' && account.uid === 'usr_demo'));
    assert.equal(new Set(sample.transactions.map(tx => tx.id)).size, sample.transactions.length);
  }
  assert.match(seedCountryDemoWorkspace('guest', 'IL').companyName, /Galil/);
  assert.match(seedCountryDemoWorkspace('guest', 'US').companyName, /Hudson/);
  assert.match(seedCountryDemoWorkspace('guest', 'IL').accounts[0].name, /חשבון עסקי/);
});

test('guest picker switches only the unsigned guest cache and labels its limits', () => {
  useAuthStore.setState({ isGuest: true, user: null, currentWorkspaceId: 'guest', workspaces: [] });
  useLedgerStore.setState({ accounts: [], customers: [], vendors: [], transactions: [], invoices: [], bills: [], payments: [], creditNotes: [], vendorCredits: [], estimates: [], bankLines: [], journalEntries: [] });
  const originalConfirm = window.confirm;
  window.confirm = () => true;
  try {
    render(<GuestCountrySamplePicker />);
    assert.match(screen.getByText(/Synthetic 2025 records stay in this guest session only/).textContent || '', /no tax is calculated/);
    fireEvent.click(screen.getByRole('button', { name: 'Try the Israel sample' }));
    assert.equal(useLedgerStore.getState().baseCurrency, 'ILS');
    assert.equal(useLedgerStore.getState().transactions.length, 25);
    assert.match(screen.getByText(/Israel · ILS/).textContent || '', /Israel · ILS/);
    fireEvent.click(screen.getByRole('button', { name: 'Try the US sample' }));
    assert.equal(useLedgerStore.getState().baseCurrency, 'USD');
    assert.match(screen.getByText(/United States · USD/).textContent || '', /United States · USD/);
  } finally {
    window.confirm = originalConfirm;
  }
});

test('the country sample picker refuses signed-in workspaces even if rendered accidentally', () => {
  useAuthStore.setState({ isGuest: false, user: { uid: 'real-user' } as never, currentWorkspaceId: 'real-workspace', workspaces: [] });
  useLedgerStore.setState({ accounts: [], customers: [], vendors: [], transactions: [] });
  const originalConfirm = window.confirm;
  window.confirm = () => { assert.fail('must not ask to replace a real workspace'); };
  try {
    render(<GuestCountrySamplePicker />);
    fireEvent.click(screen.getByRole('button', { name: 'Try the Israel sample' }));
    assert.equal(useLedgerStore.getState().transactions.length, 0);
  } finally {
    window.confirm = originalConfirm;
  }
});
