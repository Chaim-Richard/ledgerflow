/**
 * A-56 screen: purchases from abroad. Hand-checked from the loaded bills and vendors: the German
 * vendor's tax-free ₪10,000.00 bill is listed with 18% and ₪1,800.00 of reference VAT, the Israeli
 * vendor's bill is not listed, and the vendor with no recorded country is counted for review rather
 * than assumed either way.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import ImportServicesReportView from '../components/reporting/ImportServicesReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const bills = [
  { id: 'b-de', number: 'R-2026-11', vendorId: 'v-de', vendorName: 'Berlin Software GmbH', date: '2026-05-01', status: 'approved', amountCents: 1_000_000, currency: 'ILS' },
  { id: 'b-il', number: 'BILL-7', vendorId: 'v-il', vendorName: 'Local Supplier', date: '2026-06-01', status: 'approved', amountCents: 500_000, currency: 'ILS' },
  { id: 'b-plain', number: 'X-1', vendorId: 'v-plain', vendorName: 'Somewhere Inc', date: '2026-07-01', status: 'approved', amountCents: 300_000, currency: 'ILS' },
];
const vendors = [
  { id: 'v-de', name: 'Berlin Software GmbH', metadata: { taxPlace: { country: 'DE' } } },
  { id: 'v-il', name: 'Local Supplier', metadata: { taxPlace: { country: 'IL' } } },
  { id: 'v-plain', name: 'Somewhere Inc' },
];

describe('Purchases from abroad screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null });
    useDataNeedsStore.setState({ loaded: { bills: true, vendors: true } as never });
    useLedgerStore.setState({ bills: bills as never, vendors: vendors as never, baseCurrency: 'ILS' });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('lists the foreign bill with the rate in force and its reference VAT, and counts the rest', () => {
    render(<ImportServicesReportView endDate="2026-10-13" />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    assert.equal(rows.length, 2, 'only the German vendor’s bill');
    assert.match(rows[1].textContent || '', /R-2026-11/);
    assert.match(rows[1].textContent || '', /Berlin Software GmbH/);
    assert.match(rows[1].textContent || '', /DE/);
    assert.match(rows[1].textContent || '', /18%/, 'the rate in force on the bill’s date');
    assert.match(rows[1].textContent || '', /1,800\.00/, '₪10,000.00 × 18% = ₪1,800.00');
    assert.match(rows[1].textContent || '', /customs at the import, or self-assessment/, 'the screen never decides goods or services');
    const summary = screen.getByText(/bill\(s\) from vendors recorded abroad/);
    assert.match(summary.textContent || '', /1 bill\(s\)/);
    assert.match(screen.getByText(/Not listed:/).textContent || '', /1 bill\(s\) from vendors recorded in Israel/);
    assert.match(screen.getByText(/Not listed:/).textContent || '', /whose vendor's country is not recorded/, 'the unknown-country bill is counted for review');
  });
});
