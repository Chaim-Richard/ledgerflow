/**
 * Settings → Currencies (BB-02): the other currencies the invoices and bills use, most used first,
 * with how many are still open and the newest rate posted (never an invented one); the month-end
 * revaluation shows only when something in another currency is still open.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { currenciesInUse } from '../lib/exchangeRates';
import CurrenciesSettings from '../components/platform/settings/CurrenciesSettings';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { stubFetch } from './helpers/dom';
import { getSupabase } from '../lib/db/client';

describe('The currencies in use', () => {
  test('most used first, open ones counted, the newest rate posted', () => {
    assert.deepEqual(currenciesInUse('USD', [
      { currency: 'EUR', exchangeRate: 1.1, date: '2026-01-05', open: false },
      { currency: 'EUR', exchangeRate: 1.12, date: '2026-03-01', open: true },
      { currency: 'gbp', exchangeRate: 1.3, date: '2026-02-01', open: true },
      { currency: 'USD', exchangeRate: 1, date: '2026-02-01', open: true },
      { currency: 'ILS', date: '2026-02-01' },
    ]), [
      { currency: 'EUR', documents: 2, open: 1, lastRate: 1.12, lastDate: '2026-03-01' },
      { currency: 'GBP', documents: 1, open: 1, lastRate: null, lastDate: null },
      { currency: 'ILS', documents: 1, open: 0, lastRate: null, lastDate: null },
    ], 'the home currency is left out; a lowercase code is one currency; no rate is said as none');
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('the table of currencies, and the revaluation only with something open', () => {
    stubFetch(404);
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('bills', 'invoices');
    useLedgerStore.setState({ invoices: [{ id: 'i1', currency: 'EUR', exchangeRate: 1.12, date: '2026-03-01', status: 'paid' }] as never, bills: [] });
    const view = render(<CurrenciesSettings />);
    const inUseTable = screen.getByRole('table', { name: 'Currencies used besides USD' });
    const eur = within(inUseTable).getByRole('rowheader', { name: 'EUR' });
    assert.match(eur.parentElement!.textContent || '', /EUR101\.12 on/);
    assert.equal(screen.queryByText(/revalu/i), null, 'nothing open: no revaluation');
    view.unmount();
    useLedgerStore.setState({ invoices: [], bills: [] });
    render(<CurrenciesSettings />);
    assert.ok(screen.getByText(/No invoice or bill uses another currency yet/));
  });

  test('the searchable ISO reference shows all codes, symbols, and exact minor-unit digits', () => {
    stubFetch(404);
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('bills', 'invoices');
    useLedgerStore.setState({ invoices: [], bills: [] });
    render(<CurrenciesSettings />);
    const tableName = 'ISO 4217 currency codes, names, symbols and minor-unit digits';
    const table = screen.getByRole('table', { name: tableName });
    assert.equal(within(table).getAllByRole('row').length - 1, 179);
    const row = (code: string) => within(table).getAllByRole('row').find(candidate => within(candidate).queryByRole('rowheader')?.textContent === code)!;
    const cells = (code: string) => within(row(code)).getAllByRole('cell').map(cell => cell.textContent);
    assert.deepEqual(cells('USD'), ['US Dollar', '$', '2', '840']);
    assert.deepEqual(cells('JPY'), ['Yen', '¥', '0', '392']);
    assert.deepEqual(cells('KWD'), ['Kuwaiti Dinar', 'KD', '3', '414']);
    assert.deepEqual(cells('CLF'), ['Unidad de Fomento', 'CLF', '4', '990']);
    assert.deepEqual(cells('XDR'), ['SDR (Special Drawing Right)', 'XDR', 'N.A.', '960']);

    fireEvent.change(screen.getByLabelText('Search by code, name or symbol'), { target: { value: '₪' } });
    const filtered = screen.getByRole('table', { name: tableName });
    assert.equal(within(filtered).getAllByRole('row').length, 2);
    assert.equal(within(filtered).getByRole('rowheader', { name: 'ILS' }).textContent, 'ILS');
    assert.equal(within(filtered).queryByRole('rowheader', { name: 'USD' }), null);
    fireEvent.change(screen.getByLabelText('Search by code, name or symbol'), { target: { value: 'Caribbean' } });
    assert.ok(within(screen.getByRole('table', { name: tableName })).getByRole('rowheader', { name: 'XCG' }));
    fireEvent.change(screen.getByLabelText('Search by code, name or symbol'), { target: { value: 'not a currency' } });
    assert.ok(screen.getByText('No ISO 4217 currencies match this search.'));
  });

  test('an open invoice in another currency: the month-end revaluation is here', () => {
    stubFetch(404);
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('bills', 'invoices');
    useLedgerStore.setState({ invoices: [{ id: 'i1', currency: 'EUR', exchangeRate: 1.1, date: '2026-03-01', status: 'sent', amountCents: 1000 }] as never, bills: [] });
    render(<CurrenciesSettings />);
    assert.ok(screen.getByText('Revalue open foreign invoices and bills'));
  });
});
