/**
 * Recovery codes on screen (L-85): Settings shows how many are left and shows ten new ones once
 * (copy, download, "I saved them" hides them); the code step of sign-in offers "Use a recovery code"
 * and shows what went wrong.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RecoveryCodesPanel from '../components/platform/settings/RecoveryCodesPanel';
import { SecondFactorScreen } from '../core/auth/SecondFactorScreen';

const realFetch = globalThis.fetch;
const codes = Array.from({ length: 10 }, (_, i) => `abcde-fgh${i}k`);

describe('Recovery codes on screen', () => {
  afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

  test('settings: none yet, then ten shown once', async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.method || 'GET');
      const body = init?.method === 'POST' ? { status: 'success', codes } : { status: 'success', left: 0, total: 0 };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    render(<RecoveryCodesPanel />);
    assert.ok(await screen.findByText('No recovery codes yet.'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make recovery codes' })); });
    await waitFor(() => assert.equal(screen.getAllByRole('listitem').length, 10));
    assert.ok(screen.getByText('Save these now: they are not shown again.'));
    assert.ok(screen.getByText('10 unused recovery codes left.'));
    fireEvent.click(screen.getByRole('button', { name: 'I saved them' }));
    assert.equal(screen.queryAllByRole('listitem').length, 0);
    assert.deepEqual(calls, ['GET', 'POST']);
  });

  test('sign-in: "Use a recovery code" takes one and shows the reason it did not work', async () => {
    const tried: string[] = [];
    render(<SecondFactorScreen onVerify={async () => {}} onCancel={() => {}} onRecover={async code => { tried.push(code); return 'That recovery code is not right, or was used before'; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lost your phone? Use a recovery code' }));
    fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: ' abcde-fgh1k ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Use this code' })); });
    assert.deepEqual(tried, ['abcde-fgh1k']);
    assert.equal(screen.getByRole('alert').textContent, 'That recovery code is not right, or was used before');
    fireEvent.click(screen.getByRole('button', { name: 'Back to the authenticator code' }));
    assert.ok(screen.getByLabelText('Code'));
  });
});
