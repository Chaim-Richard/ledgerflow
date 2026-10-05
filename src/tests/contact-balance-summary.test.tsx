/**
 * Contact Balance Summary (J-03): customers and vendors on one list; a business that is both is
 * one row (same email, or same name when one has no email), with the net of both balances.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { computeContactBalanceSummary } from '../server/reports/computeReports';
import type { CustomerBalanceSummaryRow, VendorBalanceSummaryRow } from '../server/reports/computeReports';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import ContactBalanceSummaryView from '../components/reporting/ContactBalanceSummaryView';
import { makeBill, makeCustomer, makeInvoice, makeVendor } from './fixtures';

const cust = (customerId: string, name: string, balanceCents: number, email?: string): CustomerBalanceSummaryRow =>
  ({ customerId, name, email, balanceCents, openInvoicesCount: 1, totalInvoicedCents: balanceCents, totalCreditNotesCents: 0, totalPaidCents: 0 });
const vend = (vendorId: string, name: string, balanceCents: number, email?: string): VendorBalanceSummaryRow =>
  ({ vendorId, name, email, balanceCents, openBillsCount: 1, totalBilledCents: balanceCents, totalVendorCreditsCents: 0, totalPaidCents: 0 });

describe('computeContactBalanceSummary', () => {
  test('one row for a business on both lists, by email or by name; the net is what they owe minus what you owe', () => {
    const rows = computeContactBalanceSummary(
      [cust('c1', 'Acme Ltd', 50000, 'billing@acme.test'), cust('c2', 'שלום בע״מ', 8000), cust('c3', 'Solo Customer', 3000, 'solo@x.test'), cust('c4', 'Twin', 100, 'a@twin.test')],
      [vend('v1', 'ACME Limited', 20000, 'Billing@Acme.test'), vend('v2', '  שלום   בע״מ ', 12000, 'shalom@x.test'), vend('v3', 'Only Vendor', 700), vend('v4', 'Twin', 200, 'b@twin.test')],
    );
    const byName = Object.fromEntries(rows.map(r => [r.name, r]));
    assert.deepEqual(
      { c: byName['Acme Ltd'].customerId, v: byName['Acme Ltd'].vendorId, net: byName['Acme Ltd'].netCents },
      { c: 'c1', v: 'v1', net: 30000 }, // same email, different spelling of the name
    );
    // Hebrew name with extra spaces, customer without email: same business
    assert.deepEqual({ v: byName['שלום בע״מ'].vendorId, net: byName['שלום בע״מ'].netCents, email: byName['שלום בע״מ'].email }, { v: 'v2', net: -4000, email: 'shalom@x.test' });
    // same name but two different emails: two businesses
    assert.equal(rows.filter(r => r.name === 'Twin').length, 2);
    assert.deepEqual({ r: byName['Only Vendor'].receivableCents, p: byName['Only Vendor'].payableCents, net: byName['Only Vendor'].netCents }, { r: 0, p: 700, net: -700 });
    assert.equal(rows[0].name, 'Acme Ltd'); // largest net first
    assert.equal(rows.length, 6);
  });
});

describe('Contact Balance Summary screen', () => {
  afterEach(() => cleanup());

  test('lists both sides from the books, as of the report date', () => {
    useAuthStore.setState({ isGuest: true, user: null });
    useLedgerStore.setState({
      customers: [makeCustomer({ id: 'c1', name: 'Acme Ltd', email: 'ap@acme.test' })],
      vendors: [makeVendor({ id: 'v1', name: 'Acme Ltd', email: 'ap@acme.test' }), makeVendor({ id: 'v2', name: 'Paper Co' })],
      invoices: [makeInvoice({ id: 'i1', customerId: 'c1', status: 'sent', date: '2026-03-01', amountCents: 50000 }), makeInvoice({ id: 'i2', customerId: 'c1', status: 'sent', date: '2026-05-01', amountCents: 99900 })],
      bills: [makeBill({ id: 'b1', vendorId: 'v1', status: 'approved', date: '2026-03-02', amountCents: 20000 }), makeBill({ id: 'b2', vendorId: 'v2', status: 'approved', date: '2026-03-03', amountCents: 1500 })],
      payments: [], creditNotes: [], vendorCredits: [],
    });
    render(<ContactBalanceSummaryView asOfDate="2026-03-31" />);
    const acme = screen.getByText('Acme Ltd').closest('tr')!;
    assert.match(acme.textContent || '', /Customer & Vendor/);
    assert.match(acme.textContent || '', /\$500\.00.*\$200\.00.*\$300\.00/); // the May invoice is after the date
    const paper = screen.getByText('Paper Co').closest('tr')!;
    assert.match(within(paper).getAllByRole('cell').at(-1)!.textContent || '', /-\$15\.00|\(\$15\.00\)|−\$15\.00/);
  });
});
