/** "Apply open credits" (BE-06): one request for one customer/vendor or all; not for viewers. */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ApplyCreditsButton from '../components/finance/ApplyCreditsButton';
import { setComponentWorkspace } from './helpers/componentFixtures';

afterEach(() => cleanup());

test('one customer\'s credits, or every vendor\'s; viewers see no button', async () => {
  setComponentWorkspace('bookkeeper');
  const calls = stubFetchWithBodies(200, { status: 'success', data: { applications: [{ documentId: 'i1' }, { documentId: 'i1' }, { documentId: 'i2' }], totalCents: 7000 } });
  render(<ApplyCreditsButton kind="customer" partyId="c1" />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply open credits' })); });
  await waitFor(() => assert.equal(calls.length, 1));
  assert.deepEqual([calls[0].url, calls[0].body], ['/api/v1/payments/credits/auto-apply', { workspaceId: 'component-workspace', kind: 'customer', partyId: 'c1' }]);
  cleanup();
  render(<ApplyCreditsButton kind="vendor" />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply open credits' })); });
  await waitFor(() => assert.equal(calls.length, 2));
  assert.deepEqual(calls[1].body, { workspaceId: 'component-workspace', kind: 'vendor' });
  cleanup();
  setComponentWorkspace('viewer');
  render(<ApplyCreditsButton kind="customer" />);
  assert.equal(screen.queryByRole('button'), null);
});
