/**
 * A checklist per client on Month-End Close (BD-10): the steps due that month are in the checklist
 * and signed off through the server; an accountant adds a step, copies another client's steps and
 * saves the list; a bookkeeper sees the steps but has nothing to edit them with.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MonthEndCloseView from '../components/ledger/MonthEndCloseView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { getSupabase } from '../lib/db/client';
import type { CloseStep } from '../lib/closeSteps';

type Call = { url: string; method: string; body: Record<string, unknown> };
const steps: CloseStep[] = [
  { id: 'cs_payroll01', title: 'Get the payroll report', frequency: 'monthly' },
  { id: 'cs_vatfile01', title: 'File the VAT return', frequency: 'yearly' },
];

describe('Month-End Close: this client\'s own steps', () => {
  let calls: Call[] = [];
  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      calls.push({ url, method: init?.method || 'GET', body });
      let answer: unknown = url.includes('/rest/v1/') ? [] : null;
      if (url.includes('/sign-off')) answer = { status: 'success', signOffs: { [body.itemId]: { by: 'test@example.test', at: '2026-10-06T10:00:00Z' } } };
      if (url.endsWith('/periods/close-steps')) answer = { status: 'success', closeSteps: (body.steps as CloseStep[]).map((s, i) => ({ id: s.id || `cs_saved0${i}`, title: s.title, frequency: s.frequency })) };
      return new Response(JSON.stringify(answer), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  const open = (role: 'accountant' | 'bookkeeper', extra: Array<Record<string, unknown>> = []) => {
    const ws = setComponentWorkspace(role);
    useAuthStore.setState({ workspaces: [{ ...ws, closeSteps: steps } as never, ...extra as never[]] });
    markComponentCollectionsLoaded('assets', 'bankLines', 'bills', 'invoices');
    render(<MonthEndCloseView />);
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-05' } });
  };

  test('the steps due that month are in the checklist and signed off through the server', async () => {
    open('bookkeeper');
    assert.ok(screen.getByText('Get the payroll report'));
    assert.equal(screen.queryByText('File the VAT return'), null, 'a year-end step is not due in May');
    assert.equal(screen.queryByRole('button', { name: /this client's steps/ }), null, 'a bookkeeper does not edit the steps');
    // the month's sign-offs are read first
    await waitFor(() => assert.ok(calls.some(c => c.url.includes('/rest/v1/periods') && c.url.includes('2026-05'))));
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign off: Get the payroll report' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.endsWith('/periods/2026-05/sign-off'))));
    assert.deepEqual(calls.find(c => c.url.endsWith('/sign-off'))!.body, { itemId: 'step:cs_payroll01', remove: false });
    assert.ok(await screen.findByRole('button', { name: 'Remove sign-off: Get the payroll report' }));

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-12' } });
    assert.ok(screen.getByText('File the VAT return'), 'due at the year end');
  });

  test('an accountant adds a step, copies another client\'s and saves the list', async () => {
    const other = { id: 'other-client', uid: 'test-user', name: 'Bakery Ltd', businessType: 'custom', createdAt: '2026-01-01', currency: 'USD',
      closeSteps: [{ id: 'cs_bakery001', title: 'Count the stock', frequency: 'monthly' }, { id: 'cs_bakery002', title: 'Get the payroll report', frequency: 'monthly' }] };
    open('accountant', [other]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit this client\'s steps' }));
    fireEvent.change(screen.getByLabelText('New step'), { target: { value: 'Ask for the loan statement' } });
    fireEvent.change(screen.getByLabelText('How often'), { target: { value: 'quarterly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
    fireEvent.change(screen.getByLabelText('Copy the steps of another client'), { target: { value: 'other-client' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove File the VAT return' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save steps' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.endsWith('/periods/close-steps') && c.method === 'PUT')));
    const sent = calls.find(c => c.url.endsWith('/periods/close-steps'))!.body.steps as Array<Record<string, unknown>>;
    assert.deepEqual(sent.map(s => [s.id, s.title, s.frequency]), [
      ['cs_payroll01', 'Get the payroll report', 'monthly'],
      [undefined, 'Ask for the loan statement', 'quarterly'],
      [undefined, 'Count the stock', 'monthly'],
    ], 'the payroll step the client already has is not copied twice');
    await waitFor(() => assert.ok(screen.getByText('Count the stock')));
    assert.equal((useAuthStore.getState().workspaces[0] as { closeSteps?: CloseStep[] }).closeSteps?.length, 3);
  });
});
