/**
 * Advance payments on the contact page (BE-12, K-18): a payment's unapplied part is listed with
 * "Apply", which fills the open invoices/bills oldest first; the amounts can be changed, more than is
 * left (or open) is refused on the screen, and the server is asked once.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import UnappliedPayments from '../components/common/UnappliedPayments';
import { applicableDocuments, suggestApplication, unappliedPayments, type AdvancePayment } from '../lib/advancePayments';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';

const pay = (id: string, over: Record<string, unknown> = {}): AdvancePayment =>
  ({ id, number: id.toUpperCase(), date: '2026-09-01', direction: 'received', contactId: 'acme', currency: 'USD', unappliedCents: 30000, status: 'posted', ...over }) as AdvancePayment;
const inv = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, number: id.toUpperCase(), customerId: 'acme', date: '2026-09-01', dueDate: '2026-09-30', currency: 'USD', amountCents: 20000, amountPaidCents: 0, status: 'sent', ...over });

describe('Which payments and documents', () => {
  test('only the party’s payments with money left, oldest first; void and fully applied ones are not listed', () => {
    const payments = [pay('p2', { date: '2026-09-10' }), pay('p1'), pay('void', { status: 'void' }), pay('done', { unappliedCents: 0 }), pay('other', { contactId: 'beta' }), pay('made', { direction: 'made' })];
    assert.deepEqual(unappliedPayments(payments, 'acme', 'received').map(p => p.id), ['p1', 'p2']);
    assert.deepEqual(unappliedPayments([pay('v', { direction: 'made', contactId: null, vendorId: 'paper' })], 'paper', 'made').map(p => p.id), ['v'], 'older payments name the vendor only in vendorId');
  });

  test('open documents of the party in the payment’s currency, oldest due first, with what is still due', () => {
    const docs = [inv('later', { dueDate: '2026-10-30' }), inv('first', { amountPaidCents: 5000 }), inv('draft', { status: 'draft' }), inv('void', { status: 'void' }),
      inv('paid', { amountPaidCents: 20000 }), inv('eur', { currency: 'EUR' }), inv('beta', { customerId: 'beta' }), inv('nocur', { currency: undefined, dueDate: '2026-11-30' })];
    assert.deepEqual(applicableDocuments(pay('p'), docs, 'acme', 'USD').map(d => [d.doc.id, d.dueCents]), [['first', 15000], ['later', 20000], ['nocur', 20000]]);
  });

  test('the unapplied amount fills documents in order, never more than each one’s due', () => {
    assert.deepEqual(suggestApplication(30000, [{ id: 'a', dueCents: 15000 }, { id: 'b', dueCents: 20000 }, { id: 'c', dueCents: 5000 }]), { a: 15000, b: 15000 });
    assert.deepEqual(suggestApplication(5000, [{ id: 'a', dueCents: 0 }, { id: 'b', dueCents: 9000 }]), { b: 5000 });
    assert.deepEqual(suggestApplication(0, [{ id: 'a', dueCents: 100 }]), {});
  });
});

describe('The panel on the contact page', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('payments', 'invoices', 'bills');
    useLedgerStore.setState({ payments: [pay('p1')] as never, invoices: [inv('a', { amountPaidCents: 5000 }), inv('b', { dueDate: '2026-10-15' })] as never, bills: [] });
  });
  afterEach(() => cleanup());

  test('Apply fills oldest first and sends one request with those amounts; the panel goes when nothing is left', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success', data: { unappliedCents: 0 } });
    render(<UnappliedPayments side="customer" partyId="acme" />);
    assert.ok(screen.getByText('Unapplied: $300.00'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to invoices' }));
    assert.equal((screen.getByLabelText(/^A · due 2026-09-30/) as HTMLInputElement).value, '150.00');
    assert.equal((screen.getByLabelText(/^B · due 2026-10-15/) as HTMLInputElement).value, '150.00');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply $300.00' })); });
    const applied = calls.filter(c => c.url.includes('/apply'));
    assert.equal(applied.length, 1);
    assert.equal(applied[0].url, '/api/v1/payments/p1/apply');
    const body = applied[0].body as { workspaceId: string; allocations: unknown[] };
    assert.equal(body.workspaceId, 'component-workspace');
    assert.deepEqual(body.allocations, [{ documentId: 'a', documentType: 'invoice', amountCents: 15000 }, { documentId: 'b', documentType: 'invoice', amountCents: 15000 }]);
    assert.equal(screen.queryByText(/Unapplied:/), null, 'nothing is left on the payment');
  });

  test('more than is left on the payment, or open on an invoice, cannot be applied', () => {
    const calls = stubFetchWithBodies(200, {});
    render(<UnappliedPayments side="customer" partyId="acme" />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to invoices' }));
    fireEvent.change(screen.getByLabelText(/^B · due/), { target: { value: '200' } });
    assert.match(screen.getByRole('alert').textContent || '', /more than the \$300\.00 left/);
    assert.equal((screen.getByRole('button', { name: 'Apply $350.00' }) as HTMLButtonElement).disabled, true);
    fireEvent.change(screen.getByLabelText(/^A · due/), { target: { value: '160' } });
    fireEvent.change(screen.getByLabelText(/^B · due/), { target: { value: '0' } });
    assert.match(screen.getByRole('alert').textContent || '', /More than is open on that invoice/);
    assert.equal(calls.filter(c => c.url.includes('/apply')).length, 0);
  });

  test('a viewer sees the amount but no Apply; with no unapplied money there is no panel', () => {
    setComponentWorkspace('viewer');
    const { unmount } = render(<UnappliedPayments side="customer" partyId="acme" />);
    assert.ok(screen.getByText('Unapplied: $300.00'));
    assert.equal(screen.queryByRole('button', { name: /Apply/ }), null);
    unmount();
    const { container } = render(<UnappliedPayments side="customer" partyId="beta" />);
    assert.equal(container.innerHTML, '');
  });

  test('a vendor prepayment is applied to that vendor’s bills', async () => {
    useLedgerStore.setState({ payments: [pay('v1', { direction: 'made', contactId: 'paper', unappliedCents: 4000 })] as never,
      bills: [{ id: 'bill1', number: 'B-1', vendorId: 'paper', date: '2026-09-02', dueDate: '2026-09-20', amountCents: 10000, status: 'open', currency: 'USD' }] as never });
    const calls = stubFetchWithBodies(200, { status: 'success', data: { unappliedCents: 0 } });
    render(<UnappliedPayments side="vendor" partyId="paper" />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to bills' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply $40.00' })); });
    assert.deepEqual((calls.find(c => c.url.includes('/apply'))?.body as { allocations: unknown[] }).allocations, [{ documentId: 'bill1', documentType: 'bill', amountCents: 4000 }]);
  });
});
