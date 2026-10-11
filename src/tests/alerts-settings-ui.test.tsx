/**
 * Settings → Alerts (S-08, S-10, S-11): an owner turns on the low-cash alert with an amount, moves
 * the close reminder and turns budget alerts off, saved through the server; others see the settings
 * but cannot change them.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AlertsSettings from '../components/platform/settings/AlertsSettings';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';

const realFetch = globalThis.fetch;

describe('Settings → Alerts', () => {
  afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

  test('an owner sets a low-cash amount, the reminder day and turns budget alerts off', async () => {
    setComponentWorkspace('owner');
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(input), method: init?.method || 'GET', body });
      return new Response(JSON.stringify({ status: 'success', alerts: body }), { status: 200 });
    }) as typeof fetch;
    render(<AlertsSettings />);
    assert.equal((screen.getByLabelText('Remind us to close last month') as HTMLInputElement).checked, true, 'on by default, from the 5th');
    assert.equal((screen.getByLabelText('Day of the month for the close reminder') as HTMLSelectElement).value, '5');
    fireEvent.change(screen.getByLabelText('Day of the month for the close reminder'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Tell us when cash runs low'));
    fireEvent.change(screen.getByLabelText('Low cash amount (USD)'), { target: { value: '5,000' } });
    fireEvent.click(screen.getByLabelText('Tell us when an account goes over its budget'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save alerts' })); });
    await waitFor(() => assert.equal(calls.length, 1));
    assert.deepEqual(calls[0], { url: '/api/v1/workspaces/component-workspace/alerts', method: 'PUT', body: { closeReminderDay: 3, cashLowCents: 500000, budgetAlerts: false } });
    await waitFor(() => assert.deepEqual(useAuthStore.getState().workspaces[0].alerts, { closeReminderDay: 3, cashLowCents: 500000, budgetAlerts: false }));
  });

  test('a bookkeeper sees the alerts but cannot change them', () => {
    setComponentWorkspace('bookkeeper');
    render(<AlertsSettings />);
    assert.equal(screen.getByLabelText('Tell us when cash runs low').matches(':disabled'), true);
    assert.equal(screen.queryByRole('button', { name: 'Save alerts' }), null);
    assert.ok(screen.getByText('Owners and accountants change the alerts.'));
  });
});
