/** "Email statements" on the customer list (BE-07): asks first, one request; not for viewers. */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmailStatementsButton from '../components/sales/EmailStatementsButton';
import { setComponentWorkspace } from './helpers/componentFixtures';

afterEach(() => cleanup());

test('asks first, then one request for all customers; No sends nothing; viewers see no button', async () => {
  setComponentWorkspace('accountant');
  const calls = stubFetchWithBodies(200, { sent: [{ name: 'Owes Co' }], skipped: [{ name: 'No Mail Ltd', reason: 'no email address' }], failed: [] });
  const asked: string[] = [];
  let answer = false;
  window.confirm = (m?: string) => { asked.push(String(m)); return answer; };
  render(<EmailStatementsButton />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Email statements' })); });
  assert.equal(calls.length, 0);
  answer = true;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Email statements' })); });
  await waitFor(() => assert.equal(calls.length, 1));
  assert.deepEqual([calls[0].url, calls[0].method, calls[0].body], ['/api/v1/workspaces/component-workspace/emails/statements', 'POST', {}]);
  assert.equal(asked[0], 'Email a statement to every active customer with an open balance?');
  cleanup();
  setComponentWorkspace('viewer');
  render(<EmailStatementsButton />);
  assert.equal(screen.queryByRole('button'), null);
});
