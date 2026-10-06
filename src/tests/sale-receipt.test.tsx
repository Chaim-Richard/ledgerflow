/**
 * Sale receipts (K-03): a sale paid on the spot. The invoice form in receipt mode asks where the money
 * went (Undeposited Funds first, so "Make deposit" can take it to the bank) and how; it saves an issued
 * invoice due on receipt, marked as a receipt, and its payment is recorded at once through the
 * server's payments; if that fails the invoice stays open and says so. The PDF is titled as a receipt.
 */
import { stubFetch, stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvoiceModal, { type ReceiptPayment } from '../components/sales/InvoiceModal';
import { recordReceiptPayment } from '../services/receiptActions';
import { layoutDocumentPdf } from '../server/services/pdfService';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Invoice, Workspace } from '../types';
import { makeChartAccount, makeCustomer } from './fixtures';

const customers = [makeCustomer({ id: 'c1', name: 'Acme Ltd' })];
const accounts = [
  makeChartAccount({ id: 'rev', name: 'Sales', type: 'income' }),
  makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'udf', code: '1050', name: 'Undeposited Funds', type: 'asset', category: 'Current Assets' }),
];

describe('The invoice form as a sale receipt', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({ inventory: [], taxRates: [], accounts });
  });
  afterEach(() => cleanup());

  test('asks where the money went (Undeposited Funds first) and saves an issued invoice due on receipt, with its payment', async () => {
    const saved: Array<Partial<Invoice> & { receiptPayment?: ReceiptPayment }> = [];
    render(<InvoiceModal isOpen receipt onClose={() => {}} onSave={inv => { saved.push(inv); }} customers={customers} accounts={accounts} initialInvoice={{ date: '2026-10-06', status: 'sent', amountCents: 0 }} />);
    assert.ok(screen.getByRole('heading', { name: 'New sale receipt' }));
    assert.equal((screen.getByLabelText('Paid into') as HTMLSelectElement).value, 'udf');
    assert.equal(screen.queryByText('Save Draft'), null, 'one way to save a receipt');
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Acme Ltd' } });
    fireEvent.change(screen.getByLabelText('Item / Description'), { target: { value: 'Haircut' } });
    fireEvent.change(screen.getByLabelText(/^Rate/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'cash' } });
    await act(async () => { fireEvent.click(screen.getByText('Save receipt')); });
    await waitFor(() => assert.equal(saved.length, 1));
    const inv = saved[0];
    assert.deepEqual([inv.status, inv.paymentTerms, inv.dueDate, inv.amountCents, inv.metadata?.saleReceipt], ['sent', 'due_on_receipt', '2026-10-06', 4000, true]);
    assert.deepEqual(inv.receiptPayment, { cashAccountId: 'udf', method: 'cash' });
  });

  test('a normal invoice has no receipt fields', () => {
    render(<InvoiceModal isOpen onClose={() => {}} onSave={() => {}} customers={customers} accounts={accounts} />);
    assert.equal(screen.queryByLabelText('Paid into'), null);
    assert.ok(screen.getByRole('heading', { name: 'New invoice' }));
  });
});

describe('The payment half', () => {
  afterEach(() => cleanup());
  const invoice = { id: 'i1', number: 'INV-7', date: '2026-10-06', customerId: 'c1', customerName: 'Acme Ltd', amountCents: 4000 };

  test('records the whole amount due as one payment for the invoice', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success', data: { paymentId: 'p' } });
    assert.equal(await recordReceiptPayment('w1', invoice, { cashAccountId: 'udf', method: 'cash' }), true);
    assert.deepEqual(calls.map(c => c.url), ['/api/v1/payments']);
    const body = calls[0].body as Record<string, unknown>;
    assert.deepEqual([body.amountCents, body.paymentDate, body.cashAccountId, body.paymentMethod, body.customerId, body.allocations],
      [4000, '2026-10-06', 'udf', 'cash', 'c1', [{ documentId: 'i1', documentType: 'invoice', amountCents: 4000 }]]);
  });

  test('when the payment is refused the invoice stays open and it says so', async () => {
    stubFetchWithBodies(409, { status: 'error', message: 'Period Locked' });
    assert.equal(await recordReceiptPayment('w1', invoice, { cashAccountId: 'udf', method: 'cash' }), false);
  });
});

describe('The receipt PDF', () => {
  test('titled SALES RECEIPT, with no pay-now code', () => {
    const doc = { number: 'INV-7', amountCents: 4000, items: [{ description: 'Haircut', quantity: 1, rateCents: 4000, amountCents: 4000 }] };
    const options = { paymentUrl: 'https://pay.example/i/t' };
    const receipt = layoutDocumentPdf('invoice', { ...doc, metadata: { saleReceipt: true } }, {}, options);
    assert.equal(receipt.title, 'SALES RECEIPT');
    assert.equal(receipt.qrUrl, undefined);
    assert.equal(layoutDocumentPdf('invoice', doc, {}, options).title, 'INVOICE');
  });
});
