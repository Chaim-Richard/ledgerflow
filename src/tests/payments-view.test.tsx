/** The Payments register (H-27): amounts in the payment's currency, allocations by document number. */
import { stubFetch } from './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import PaymentsView from '../components/finance/PaymentsView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeInvoice, makePayment } from './fixtures';

describe('Payments register', () => {
  afterEach(() => cleanup());

  test('a EUR payment shows in euros, and what it paid by invoice number', () => {
    stubFetch(404);
    useLedgerStore.setState({
      invoices: [makeInvoice({ id: 'abc123xyz', number: 'INV-5', currency: 'EUR' })],
      bills: [],
      customers: [],
      vendors: [],
      payments: [makePayment({ id: 'p1', direction: 'received', status: 'posted', amountCents: 12000, currency: 'EUR', date: '2026-05-01', allocations: [{ documentId: 'abc123xyz', documentType: 'invoice', amountCents: 12000 }] })],
    });
    render(<PaymentsView />);
    assert.ok(screen.getByText('+€120.00'));
    assert.match(screen.getByText(/INV-5/).textContent || '', /invoice: INV-5 \(€120\.00\)/i);
  });
});
