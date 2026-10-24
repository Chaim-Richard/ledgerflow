/**
 * EG-4 review (4366372415): Budgets shows what a posting over a budget does; the stored value is loaded, an owner
 * changes it through PUT /workspaces/:id/budget-control, a bookkeeper only sees it, a refusal puts it back.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BudgetControlSetting from '../components/planning/BudgetControlSetting';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';

const realFetch = globalThis.fetch;
const LABEL = 'When a posting goes over a budget';
const select = () => screen.getByLabelText(LABEL) as HTMLSelectElement;
const withControl = (budgetControl: 'off' | 'warn' | 'block') =>
  useAuthStore.setState(s => ({ workspaces: s.workspaces.map(w => ({ ...w, budgetControl })) }));

describe('EG-4: the budget control on Budgets', () => {
  afterEach(() => { cleanup(); globalThis.fetch = realFetch; });

  test('warn when nothing is stored; the stored value when there is one', () => {
    setComponentWorkspace('owner');
    render(<BudgetControlSetting />);
    assert.equal(select().value, 'warn');
    cleanup();
    withControl('block');
    render(<BudgetControlSetting />);
    assert.equal(select().value, 'block');
  });

  test('an owner chooses block: PUT budget-control, the workspace keeps it', async () => {
    setComponentWorkspace('owner');
    const calls: Array<{ url: string; method?: string; body: unknown }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ status: 'success', budgetControl: 'block' }), { status: 200 });
    }) as typeof fetch;
    render(<BudgetControlSetting />);
    await act(async () => { fireEvent.change(select(), { target: { value: 'block' } }); });
    await waitFor(() => assert.equal(useAuthStore.getState().workspaces[0].budgetControl, 'block'));
    assert.deepEqual(calls, [{ url: '/api/v1/workspaces/component-workspace/budget-control', method: 'PUT', body: { budgetControl: 'block' } }]);
    assert.equal(select().value, 'block');
  });

  test('refused by the server: back to the stored value', async () => {
    setComponentWorkspace('owner');
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })) as typeof fetch;
    render(<BudgetControlSetting />);
    await act(async () => { fireEvent.change(select(), { target: { value: 'off' } }); });
    await waitFor(() => assert.equal(select().value, 'warn'));
    assert.equal(useAuthStore.getState().workspaces[0].budgetControl, undefined);
  });

  test('a bookkeeper sees it but cannot change it', () => {
    setComponentWorkspace('bookkeeper');
    withControl('block');
    render(<BudgetControlSetting />);
    assert.equal(select().value, 'block');
    assert.equal(select().disabled, true);
    assert.ok(screen.getByText('Only owners change this.'));
  });
});
