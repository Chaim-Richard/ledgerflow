/**
 * Posting a pay run from the Payroll screen (U-02): the four accounts are suggested by name (and
 * only real accounts of the right kind are offered), the post goes to the server, and a bookkeeper
 * cannot post. Before, the screen only changed what it showed and nothing was saved. With approval
 * on (U-10), an accountant sends the run for approval and an owner approves it or sends it back.
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
import type { Employee, PayRun } from '../types';
import { useAuthStore } from '../stores/useAuthStore';

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

describe('Payroll approval (U-10)', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const answer = (reply: (url: string) => Record<string, unknown>) => {
    calls.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: String(init?.method || 'GET'), body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} });
      return new Response(JSON.stringify({ status: 'success', ...reply(String(input)) }), { status: 200 });
    }) as typeof fetch;
  };
  const waiting: PayRun = {
    id: 'pr9', uid: 'acct-9', workspaceId: 'component-workspace', date: '2026-10-20', totalAmountCents: 538_250, employeeCount: 1, status: 'awaiting_approval',
    createdAt: '2026-10-07', submittedByEmail: 'acct@example.test', grossCents: 500_000, netCents: 400_000,
    employees: [{ employeeId: 'ann', name: 'Ann', grossCents: 500_000, deductionsCents: 0, withheldCents: 100_000, employerTaxCents: 38_250, netCents: 400_000 }],
  };
  const open = (role: 'owner' | 'accountant', payRuns: PayRun[], approval = true) => {
    const ws = setComponentWorkspace(role);
    useAuthStore.setState({ workspaces: [{ ...ws, payrollApproval: approval }] });
    useLedgerStore.setState({ employees: [ann], payRuns, accounts } as never);
    markComponentCollectionsLoaded('employees', 'payRuns');
    render(<PayrollView />);
  };

  test('an accountant sends the run for approval; it shows as waiting, and they can withdraw it', async () => {
    answer(() => ({ awaitingApproval: true, payRunId: 'pr1', costCents: 538_250, netCents: 400_000, grossCents: 500_000, employees: waiting.employees }));
    open('accountant', []);
    assert.ok(screen.getByText(/Pay runs you prepare wait for an owner's approval/));
    fireEvent.click(screen.getByRole('button', { name: /Generate First Pay Run/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send the pay run for approval' })); });
    await waitFor(() => assert.equal(useLedgerStore.getState().payRuns[0]?.status, 'awaiting_approval'));
    assert.equal(useLedgerStore.getState().payRuns[0].transactionId, undefined);
    assert.ok(screen.getByText(/sent for approval: an owner approves it before it is posted/));
    assert.ok(screen.getByText('Waiting for approval'));
    assert.equal(screen.queryByRole('button', { name: /Approve and post/ }), null, 'only owners approve');
    assert.ok(screen.getByRole('button', { name: /Withdraw the pay run of/ }));
  });

  test('an owner approves a waiting run: the server posts it and the list shows it posted', async () => {
    answer(() => ({ payRunId: 'pr9', transactionId: 'tx9' }));
    open('owner', [waiting]);
    const list = screen.getByRole('list', { name: 'Pay runs waiting for approval' });
    assert.match(list.textContent || '', /prepared by acct@example\.test/);
    assert.match(list.textContent || '', /costs \$5,382\.50/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Approve and post the pay run of/ })); });
    await waitFor(() => assert.equal(useLedgerStore.getState().payRuns[0].status, 'processed'));
    assert.match(calls[0].url, /\/pay-runs\/pr9\/approve$/);
    assert.equal(useLedgerStore.getState().payRuns[0].transactionId, 'tx9');
    assert.ok(screen.getByText('No pay run is waiting for approval.'));
  });

  test('an owner sends a run back with a note; nothing is posted', async () => {
    answer(() => ({ payRunId: 'pr9' }));
    open('owner', [waiting]);
    fireEvent.click(screen.getByRole('button', { name: /Send back the pay run of/ }));
    fireEvent.change(screen.getByLabelText(/Why/), { target: { value: 'Wrong date' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send it back' })); });
    await waitFor(() => assert.equal(useLedgerStore.getState().payRuns[0].status, 'rejected'));
    assert.match(calls[0].url, /\/pay-runs\/pr9\/reject$/);
    assert.deepEqual(calls[0].body, { note: 'Wrong date' });
    assert.ok(screen.getByText('Sent back'));
    assert.ok(screen.getByText('Wrong date'));
  });

  test('an owner turns approval on; owners never see "Send for approval"', async () => {
    answer(() => ({ required: true }));
    open('owner', [], false);
    const box = screen.getByRole('checkbox', { name: /An owner approves pay runs that others prepare/ }) as HTMLInputElement;
    assert.equal(box.checked, false);
    await act(async () => { fireEvent.click(box); });
    await waitFor(() => assert.equal(useAuthStore.getState().workspaces[0].payrollApproval, true));
    assert.deepEqual([calls[0].method, calls[0].body], ['PUT', { required: true }]);
    assert.match(calls[0].url, /\/pay-runs\/approval$/);
    fireEvent.click(screen.getByRole('button', { name: /Generate First Pay Run/ }));
    assert.ok(screen.getByRole('button', { name: 'Post the pay run to the ledger' }));
  });
});
