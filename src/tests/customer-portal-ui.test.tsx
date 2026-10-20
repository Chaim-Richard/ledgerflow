/**
 * The customer portal page (K-27): the customer's invoices with what is still due and "View and pay";
 * a dead link says so with a heading. The link control on the customer's page makes, copies and turns
 * off the link; a viewer without a link sees nothing.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomerPortalPage from '../components/sales/CustomerPortalPage';
import CustomerPortalLink from '../components/sales/CustomerPortalLink';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeCustomer } from './fixtures';
import { getSupabase } from '../lib/db/client';

const realFetch = globalThis.fetch;
const answer = (status: number, body: unknown) => {
  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method || 'GET' });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return calls;
};

describe('Customer portal', () => {
  afterEach(async () => { cleanup(); globalThis.fetch = realFetch; window.history.pushState({}, '', '/'); await getSupabase().auth.dispose(); });

  test('the page lists the invoices, what is due, and View and pay', async () => {
    window.history.pushState({}, '', '/c/cp_abc');
    const calls = answer(200, { business: 'Portal Co', customer: 'Acme', currency: 'USD', owedCents: 60000, invoices: [
      { number: 'INV-1', date: '2026-09-01', dueDate: '2026-09-30', totalCents: 50000, dueCents: 40000, currency: 'USD', status: 'overdue', payPath: '/i/pay_1' },
      { number: 'INV-0', date: '2026-08-01', dueDate: '2026-08-31', totalCents: 7000, dueCents: 0, currency: 'USD', status: 'paid', payPath: '/i/pay_0' },
    ] });
    render(<CustomerPortalPage />);
    assert.ok(await screen.findByRole('heading', { level: 1, name: 'Invoices for Acme' }));
    assert.equal(calls[0].url, '/api/v1/invoices/public/portal/cp_abc');
    assert.match(screen.getByText(/Still to pay:/).textContent || '', /\$600\.00/);
    assert.equal(screen.getByRole('link', { name: 'View and pay invoice INV-1' }).getAttribute('href'), '/i/pay_1');
    assert.ok(screen.getByRole('link', { name: 'View invoice INV-0' }));
    assert.ok(screen.getByText('Overdue'));
  });

  test('a link that no longer works says so', async () => {
    window.history.pushState({}, '', '/c/cp_old');
    answer(404, { message: 'This link is not valid any more. Ask for a new one.' });
    render(<CustomerPortalPage />);
    assert.match((await screen.findByRole('alert')).textContent || '', /not valid any more/);
    assert.ok(screen.getByRole('heading', { level: 1 }));
  });

  test('on the customer page: make the link, then turn it off', async () => {
    setComponentWorkspace('bookkeeper');
    const acme = makeCustomer({ id: 'c1', name: 'Acme' });
    useLedgerStore.setState({ customers: [acme] });
    const calls = answer(200, { status: 'success', token: 'cp_new' });
    const { rerender } = render(<CustomerPortalLink customer={acme} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make a portal link' })); });
    await waitFor(() => assert.equal(useLedgerStore.getState().customers[0].portalToken, 'cp_new'));
    assert.deepEqual([calls[0].url, calls[0].method], ['/api/v1/workspaces/component-workspace/customers/c1/portal-link', 'POST']);
    rerender(<CustomerPortalLink customer={useLedgerStore.getState().customers[0]} />);
    assert.match((screen.getByLabelText('Portal link') as HTMLInputElement).value, /\/c\/cp_new$/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn off' })); });
    await waitFor(() => assert.equal(useLedgerStore.getState().customers[0].portalToken, null));
    assert.equal(calls[1].method, 'DELETE');
  });

  test('a viewer without a link sees nothing', () => {
    setComponentWorkspace('viewer');
    const { container } = render(<CustomerPortalLink customer={makeCustomer({ id: 'c1', name: 'Acme' })} />);
    assert.equal(container.textContent, '');
  });
});
