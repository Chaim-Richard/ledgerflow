/**
 * Posting a pay run from the Payroll screen (U-02): the four accounts are suggested by name (and
 * only real accounts of the right kind are offered), the post goes to the server, and a bookkeeper
 * cannot post. Before, the screen only changed what it showed and nothing was saved.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PayrollView from '../components/hr/PayrollView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { makeChartAccount } from './fixtures';
import type { Employee } from '../types';

const accounts = [
  makeChartAccount({ id: 'bank', code: '1000', name: 'Checking', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'wages', code: '6000', name: 'Wages and salaries', type: 'expense', category: 'Payroll' }),
  makeChartAccount({ id: 'ptax', code: '6010', name: 'Payroll tax expense', type: 'expense', category: 'Payroll' }),
  makeChartAccount({ id: 'liab', code: '2100', name: 'Payroll liabilities', type: 'liability', category: 'Current liabilities' }),
];
const ann = { id: 'ann', uid: 'u', workspaceId: 'component-workspace', name: 'Ann', role: 'Staff', salaryCents: 6_000_000, payFrequency: 'Monthly', status: 'Active', filingStatus: 'Single', state: 'TX', createdAt: '2026-01-01' } as Employee;

describe('Posting a pay run', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  const open = (role: 'accountant' | 'bookkeeper') => {
    setComponentWorkspace(role);
    useLedgerStore.setState({ employees: [ann], payRuns: [], accounts } as never);
    markComponentCollectionsLoaded('employees', 'payRuns');
    render(<PayrollView />);
    fireEvent.click(screen.getByRole('button', { name: /Generate First Pay Run/ }));
  };

  test('the accounts are suggested by name and the post goes to the server', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} });
      return new Response(JSON.stringify({ status: 'success', payRunId: 'pr1', transactionId: 'tx1', costCents: 538_250, netCents: 400_000, employees: [{}] }), { status: 200 });
    }) as typeof fetch;
    open('accountant');
    assert.equal((screen.getByLabelText('Bank account the pay goes out of') as HTMLSelectElement).value, 'bank');
    assert.equal((screen.getByLabelText('Wages expense account') as HTMLSelectElement).value, 'wages');
    assert.equal((screen.getByLabelText('Payroll tax expense account') as HTMLSelectElement).value, 'ptax');
    assert.equal((screen.getByLabelText(/Payroll liabilities account/) as HTMLSelectElement).value, 'liab');
    assert.deepEqual([...(screen.getByLabelText('Bank account the pay goes out of') as HTMLSelectElement).options].map(o => o.value), ['', 'bank'], 'only bank and cash accounts');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post the pay run to the ledger' })); });
    await waitFor(() => assert.equal(calls.length, 1));
    assert.match(calls[0].url, /\/api\/v1\/workspaces\/component-workspace\/pay-runs$/);
    assert.deepEqual({ ...calls[0].body, date: 'd' }, { date: 'd', bankAccountId: 'bank', wagesAccountId: 'wages', taxExpenseAccountId: 'ptax', liabilitiesAccountId: 'liab' });
    await waitFor(() => assert.equal(useLedgerStore.getState().payRuns.length, 1));
  });

  test('a bookkeeper sees the run but cannot post it', () => {
    open('bookkeeper');
    assert.equal((screen.getByRole('button', { name: 'Post the pay run to the ledger' }) as HTMLButtonElement).disabled, true);
  });
});
