/**
 * Acting on many invoices or bills at once (K-06): pay them in full (one payment per customer or
 * vendor) and email invoices; drafts, voided, paid and other-currency documents are left out with
 * the reason, and one refusal doesn't stop the others.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BulkPaymentDialog from '../components/ui/BulkPaymentDialog';
import { paymentPlan, sendPlan, type BulkDocument } from '../lib/bulkDocuments';
import { emailInvoices } from '../services/bulkDocumentActions';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';

const inv = (id: string, over: Partial<BulkDocument> = {}): BulkDocument =>
  ({ id, number: id.toUpperCase(), status: 'sent', customerId: 'acme', customerName: 'Acme', amountCents: 10000, ...over });

const invoices = [
  inv('inv-1'),
  inv('inv-2', { amountCents: 5000, amountPaidCents: 2000 }),
  inv('inv-3', { customerId: 'beta', customerName: 'Beta', amountCents: 7000, depositCents: 1000 }),
  inv('inv-4', { status: 'draft' }),
  inv('inv-5', { status: 'void' }),
  inv('inv-6', { status: 'paid', amountPaidCents: 10000 }),
  inv('inv-7', { currency: 'EUR', exchangeRate: 1.1 }),
];

describe('Which documents are paid or sent', () => {
  test('one payment per customer, each invoice paid in what is still due', () => {
    const { payments, skipped } = paymentPlan(invoices, 'invoice', 'USD');
    assert.deepEqual(payments.map(p => [p.partyId, p.amountCents, p.allocations.map(a => [a.documentId, a.amountCents])]), [
      ['acme', 13000, [['inv-1', 10000], ['inv-2', 3000]]],
      ['beta', 6000, [['inv-3', 6000]]],
    ]);
    assert.deepEqual(skipped.map(s => [s.label, s.reason]), [
      ['INV-4', "a draft invoice isn't in the books yet"],
      ['INV-5', 'the invoice is void'],
      ['INV-6', 'nothing is due'],
      ['INV-7', 'it is in EUR: record it from the invoice'],
    ]);
  });

  test('bills: by vendor, labelled by the vendor\'s number', () => {
    const bills: BulkDocument[] = [{ id: 'b1', billNumber: 'V-77', status: 'open', vendorId: 'paper', vendorName: 'Paper Co', amountCents: 2500 }, { id: 'b2', status: 'open', amountCents: 100 }];
    const { payments, skipped } = paymentPlan(bills, 'bill', 'USD');
    assert.deepEqual(payments.map(p => [p.partyName, p.amountCents, p.allocations.map(a => [a.label, a.documentType])]), [['Paper Co', 2500, [['V-77', 'bill']]]]);
    assert.deepEqual(skipped.map(s => s.reason), ['no vendor']);
  });

  test('only issued invoices are emailed', () => {
    const { send, skipped } = sendPlan(invoices);
    assert.deepEqual(send.map(i => i.id), ['inv-1', 'inv-2', 'inv-3', 'inv-6', 'inv-7']);
    assert.deepEqual(skipped.map(s => s.label), ['INV-4', 'INV-5']);
  });
});

describe('Paying many at once', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts: [
      makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash', role: 'cash' }),
      makeChartAccount({ id: 'old', code: '1001', name: 'Old bank', type: 'asset', category: 'Cash', role: 'cash', isArchived: true }),
      makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'revenue', category: 'Income' }),
    ] });
  });
  afterEach(() => cleanup());

  test('records one payment per customer into the chosen bank account and reports the invoices paid', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success' });
    const done: string[][] = [];
    let closed = false;
    render(<BulkPaymentDialog side="invoice" documents={invoices} onClose={() => { closed = true; }} onDone={ids => done.push(ids)} />);
    assert.deepEqual([...(screen.getByLabelText('Into bank account') as HTMLSelectElement).options].map(o => o.value), ['bank'], 'bank accounts only, not archived ones');
    assert.ok(screen.getByText(/Left out: INV-4/));
    assert.ok(screen.getByText('Total $190.00'));
    fireEvent.change(screen.getByLabelText('Payment date'), { target: { value: '2026-10-04' } });
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'check' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record 2 payments' })); });
    await waitFor(() => assert.equal(done.length, 1));
    assert.deepEqual(calls.map(c => [c.url, c.method]), [['/api/v1/payments', 'POST'], ['/api/v1/payments', 'POST']]);
    const first = calls[0].body as Record<string, unknown>;
    assert.deepEqual([first.workspaceId, first.customerId, first.vendorId, first.amountCents, first.cashAccountId, first.paymentDate, first.paymentMethod],
      ['component-workspace', 'acme', undefined, 13000, 'bank', '2026-10-04', 'check']);
    assert.deepEqual(first.allocations, [{ documentId: 'inv-1', documentType: 'invoice', amountCents: 10000 }, { documentId: 'inv-2', documentType: 'invoice', amountCents: 3000 }]);
    assert.deepEqual(done[0], ['inv-1', 'inv-2', 'inv-3']);
    assert.equal(closed, true);
  });

  test('a refused payment is reported and the dialog stays open; the others are still recorded', async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      return body.customerId === 'acme'
        ? new Response(JSON.stringify({ message: 'This period is locked' }), { status: 400 })
        : new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    }) as typeof fetch;
    const done: string[][] = [];
    let closed = false;
    render(<BulkPaymentDialog side="invoice" documents={invoices} onClose={() => { closed = true; }} onDone={ids => done.push(ids)} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record 2 payments' })); });
    await waitFor(() => assert.equal(done.length, 1));
    assert.equal(bodies.length, 2);
    assert.deepEqual(done[0], ['inv-3']);
    assert.equal(closed, false);
  });

  test('bills are paid from the bank account to each vendor', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success' });
    render(<BulkPaymentDialog side="bill" documents={[{ id: 'b1', billNumber: 'V-77', status: 'open', vendorId: 'paper', vendorName: 'Paper Co', amountCents: 2500 }]} onClose={() => {}} onDone={() => {}} />);
    assert.ok(screen.getByLabelText('From bank account'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record 1 payment' })); });
    await waitFor(() => assert.equal(calls.length, 1));
    const body = calls[0].body as Record<string, unknown>;
    assert.deepEqual([body.vendorId, body.customerId, body.amountCents], ['paper', undefined, 2500]);
    assert.deepEqual(body.allocations, [{ documentId: 'b1', documentType: 'bill', amountCents: 2500 }]);
  });
});

test('emailing invoices: each one separately; a missing address is reported, the rest are sent', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    urls.push(String(url));
    return String(url).endsWith('inv-2')
      ? new Response(JSON.stringify({ message: 'The customer has no email address' }), { status: 400 })
      : new Response(JSON.stringify({ status: 'success', to: 'ap@acme.test' }), { status: 200 });
  }) as typeof fetch;
  const { sent, failed } = await emailInvoices([inv('inv-1'), inv('inv-2')], 'ws 1');
  assert.deepEqual(urls, ['/api/v1/workspaces/ws%201/emails/invoices/inv-1', '/api/v1/workspaces/ws%201/emails/invoices/inv-2']);
  assert.deepEqual(sent, [{ id: 'inv-1', label: 'INV-1', to: 'ap@acme.test' }]);
  assert.deepEqual(failed, [{ id: 'inv-2', label: 'INV-2', message: 'The customer has no email address' }]);
});
