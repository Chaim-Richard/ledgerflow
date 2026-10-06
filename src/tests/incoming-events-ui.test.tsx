/**
 * Settings → Incoming events on screen (K-37): the list in words with an icon per outcome, filters
 * for online payments / email delivery and "only problems"; bookkeepers and viewers are told it is for
 * owners and accountants (the server refuses them too).
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import IncomingEventsSettings from '../components/platform/settings/IncomingEventsSettings';
import { setComponentWorkspace } from './helpers/componentFixtures';
import type { IncomingEvent } from '../lib/incomingEvents';

const events: IncomingEvent[] = [
  { id: 'm1', source: 'email', at: '2026-10-06T13:00:00Z', what: 'Email bounced', outcome: "Not delivered: the address won't be emailed again until it is changed", tone: 'problem', detail: 'x@y.co' },
  { id: 'e1', source: 'stripe', at: '2026-10-06T10:00:00Z', what: 'Online card payment (120.00)', outcome: 'Payment recorded against the invoice', tone: 'ok' },
];

describe('Incoming events on screen', () => {
  afterEach(() => cleanup());

  test('lists them in words; filters by source and to problems only', async () => {
    setComponentWorkspace('accountant');
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ status: 'success', data: { events } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<IncomingEventsSettings />);
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 2));
    assert.equal(urls[0], '/api/v1/workspaces/component-workspace/incoming-events');
    assert.match(screen.getAllByRole('listitem')[0].textContent || '', /Email bounced · x@y\.co/);
    fireEvent.click(screen.getByRole('button', { name: 'Online payments' }));
    assert.deepEqual(screen.getAllByRole('listitem').map(li => li.textContent?.includes('Online card payment')), [true]);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByLabelText(/Only problems \(1\)/));
    assert.equal(screen.getAllByRole('listitem').length, 1);
    assert.match(screen.getByRole('listitem').textContent || '', /Email bounced/);
  });

  test('a bookkeeper is told who sees it, and nothing is asked of the server', () => {
    setComponentWorkspace('bookkeeper');
    let called = 0;
    globalThis.fetch = (async () => { called++; return new Response('{}'); }) as typeof fetch;
    render(<IncomingEventsSettings />);
    assert.match(document.body.textContent || '', /Owners and accountants see the incoming events/);
    assert.equal(called, 0);
  });
});
