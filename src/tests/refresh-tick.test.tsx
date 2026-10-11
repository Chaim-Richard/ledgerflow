/**
 * Widget refresh (BC-04): the tick goes up when the tab comes back into view and on its timer, and
 * the needs-attention card reads the bank logins again then.
 */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useRefreshTick } from '../hooks/useRefreshTick';
import NeedsAttentionCard from '../components/dashboard/NeedsAttentionCard';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';

afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

test('the tick goes up when the tab is shown again and on its timer', async () => {
  const seen: number[] = [];
  function Probe() { seen.push(useRefreshTick(30)); return null; }
  render(<Probe />);
  act(() => { document.dispatchEvent(new window.Event('visibilitychange')); });
  await waitFor(() => assert.ok(Math.max(...seen) >= 2, 'shown again, then the timer'));
});

test('the needs-attention card reads the bank logins again when the tab is shown again', async () => {
  setComponentWorkspace('owner');
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return new Response(JSON.stringify(String(input).includes('/plaid/banks') ? { banks: [] } : []), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  render(<NeedsAttentionCard />);
  await waitFor(() => assert.equal(asked.filter(u => u.includes('/plaid/banks')).length, 1));
  act(() => { document.dispatchEvent(new window.Event('visibilitychange')); });
  await waitFor(() => assert.equal(asked.filter(u => u.includes('/plaid/banks')).length, 2));
});
