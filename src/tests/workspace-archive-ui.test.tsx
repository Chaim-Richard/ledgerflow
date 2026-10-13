import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkspaceArchiveExport from '../components/platform/settings/WorkspaceArchiveExport';
import { useAuthStore } from '../stores/useAuthStore';
import { setComponentWorkspace } from './helpers/componentFixtures';

const originalFetch = globalThis.fetch;
const auth = useAuthStore.getState();

afterEach(() => {
  cleanup();
  useAuthStore.setState(auth, true);
  globalThis.fetch = originalFetch;
});

test('E-21 only a signed-in owner can request an archive', () => {
  setComponentWorkspace('viewer');
  render(<WorkspaceArchiveExport />);
  assert.equal((screen.getByRole('button', { name: 'Download workspace ZIP archive' }) as HTMLButtonElement).disabled, true);
  cleanup();
  setComponentWorkspace('owner');
  render(<WorkspaceArchiveExport />);
  assert.equal((screen.getByRole('button', { name: 'Download workspace ZIP archive' }) as HTMLButtonElement).disabled, false);
  cleanup();
  useAuthStore.setState({ isGuest: true, user: null });
  render(<WorkspaceArchiveExport />);
  assert.equal((screen.getByRole('button', { name: 'Download workspace ZIP archive' }) as HTMLButtonElement).disabled, true);
});

test('E-21 failed server snapshot is not replaced by a partial browser cache', async () => {
  setComponentWorkspace('owner');
  let calls = 0;
  globalThis.fetch = (async (input, init) => {
    calls++;
    assert.equal(String(input), '/api/v1/workspaces/component-workspace/export');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-token');
    return new Response('{}', { status: 503 });
  }) as typeof fetch;
  render(<WorkspaceArchiveExport />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Download workspace ZIP archive' }));
  });
  await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /No incomplete archive was downloaded/));
  assert.equal(calls, 1);
  assert.equal((screen.getByRole('button', { name: 'Download workspace ZIP archive' }) as HTMLButtonElement).disabled, false);
});

test('E-21 workspace switch during export cannot complete under the previous workspace', async () => {
  setComponentWorkspace('owner');
  let reply: ((value: Response) => void) | undefined;
  globalThis.fetch = (() => new Promise<Response>(resolve => { reply = resolve; })) as typeof fetch;
  render(<WorkspaceArchiveExport />);
  fireEvent.click(screen.getByRole('button', { name: 'Download workspace ZIP archive' }));
  await waitFor(() => assert.ok(reply));
  await act(async () => {
    useAuthStore.setState({ currentWorkspaceId: 'another-workspace' });
    reply!(new Response('{}', { status: 200 }));
  });
  assert.equal((screen.getByRole('button', { name: 'Download workspace ZIP archive' }) as HTMLButtonElement).disabled, true);
  assert.equal(screen.queryByText(/Archived .* collections/), null);
});
