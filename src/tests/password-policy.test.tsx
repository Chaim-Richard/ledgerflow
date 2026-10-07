/**
 * Password rules (Y-31): at least 10 characters, not a common password, not your email name, not one
 * character repeated. Sign-up refuses a weak password before asking for an account; after a reset
 * link, a new password is chosen (twice, under the same rules) before the app opens.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { passwordProblem } from '../lib/passwordPolicy';
import { AuthScreen } from '../core/auth/AuthScreen';
import NewPasswordScreen from '../core/auth/NewPasswordScreen';
import { useBillingStore } from '../modules/billing/BillingService';

afterEach(() => cleanup());

describe('The rules', () => {
  test('too short, common, the email name, one character repeated; a good one passes', () => {
    assert.match(String(passwordProblem('short1!')), /at least 10/);
    assert.match(String(passwordProblem('Password123')), /most used/);
    assert.match(String(passwordProblem('qwertyuiop!')), /most used/);
    assert.match(String(passwordProblem('aaaaaaaaaaaa')), /repeat/);
    assert.match(String(passwordProblem('dana.levi-2026!', 'dana.levi@example.com')), /email name/);
    assert.equal(passwordProblem('blue-harbor-41-lantern', 'dana@example.com'), null);
  });
});

describe('Sign-up', () => {
  test('a weak password is refused on the spot; nothing is sent', async () => {
    useBillingStore.setState({ registrationAllowed: true } as never);
    const signups: string[] = [];
    render(<AuthScreen onLogin={() => {}} onEmailLogin={async () => {}} onEmailSignup={async (e) => { signups.push(e); }} onPasswordReset={async () => {}} onGuest={() => {}} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Sign up' }));
    await screen.findByRole('button', { name: 'Submit Registration' });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'dana@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' })); });
    assert.match(screen.getByRole('alert').textContent || '', /most used/);
    assert.deepEqual(signups, []);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'blue-harbor-41-lantern' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' })); });
    await waitFor(() => assert.deepEqual(signups, ['dana@example.com']));
  });
});

describe('After a reset link', () => {
  test('the two must match and follow the rules; then the new password is saved', async () => {
    const saved: string[] = [];
    render(<NewPasswordScreen email="dana@example.com" onSave={async (p) => { saved.push(p); }} onSignOut={() => {}} />);
    assert.ok(screen.getByRole('heading', { name: /Choose a new password/ }));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'blue-harbor-41-lantern' } });
    fireEvent.change(screen.getByLabelText('The same again'), { target: { value: 'blue-harbor-41-lanterns' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save the new password' })); });
    assert.equal(screen.getByRole('alert').textContent, 'The two passwords are not the same');
    fireEvent.change(screen.getByLabelText('The same again'), { target: { value: 'blue-harbor-41-lantern' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save the new password' })); });
    await waitFor(() => assert.deepEqual(saved, ['blue-harbor-41-lantern']));
  });
});
