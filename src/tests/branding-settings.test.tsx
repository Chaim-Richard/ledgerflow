/**
 * Settings → Branding & PDFs: owners and accountants edit and save (PUT with the branding, the
 * workspace in memory updated from the answer); others see the settings read-only.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import BrandingSettings from '../components/platform/settings/BrandingSettings';
import { useAuthStore } from '../stores/useAuthStore';
import type { Workspace } from '../types';

const workspace = (branding = {}) => ({ id: 'w1', uid: 'owner', name: 'Shop', currency: 'USD', roles: { v1: 'viewer' }, branding } as unknown as Workspace);
const signIn = (uid: string, branding = {}) => useAuthStore.setState({ user: { uid, getIdToken: async () => 't' } as never, currentWorkspaceId: 'w1', workspaces: [workspace(branding)] });

describe('Branding settings', () => {
  afterEach(() => cleanup());

  test('an owner edits the footer and terms and saves them', async () => {
    signIn('owner', { footer: 'Old footer', color: '#112233' });
    const calls = stubFetchWithBodies(200, { status: 'success', branding: { footer: 'Bank 12-345', color: '#112233', terms: { invoice: 'Net 30' } } });
    render(<BrandingSettings />);
    assert.equal((screen.getByLabelText('Footer on every page') as HTMLTextAreaElement).value, 'Old footer');
    fireEvent.change(screen.getByLabelText('Footer on every page'), { target: { value: 'Bank 12-345' } });
    fireEvent.change(screen.getByLabelText('Invoices'), { target: { value: 'Net 30' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save branding' })); });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'PUT');
    assert.equal(calls[0].url, '/api/v1/workspaces/w1/branding');
    assert.deepEqual(calls[0].body, { branding: { footer: 'Bank 12-345', color: '#112233', terms: { invoice: 'Net 30' } } });
    assert.deepEqual(useAuthStore.getState().workspaces[0].branding?.terms, { invoice: 'Net 30' });
  });

  test('a viewer sees the settings but cannot change or save them', () => {
    signIn('v1');
    stubFetchWithBodies(200, {});
    render(<BrandingSettings />);
    assert.ok(screen.getByText('Only owners and accountants can change the branding.'));
    assert.equal((screen.getByLabelText('Footer on every page') as HTMLTextAreaElement).closest('fieldset')?.disabled, true);
    assert.equal(screen.queryByRole('button', { name: 'Save branding' }), null);
    assert.ok(screen.getByRole('button', { name: 'Preview PDF' }));
  });
});
