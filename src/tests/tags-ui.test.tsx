/**
 * Settings → Tags on screen (K-15): the tags with where they are used; renaming to another tag's
 * name offers to merge into it (sending that tag's spelling); removing asks first; a viewer only looks.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TagsSettings from '../components/platform/settings/TagsSettings';
import { setComponentWorkspace } from './helpers/componentFixtures';

const tags = [
  { tag: 'VIP', total: 4, byKind: { customers: 2, invoices: 1, transactions: 1 } },
  { tag: 'Key account', total: 1, byKind: { vendors: 1 } },
];

describe('Tags on screen', () => {
  afterEach(() => cleanup());
  const stub = () => {
    const sent: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const data = String(input).endsWith('/change') ? { changed: 4 } : { tags };
      return new Response(JSON.stringify({ status: 'success', data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    return sent;
  };

  test('where each tag is used; renaming to another tag merges into it', async () => {
    setComponentWorkspace('bookkeeper');
    const sent = stub();
    render(<TagsSettings />);
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 2));
    assert.match(screen.getAllByRole('listitem')[0].textContent || '', /VIP2 customers · 1 invoices · 1 entries/);
    fireEvent.click(screen.getByRole('button', { name: 'Rename VIP' }));
    fireEvent.change(screen.getByLabelText('New name for VIP'), { target: { value: 'key ACCOUNT' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Merge into "Key account"' })); });
    const change = sent.find(s => s.url.endsWith('/change'))!;
    assert.equal(change.url, '/api/v1/workspaces/component-workspace/tags/change');
    assert.deepEqual(change.body, { from: 'VIP', to: 'Key account' });
  });

  test('removing asks first; a viewer only looks', async () => {
    setComponentWorkspace('owner');
    const sent = stub();
    window.confirm = () => false;
    const view = render(<TagsSettings />);
    await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Remove VIP' })));
    fireEvent.click(screen.getByRole('button', { name: 'Remove VIP' }));
    assert.equal(sent.some(s => s.url.endsWith('/change')), false, 'not confirmed: nothing sent');
    view.unmount();
    setComponentWorkspace('viewer');
    stub();
    render(<TagsSettings />);
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 2));
    assert.equal(screen.queryByRole('button', { name: /^(Rename|Remove) / }), null);
  });
});
