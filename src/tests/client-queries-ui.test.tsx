/**
 * Questions about entries on screen (BD-07): the Questions screen lists the waiting ones first with
 * a count per filter, answers through the server, and offers Close only to the asker, owners and
 * accountants. In the entry's window a bookkeeper asks about the entry; a viewer with nothing asked
 * sees no box at all.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ClientQueriesView from '../components/ledger/ClientQueriesView';
import EntryQuestions from '../components/transactions/EntryQuestions';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';

type Call = { url: string; method: string; body: Record<string, unknown> };
const row = (id: string, status: string, askedBy: string, updatedAt: string, description: string) => ({
  id, updated_at: updatedAt,
  data: {
    workspaceId: 'component-workspace', transactionId: `tx-${id}`, status, askedBy, askedByEmail: `${askedBy}@example.test`, askedAt: updatedAt, updatedAt,
    entry: { date: '2026-09-14', description, amountCents: 34000, currency: 'USD' },
    messages: [{ uid: askedBy, email: `${askedBy}@example.test`, text: `What was ${description}?`, at: updatedAt }],
  },
});

describe('Questions about entries', () => {
  let calls: Call[] = [];
  let rows: ReturnType<typeof row>[] = [];
  beforeEach(() => {
    calls = [];
    rows = [
      row('q1', 'answered', 'book-1', '2026-10-03T10:00:00Z', 'Staples'),
      row('q2', 'open', 'book-1', '2026-10-04T10:00:00Z', 'Amazon'),
      row('q3', 'closed', 'test-user', '2026-10-01T10:00:00Z', 'Uber'),
      row('q4', 'open', 'test-user', '2026-10-05T10:00:00Z', 'Fuel'),
    ];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method || 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} });
      const body = url.includes('/rest/v1/clientQueries') ? rows : url.includes('/queries') ? { status: 'success', data: { query: rows[0].data } } : null;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('waiting ones first, newest first, with a count on each filter; an answer goes to the server', async () => {
    setComponentWorkspace('owner');
    render(<ClientQueriesView />);
    await waitFor(() => assert.equal(screen.getAllByRole('article').length, 2));
    assert.ok(screen.getByRole('heading', { level: 1, name: /Questions about entries/ }));
    assert.deepEqual(screen.getAllByRole('article').map(a => a.getAttribute('aria-label')), ['Question about Fuel', 'Question about Amazon']);
    assert.ok(screen.getByRole('button', { name: 'Waiting (2)', pressed: true }));
    assert.ok(screen.getByRole('button', { name: 'Closed (1)' }));
    const amazon = screen.getByRole('article', { name: 'Question about Amazon' });
    assert.ok(within(amazon).getByText('$340.00'));
    fireEvent.change(within(amazon).getByLabelText('Your answer'), { target: { value: 'Office chairs' } });
    await act(async () => { fireEvent.click(within(amazon).getByRole('button', { name: 'Send answer' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.endsWith('/workspaces/component-workspace/queries/q2/reply'))));
    assert.deepEqual(calls.find(c => c.url.endsWith('/queries/q2/reply'))!.body, { text: 'Office chairs' });

    fireEvent.click(screen.getByRole('button', { name: 'Closed (1)' }));
    const closed = screen.getByRole('article', { name: 'Question about Uber' });
    assert.equal(within(closed).queryByRole('textbox'), null, 'a closed question takes no answer');
  });

  test('a bookkeeper closes only their own question and follows up on it', async () => {
    setComponentWorkspace('bookkeeper');
    render(<ClientQueriesView />);
    await waitFor(() => assert.equal(screen.getAllByRole('article').length, 2));
    const theirs = screen.getByRole('article', { name: 'Question about Amazon' });
    assert.equal(within(theirs).queryByRole('button', { name: /Close/ }), null);
    const mine = screen.getByRole('article', { name: 'Question about Fuel' });
    assert.ok(within(mine).getByLabelText('Add a follow-up'));
    await act(async () => { fireEvent.click(within(mine).getByRole('button', { name: 'Close the question' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.endsWith('/queries/q4/close') && c.method === 'POST')));
  });

  test('in the entry window a bookkeeper asks about the entry; a viewer with nothing asked sees nothing', async () => {
    setComponentWorkspace('bookkeeper');
    rows = [];
    render(<EntryQuestions transactionId="tx-new" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask about this entry' })); });
    const box = screen.getByLabelText(/Your question for the owner/);
    fireEvent.change(box, { target: { value: 'ab' } });
    assert.equal((screen.getByRole('button', { name: 'Send question' }) as HTMLButtonElement).disabled, true);
    fireEvent.change(box, { target: { value: 'What was this $340 at Amazon?' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send question' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.endsWith('/workspaces/component-workspace/queries') && c.method === 'POST')));
    assert.deepEqual(calls.find(c => c.url.endsWith('/queries'))!.body, { transactionId: 'tx-new', question: 'What was this $340 at Amazon?' });
    assert.match(calls.find(c => c.url.includes('/rest/v1/clientQueries'))!.url, /transactionId=eq\.tx-new/);
    cleanup();

    setComponentWorkspace('viewer');
    const { container } = render(<EntryQuestions transactionId="tx-new" />);
    await waitFor(() => assert.ok(calls.filter(c => c.url.includes('/rest/v1/clientQueries')).length >= 2));
    assert.equal(container.textContent, '');
  });
});
