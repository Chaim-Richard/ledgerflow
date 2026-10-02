import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { TanStackDataGrid } from '../components/ui/TanStackDataGrid';
import AsyncButton from '../components/ui/AsyncButton';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import RequireRole from '../components/ui/RequireRole';
import { EmptyState } from '../components/ui/EmptyState';
import { setComponentWorkspace } from './helpers/componentFixtures';

beforeEach(() => setComponentWorkspace('viewer'));
afterEach(cleanup);

test('data grid paginates, sorts and finds mixed-language rows', () => {
  const data = [{ name: 'Beta', amount: 2 }, { name: 'ירושלים Project', amount: 1 }, { name: 'Alpha', amount: 3 }];
  const view = render(<TanStackDataGrid data={data} columns={[{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'amount', header: 'Amount' }]} pageSize={2} />);
  assert.equal(view.queryByText('Alpha'), null);
  fireEvent.click(view.getByRole('button', { name: 'Next page' }));
  assert.ok(view.getByText('Alpha'));
  fireEvent.click(view.getByRole('button', { name: 'First page' }));
  fireEvent.click(view.getByRole('columnheader', { name: 'Amount' }));
  assert.equal(view.getByRole('columnheader', { name: 'Amount' }).getAttribute('aria-sort'), 'descending');
  fireEvent.click(view.getByRole('columnheader', { name: 'Amount' }));
  assert.equal(view.getByRole('columnheader', { name: 'Amount' }).getAttribute('aria-sort'), 'ascending');
  fireEvent.change(view.getByRole('textbox', { name: 'Search records...' }), { target: { value: 'ירושלים' } });
  assert.ok(view.getByText('ירושלים Project'));
  assert.equal(view.queryByText('Beta'), null);
  fireEvent.change(view.getByRole('textbox', { name: 'Search records...' }), { target: { value: 'missing' } });
  assert.ok(view.getByText('No records found matching query'));
});

test('async button announces pending work and prevents duplicate requests', async () => {
  let finish: () => void = () => {};
  const request = new Promise<void>(resolve => { finish = resolve; });
  let calls = 0;
  const view = render(<AsyncButton loadingText="Saving..." onClick={() => { calls++; return request; }}>Save</AsyncButton>);
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  const pending = view.getByRole('button', { name: 'Saving...' });
  assert.equal(pending.getAttribute('aria-busy'), 'true');
  assert.equal((pending as HTMLButtonElement).disabled, true);
  fireEvent.click(pending);
  assert.equal(calls, 1);
  await act(async () => finish());
  assert.equal((view.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled, false);
});

test('confirm button refuses cancellation and invokes approved action once', async () => {
  let calls = 0;
  const previous = window.confirm;
  try {
    window.confirm = () => false;
    const view = render(<ConfirmButton onConfirm={async () => { calls++; }}>Delete</ConfirmButton>);
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Delete' })));
    assert.equal(calls, 0);
    window.confirm = () => true;
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'Delete' })));
    await waitFor(() => assert.equal(calls, 1));
  } finally { window.confirm = previous; }
});

test('role gate shows a refusal, custom fallback, and then owner controls', () => {
  const view = render(<RequireRole role="owner"><button>Close period</button></RequireRole>);
  assert.equal(view.queryByRole('button', { name: 'Close period' }), null);
  assert.ok(view.getByText(/requires OWNER privileges/));
  view.rerender(<RequireRole role="owner" fallback={<p>Ask the owner</p>}><button>Close period</button></RequireRole>);
  assert.ok(view.getByText('Ask the owner'));
  act(() => { setComponentWorkspace('owner'); });
  assert.ok(view.getByRole('button', { name: 'Close period' }));
});

test('role gate with disabled controls prevents click and keyboard activation', () => {
  let calls = 0;
  const view = render(<RequireRole role="owner" disableOnly><button onClick={() => { calls++; }}>Close period</button></RequireRole>);
  const button = view.getByRole('button', { name: 'Close period' });
  fireEvent.click(button);
  fireEvent.keyDown(button, { key: 'Enter' });
  assert.equal(calls, 0);
});

test('empty state names the next action and hides it when unavailable', () => {
  let calls = 0;
  const view = render(<EmptyState title="No contacts" description="Add your first customer" actionLabel="Add customer" onAction={() => { calls++; }} />);
  assert.ok(view.getByRole('heading', { name: 'No contacts' }));
  fireEvent.click(view.getByRole('button', { name: 'Add customer' }));
  assert.equal(calls, 1);
  view.rerender(<EmptyState title="No contacts" description="Ask your owner to add one" />);
  assert.equal(view.queryByRole('button'), null);
});
