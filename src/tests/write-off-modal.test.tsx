/**
 * The bad debt write-off dialog (H-04): it writes off only what is still owed, through the server,
 * with the bad debt account chosen; a refusal keeps the dialog open.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WriteOffModal from '../components/sales/WriteOffModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { Workspace } from '../types';
import { makeChartAccount, makeInvoice } from './fixtures';

const invoice = makeInvoice({ id: 'i2', number: 'INV-2', customerName: 'Acme Ltd', status: 'overdue', amountCents: 10000, amountPaidCents: 2000 });
const confirm = () => act(async () => { fireEvent.click(screen.getByText('Confirm Bad Debt Write-off')); });

describe('Bad debt write-off dialog', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { uid: 'u1' } as never, currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({ accounts: [
      makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense' }),
      makeChartAccount({ id: 'bd', name: 'Bad debts', type: 'expense' }),
    ] });
  });
  afterEach(() => cleanup());

  test('writes off what is still owed (80.00) to the bad debt account', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success' });
    let closed = 0;
    render(<WriteOffModal isOpen onClose={() => { closed++; }} invoice={invoice} />);
    assert.match(document.body.textContent || '', /\$80\.00/);
    assert.equal((screen.getByLabelText('Bad Debt Expense Account') as HTMLSelectElement).value, 'bd', 'the bad debt account is picked by its name');
    await confirm();
    await waitFor(() => assert.equal(closed, 1));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/v1/workspaces/w1/invoices/i2/write-off');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, { reason: 'Uncollectible bad debt', badDebtAccountId: 'bd' });
  });

  test('a refusal keeps the dialog open; a paid invoice sends nothing', async () => {
    const calls = stubFetchWithBodies(409, { message: 'This period is locked' });
    let closed = 0;
    render(<WriteOffModal isOpen onClose={() => { closed++; }} invoice={invoice} />);
    await confirm();
    await waitFor(() => assert.equal(calls.length, 1));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(closed, 0);
    cleanup();
    render(<WriteOffModal isOpen onClose={() => { closed++; }} invoice={{ ...invoice, amountPaidCents: 10000 }} />);
    await confirm();
    assert.equal(calls.length, 1, 'nothing more was sent');
  });
});
