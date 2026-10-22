/**
 * EG-5: the invoice form shows the server's credit-limit refusal in its own words. Figures: Acme's limit 5,000.00, owed
 * 4,200.00, this invoice 1,000.00 → 5,200.00 (the server's sentence, passed through unchanged). For an owner or
 * accountant (the server answers canOverride) "Issue anyway" needs a reason and resends the same save with
 * creditLimitOverride { reason }; anyone else sees the refusal only.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvoiceModal from '../components/sales/InvoiceModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { reportCreditLimitRefusal } from '../lib/creditLimitPrompt';
import type { Invoice, Workspace } from '../types';
import { makeChartAccount, makeCustomer } from './fixtures';

const MESSAGE = "Over Acme's credit limit: limit $5,000.00, owed $4,200.00, this invoice $1,000.00 → $5,200.00";
const customers = [makeCustomer({ id: 'c1', name: 'Acme' })];
const accounts = [makeChartAccount({ id: 'rev', name: 'Sales', type: 'income' })];
type Saved = Partial<Invoice> & { creditLimitOverride?: { reason: string } };

/** a save the server refuses the first time (as postingKit reports it), and takes when it carries an override */
function setup(canOverride: boolean) {
  const saved: Saved[] = [];
  const onSave = async (inv: Saved) => {
    saved.push(inv);
    if (!inv.creditLimitOverride) {
      reportCreditLimitRefusal({ docId: 'new', message: MESSAGE, canOverride });
      throw new Error(MESSAGE);
    }
  };
  render(<InvoiceModal isOpen onClose={() => {}} onSave={onSave as never} customers={customers} accounts={accounts} />);
  fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'Acme' } });
  fireEvent.change(screen.getByLabelText('Item / Description'), { target: { value: 'Work' } });
  fireEvent.change(screen.getByLabelText(/^Rate/), { target: { value: '1000' } });
  return saved;
}

describe('EG-5: credit-limit refusal on the invoice form', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1', name: 'W', currency: 'USD' } as Workspace] });
    useLedgerStore.setState({ inventory: [], taxRates: [] });
  });
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('an owner sees the refusal; "Issue anyway" needs a reason and resends with it', async () => {
    const saved = setup(true);
    await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
    await waitFor(() => assert.ok(screen.getByText(MESSAGE)));
    const issue = screen.getByText('Issue anyway') as HTMLButtonElement;
    assert.equal(issue.disabled, true, 'no reason yet');
    fireEvent.change(screen.getByLabelText('Reason for issuing over the limit'), { target: { value: 'Paid by wire tomorrow' } });
    await act(async () => { fireEvent.click(screen.getByText('Issue anyway')); });
    await waitFor(() => assert.equal(saved.length, 2));
    assert.equal(saved[1].status, 'pending', 'the same save, as issued');
    assert.equal(saved[1].amountCents, 100_000);
    assert.deepEqual(saved[1].creditLimitOverride, { reason: 'Paid by wire tomorrow' });
    await waitFor(() => assert.equal(screen.queryByText(MESSAGE), null, 'the refusal is cleared on the resend'));
  });

  test('a bookkeeper sees the refusal only', async () => {
    setup(false);
    await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
    await waitFor(() => assert.ok(screen.getByText(MESSAGE)));
    assert.equal(screen.queryByText('Issue anyway'), null);
    assert.ok(screen.getByText(/Only an owner or accountant/));
  });
});
