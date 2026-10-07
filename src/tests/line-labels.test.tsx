/**
 * Labels on invoice and bill lines (BF-09): a line's Project, Location or Property is posted with
 * its revenue or expense, so reports by label include documents, not only journal entries. Two lines
 * on the same account with different labels stay two posted lines; lines with the same labels are
 * added together; the amounts still add up to the cent. An invoice line's labels go with its cost
 * of goods sold too. In the forms the labels are folded away until wanted, and open by themselves
 * when the line's account needs one (Z-12).
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import { lineAccounts } from '../services/ledgerPost/postingKit';
import { planInvoiceCogs } from '../services/invoiceCogs';
import { LineLabels } from '../components/common/LineLabels';
import BillModal, { type BillDraft } from '../components/purchases/BillModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { makeChartAccount, makeInvoice, makeVendor } from './fixtures';
import type { DimensionDefinition, TransactionLine, Workspace } from '../types';

const ap = makeChartAccount({ id: 'ap', code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Accounts Payable' });
const bank = makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' });
const utilities = makeChartAccount({ id: 'util', code: '6200', name: 'Utilities', type: 'expense' });
const repairs = makeChartAccount({ id: 'rep', code: '6300', name: 'Repairs', type: 'expense' });
const accounts = [ap, bank, utilities, repairs];
const dims: DimensionDefinition[] = [
  { id: 'category', name: 'Category', systemDefault: true },
  { id: 'property', name: 'Property', requiredOn: { accountIds: ['util'], since: '2026-01-01' } },
  { id: 'project', name: 'Project' },
];
const workspace = { id: 'w1', name: 'Homes', currency: 'USD', dimensions: dims } as Workspace;
const realFetch = globalThis.fetch;

describe('Posting', () => {
  afterEach(() => { globalThis.fetch = realFetch; });

  test('the bill\'s lines keep their labels: same account, two properties, two lines; same labels, one line', async () => {
    const posted: Array<{ lines: TransactionLine[] }> = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      posted.push(...JSON.parse(String(init?.body)).transactions);
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    }) as typeof fetch;
    await postBillLedger('b1', {
      id: 'b1', number: 'B-1', vendorName: 'City Power', date: '2026-05-10', status: 'approved', amountCents: 30001, currency: 'USD',
      splits: [
        { accountId: 'util', amountCents: 10000, description: 'Unit 5', dimensions: { property: 'P5' } },
        { accountId: 'util', amountCents: 10000, description: 'Unit 6', dimensions: { property: 'P6', project: ' ' } },
        { accountId: 'util', amountCents: 5000, description: 'Unit 5 again', dimensions: { property: 'P5' } },
        { accountId: 'rep', amountCents: 5001, description: 'No label' },
      ],
    } as never, 'w1', 'u1', undefined, { accounts, workspaces: [workspace], lockDate: null, transactions: [], uid: 'u1' });
    const expense = posted[0].lines.filter(l => l.amountCents > 0);
    assert.deepEqual(expense.map(l => [l.accountId, l.amountCents, l.dimensions || null]), [
      ['util', 15000, { property: 'P5' }],
      ['util', 10000, { property: 'P6' }],
      ['rep', 5001, null],
    ]);
    assert.equal(posted[0].lines.reduce((s, l) => s + l.amountCents, 0), 0, 'the entry balances');
  });

  test('empty labels are dropped; an invoice line\'s labels go with its cost of goods sold', () => {
    const weights = lineAccounts([{ accountId: 'util', amountCents: 100, dimensions: { property: ' P5 ', project: '' } }], accounts, { id: 'x', name: 'x' }, () => true);
    assert.deepEqual(weights?.[0].dimensions, { property: 'P5' });
    const invoice = makeInvoice({ id: 'i1', items: [{ id: 'l1', itemId: 'chair', description: 'Chair', quantity: 2, rateCents: 9000, amountCents: 18000, accountId: 'sales', unitCostCents: 400, dimensions: { project: 'Hotel' } }] });
    const [entry] = planInvoiceCogs({ invoiceId: 'i1', invoice, date: '2026-05-05', uid: 'u', workspaceId: 'w1', baseCurrency: 'USD',
      inventoryAccount: { id: 'inv', name: 'Inventory' }, cogsAccount: { id: 'cogs', name: 'COGS' }, items: [{ id: 'chair', name: 'Chair', unitCostCents: 400 }] }).entries;
    assert.deepEqual(entry.lines.map(l => [l.accountId, l.dimensions || null]), [['cogs', { project: 'Hotel' }], ['inv', null]]);
  });
});

describe('In the forms', () => {
  beforeEach(() => {
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [workspace] });
    useLedgerStore.setState({ accounts, dimensionNodes: [{ id: 'P5', dimensionId: 'property', description: '5 Ocean Ave' }], bills: [], transactions: [], taxRates: [] });
  });
  afterEach(async () => { cleanup(); globalThis.fetch = realFetch; getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('folded away until wanted; what is set shows on the button; the workspace\'s values are offered', () => {
    const changes: Array<Record<string, string>> = [];
    const view = render(<LineLabels value={{}} lineNumber={1} accountId="rep" date="2026-05-10" onChange={next => changes.push(next)} />);
    const button = screen.getByRole('button', { name: 'Labels for line 1' });
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(screen.queryByLabelText('Property for line 1'), null);
    fireEvent.click(button);
    fireEvent.change(screen.getByLabelText('Property for line 1'), { target: { value: 'P5' } });
    assert.deepEqual(changes.at(-1), { property: 'P5' });
    assert.ok(document.querySelector('datalist option[value="P5"]'), 'the known property is offered');
    view.rerender(<LineLabels value={{ property: 'P5' }} lineNumber={1} accountId="rep" date="2026-05-10" onChange={() => {}} />);
    assert.match(screen.getByRole('button', { name: /Labels for line 1/ }).textContent || '', /Property 5 Ocean Ave/);
    fireEvent.change(screen.getByLabelText('Property for line 1'), { target: { value: '' } });
  });

  test('a line on an account that needs a label opens by itself and says which one is missing', () => {
    render(<LineLabels value={{}} lineNumber={2} accountId="util" date="2026-05-10" onChange={() => {}} />);
    assert.equal(screen.getByRole('button', { name: 'Labels for line 2' }).getAttribute('aria-expanded'), 'true');
    assert.match(screen.getByRole('status').textContent || '', /^Property is required on Utilities$/);
    assert.ok(screen.getByLabelText('Property for line 2'));
  });

  test('the bill form saves each line\'s labels with the line', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 404 })) as typeof fetch;
    const saved: BillDraft[] = [];
    render(<BillModal isOpen onClose={() => {}} onSave={b => { saved.push(b); }} vendors={[makeVendor({ id: 'v1', name: 'City Power' })]} accounts={accounts} />);
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Electricity' } });
    fireEvent.change(screen.getByLabelText('Expense Account'), { target: { value: 'util' } });
    fireEvent.change(screen.getByLabelText(/^Amount \(/), { target: { value: '120' } });
    assert.match(screen.getByText(/Property is required on Utilities/).textContent || '', /Utilities/);
    fireEvent.change(screen.getByLabelText('Property for line 1'), { target: { value: 'P5' } });
    await act(async () => { fireEvent.click(screen.getByText('Save & Close')); });
    await waitFor(() => assert.equal(saved.length, 1));
    assert.deepEqual(saved[0].splits?.map(s => [s.accountId, s.amountCents, s.dimensions]), [['util', 12000, { property: 'P5' }]]);
  });
});
