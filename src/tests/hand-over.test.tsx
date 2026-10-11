/**
 * Shared-inbox triage (BG-05): on To Review, an entry nobody has yet can be given to someone (a task
 * about it); one with an open task says who has it.
 */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HandOver } from '../components/collaboration/HandOver';
import { useHandOvers } from '../components/collaboration/useHandOvers';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';

afterEach(() => cleanup());

function Rows() {
  const hand = useHandOvers();
  return (
    <ul>
      <li>A: <HandOver record={{ type: 'transaction', id: 'tx-a', label: 'Entry 2026-10-01 · Amazon' }} hand={hand} /></li>
      <li>B: <HandOver record={{ type: 'transaction', id: 'tx-b', label: 'Entry 2026-10-02 · Uber' }} hand={hand} /></li>
    </ul>
  );
}

test('who has an entry, and giving one to someone', async () => {
  setComponentWorkspace('bookkeeper');
  const me = useAuthStore.getState().user!.uid;
  const posts: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      posts.push(body);
      return new Response(JSON.stringify({ status: 'success', task: { id: 'n', kind: 'task', status: 'open', assignee: body.assignee, record: body.record, title: body.title } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: 'success', tasks: [{ id: 't', kind: 'task', status: 'open', assignee: 'dana', record: { type: 'transaction', id: 'tx-a', label: 'x' } }], people: [{ uid: me, role: 'bookkeeper' }, { uid: 'dana', role: 'accountant', email: 'dana@example.test' }] }), { status: 200 });
  }) as typeof fetch;
  render(<Rows />);
  await waitFor(() => assert.ok(screen.getByText('With dana@example.test')));
  await act(async () => { fireEvent.change(screen.getByLabelText('Give Entry 2026-10-02 · Uber to someone'), { target: { value: me } }); });
  assert.deepEqual(posts, [{ title: 'Review: Entry 2026-10-02 · Uber', assignee: me, record: { type: 'transaction', id: 'tx-b', label: 'Entry 2026-10-02 · Uber' } }]);
  await waitFor(() => assert.ok(screen.getByText('With you')));
});
