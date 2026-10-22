import { inlineEditName } from './helpers/inlineEditName';
/**
 * Credit notes and vendor credits (I-22): numbers come from the workspace's series (they were
 * random and could repeat); number, reason and (while unused) date change in place; a viewer
 * changes nothing.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CreditNotesView from '../components/finance/CreditNotesView';
import { creditDateEditable, duplicateNumber } from '../lib/creditEdits';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import type { CreditNote, Customer } from '../types';
import { makeChartAccount } from './fixtures';

const note = (over: Partial<CreditNote>): CreditNote => ({
  id: 'cn1', uid: 'test-user', workspaceId: 'component-workspace', customerId: 'acme', customerName: 'Acme', number: 'CN-2026-0001',
  amountCents: 5000, remainingCents: 5000, date: '2026-10-01', reason: 'Returned goods', status: 'open', createdAt: '2026-10-01T00:00:00Z', ...over,
} as CreditNote);
const unused = note({});
const used = note({ id: 'cn2', number: 'CN-2026-0002', remainingCents: 2000, status: 'partially_applied', reason: 'Price adjustment' });

// a credit note is saved through the server's posting route (L94-STEP2B: /api/v1/documents/creditNotes/:id/post)
let calls: { url: string; body: Record<string, unknown> }[] = [];
let numberStatus = 200;
beforeEach(() => {
  calls = [];
  numberStatus = 200;
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('bills', 'creditNotes', 'customers', 'invoices', 'vendorCredits', 'vendors');
  useLedgerStore.setState({ creditNotes: [unused, used], vendorCredits: [], invoices: [], bills: [], vendors: [], accounts: [
    makeChartAccount({ id: 'ar', code: '1100', name: 'Accounts Receivable', type: 'asset', category: 'Receivables', role: 'ar' }),
    makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' }),
  ],
    customers: [{ id: 'acme', name: 'Acme' } as Customer] });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body || '{}')) });
    if (url.endsWith('/next-number')) {
      return numberStatus === 200
        ? new Response(JSON.stringify({ number: 'CN-2026-0003' }), { status: 200 })
        : new Response(JSON.stringify({ message: 'Forbidden' }), { status: numberStatus });
    }
    return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});
afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

test('what can change: the date only while nothing was used; numbers must not repeat', () => {
  assert.deepEqual([creditDateEditable(unused), creditDateEditable(used), creditDateEditable(note({ status: 'void' }))], [true, false, false]);
  assert.equal(duplicateNumber([unused, used], 'cn1', ' cn-2026-0002 '), 'cn-2026-0002 is already used');
  assert.equal(duplicateNumber([unused, used], 'cn1', 'CN-2026-0001'), null, 'its own number is fine');
  assert.equal(duplicateNumber([unused], 'cn1', '  '), 'Enter a number');
});

test('a new credit note takes the next number of the series; without one nothing is saved', async () => {
  render(<CreditNotesView />);
  const fill = () => {
    fireEvent.click(screen.getByRole('button', { name: 'New Credit Note' }));
    fireEvent.change(screen.getByLabelText('Select Customer'), { target: { value: 'acme' } });
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '12.50' } });
  };
  numberStatus = 403;
  fill();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save & Post' })); });
  assert.deepEqual(calls.map(c => [c.url.replace(/.*\/workspaces/, ''), c.body.type]), [['/component-workspace/next-number', 'creditNote']]);
  assert.ok(screen.getByRole('button', { name: 'Save & Post' }), 'the form stays open');

  numberStatus = 200;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save & Post' })); });
  await waitFor(() => assert.ok(calls.some(c => c.url.includes('/documents/creditNotes/'))));
  assert.equal(calls.filter(c => c.url.endsWith('/next-number')).length, 2);
  const posted = JSON.stringify(calls.find(c => c.url.includes('/documents/creditNotes/'))?.body);
  assert.match(posted, /CN-2026-0003/);
  assert.doesNotMatch(posted, /CN-\d{4}"/, 'no random number');
});

test('number, reason and date change in place; the date stays fixed once the credit was used', async () => {
  render(<CreditNotesView />);
  assert.ok(screen.getByRole('button', { name: inlineEditName('Edit Date of credit note CN-2026-0001') }));
  assert.equal(screen.queryByRole('button', { name: inlineEditName('Edit Date of credit note CN-2026-0002') }), null);
  fireEvent.click(screen.getByRole('button', { name: inlineEditName('Edit Number of credit note CN-2026-0001') }));
  const box = screen.getByLabelText('Number of credit note CN-2026-0001');
  fireEvent.change(box, { target: { value: 'CN-2026-0002' } });
  await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }); });
  assert.match(screen.getByRole('alert').textContent || '', /CN-2026-0002 is already used/);
  assert.equal(calls.length, 0);
  fireEvent.keyDown(box, { key: 'Escape' });

  fireEvent.click(screen.getByRole('button', { name: inlineEditName('Edit Reason for credit note CN-2026-0001') }));
  fireEvent.change(screen.getByLabelText('Reason for credit note CN-2026-0001'), { target: { value: 'Damaged on arrival' } });
  await act(async () => { fireEvent.keyDown(screen.getByLabelText('Reason for credit note CN-2026-0001'), { key: 'Enter' }); });
  await waitFor(() => assert.ok(calls.some(c => c.url.includes('/documents/creditNotes/'))));
  assert.match(JSON.stringify(calls.find(c => c.url.includes('/documents/creditNotes/'))?.body), /Damaged on arrival/);

  cleanup();
  setComponentWorkspace('viewer');
  render(<CreditNotesView />);
  assert.equal(screen.queryByRole('button', { name: /^Edit / }), null);
  assert.equal(screen.queryByRole('button', { name: 'New Credit Note' }), null);
});
