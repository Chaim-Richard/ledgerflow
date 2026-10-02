/**
 * The A/R and A/P aging screens (H-09, H-10): what is still owed per customer/vendor by days past
 * due, in the base currency, the same rule as the /aging API (L-159).
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ARAgingReportView from '../components/reporting/ARAgingReportView';
import APAgingReportView from '../components/reporting/APAgingReportView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { addToDateISO, getLocalDateISO } from '../lib/utils';
import { makeBill, makeCustomer, makeInvoice, makeVendor } from './fixtures';

/** today minus `days`, as YYYY-MM-DD */
const ago = (days: number) => addToDateISO(getLocalDateISO(), { days: -days });
const bodyRows = (name: RegExp) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1).map(r => r.textContent || '');

describe('aging screens', () => {
  beforeEach(() => {
    stubFetch(404);
    useLedgerStore.setState({
      customers: [makeCustomer({ id: 'a', name: 'Acme' }), makeCustomer({ id: 'b', name: 'Bob' })],
      vendors: [makeVendor({ id: 'v', name: 'Power Co' })],
      invoices: [
        makeInvoice({ id: 'i1', number: 'INV-1', customerId: 'a', amountCents: 50000, date: ago(10), dueDate: ago(-20), status: 'sent' }),
        makeInvoice({ id: 'i2', number: 'INV-2', customerId: 'a', amountCents: 20000, amountPaidCents: 5000, date: ago(75), dueDate: ago(45), status: 'partially_paid' }),
        makeInvoice({ id: 'i3', number: 'INV-3', customerId: 'b', amountCents: 10000, exchangeRate: 1.1, currency: 'EUR', date: ago(150), dueDate: ago(120), status: 'overdue' }),
        makeInvoice({ id: 'i4', customerId: 'b', amountCents: 99999, status: 'paid' }),
      ],
      bills: [makeBill({ id: 'b1', vendorId: 'v', amountCents: 30000, date: ago(40), dueDate: ago(10), status: 'approved' })],
    });
  });
  afterEach(() => cleanup());

  test('A/R: buckets by due date, part-payments taken off, foreign invoices in the base currency', () => {
    render(<ARAgingReportView />);
    const [acme, bob] = bodyRows(/Receivables aging/);
    assert.match(acme, /^Acme\$500\.00-\$150\.00--\$650\.00/);   // not yet due 500; 31-60 days 150 (200 - 50 paid)
    assert.match(bob, /^Bob----\$110\.00\$110\.00/);            // EUR 100 at 1.10, 120 days overdue
    assert.match(screen.getByText('Not yet due').parentElement!.textContent || '', /\$500\.00/);
  });

  test('A/R: the details open from the row button and say how late each invoice is', () => {
    render(<ARAgingReportView />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Acme' }));
    const dialog = screen.getByRole('dialog', { name: /Acme/ });
    assert.match(dialog.textContent || '', /INV-2.*45 days overdue/);
    assert.match(dialog.textContent || '', /INV-1.*Not yet due/);
  });

  test('A/P: bills the same way', () => {
    render(<APAgingReportView />);
    const [power] = bodyRows(/Payables aging/);
    assert.match(power, /^Power Co-\$300\.00---\$300\.00/);
  });
});
