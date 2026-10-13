/**
 * A-54 screen: the use-tax review. Hand-checked from the loaded bills: choosing Texas lists the
 * bill with no sales tax and its $62.50 estimate at 6.25%, counts the bill that already carries tax
 * as skipped, refuses a no-sales-tax state in plain words, and asks for a state before reviewing.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import UseTaxReportView from '../components/reporting/UseTaxReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';

const bills = [
  { id: 'b1', number: 'INV-9', vendorName: 'Remote Vendor', date: '2026-05-01', status: 'approved', amountCents: 100_000, splits: [{ amountCents: 100_000, itemId: 'i-office' }] },
  { id: 'b2', number: 'BILL-4', vendorName: 'Local Co', date: '2026-06-01', status: 'approved', amountCents: 10_825, taxAmountCents: 825, splits: [{ amountCents: 10_000, itemId: 'i-office' }] },
];
const inventory = [{ id: 'i-office', name: 'Office supplies', productTaxCategory: 'general' }];

describe('Use tax review screen', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ isGuest: true, user: null });
    useDataNeedsStore.setState({ loaded: { bills: true, inventory: true } as never });
    useLedgerStore.setState({ bills: bills as never, inventory: inventory as never, baseCurrency: 'USD' });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('asks for the state first, and never assumes the workspace is in one', () => {
    render(<UseTaxReportView endDate="2026-10-13" />);
    assert.match(screen.getByText(/not assumed/).textContent || '', /use tax follows where the goods are received or used/);
    assert.match(screen.getByRole('note').textContent || '', /Choose the state the purchases are used in/);
    assert.equal(screen.queryByRole('table'), null);
  });

  test('Texas: the uncollected bill is estimated at 6.25% and the taxed bill is counted as skipped', () => {
    render(<UseTaxReportView endDate="2026-10-13" />);
    fireEvent.change(screen.getByLabelText('Use tax state'), { target: { value: 'TX' } });
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    assert.equal(rows.length, 2, 'only the bill with no tax is reviewed');
    assert.match(rows[1].textContent || '', /INV-9/);
    assert.match(rows[1].textContent || '', /Remote Vendor/);
    assert.match(rows[1].textContent || '', /6\.25%/);
    assert.match(rows[1].textContent || '', /62\.50/, '$1,000.00 × 6.25% = $62.50');
    assert.ok(screen.getAllByText(/Estimated use tax/).some(el => /62\.50/.test(el.textContent || '')), 'the total says the estimate');
    assert.match(screen.getByText(/Skipped:/).textContent || '', /1 bill\(s\) already carry sales tax/);
  });

  test('a no-sales-tax state is not offered, so it can never be reviewed at a pretended zero', () => {
    render(<UseTaxReportView endDate="2026-10-13" />);
    const select = screen.getByLabelText('Use tax state');
    const options = within(select).getAllByRole('option').map(o => o.textContent || '');
    for (const noTax of ['AK', 'DE', 'MT', 'NH', 'OR']) {
      assert.ok(!options.some(o => o.startsWith(`${noTax} —`)), `${noTax} has no state sales tax and is not offered`);
    }
    assert.ok(options.some(o => o.startsWith('TX —')), 'the taxing jurisdictions are offered');
    assert.equal(options.length, 47, 'the placeholder plus 46 taxing jurisdictions');
    assert.match(screen.getByText(/no state sales tax/).textContent || '', /AK, DE, MT, NH, OR/, 'and the screen says which states those are');
  });
});
