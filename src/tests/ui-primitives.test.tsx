/**
 * Small building blocks used across the app (H-17 TanStackDataGrid, H-19 RequireRole,
 * H-20 AsyncButton, H-21 ConfirmButton, H-22 EmptyState). H-18 RadixModal no longer exists
 * (dialogs use useDialog, tested in use-dialog.test.tsx).
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AsyncButton from '../components/ui/AsyncButton';
import { ConfirmButton } from '../components/ui/ConfirmButton';
import { EmptyState } from '../components/ui/EmptyState';
import { RequireRole } from '../components/ui/RequireRole';
import { TanStackDataGrid } from '../components/ui/TanStackDataGrid';
import { useAuthStore } from '../stores/useAuthStore';
import type { Workspace } from '../types';

beforeEach(() => stubFetch(404));
afterEach(() => cleanup());

describe('AsyncButton', () => {
  test('a quick double click runs the action once (L-161)', async () => {
    let calls = 0;
    let finish!: () => void;
    render(<AsyncButton onClick={() => { calls++; return new Promise<void>(r => { finish = r; }); }}>Pay</AsyncButton>);
    const button = screen.getByRole('button', { name: 'Pay' });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    assert.equal(calls, 1);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    await act(async () => { finish(); });
    act(() => { fireEvent.click(button); });
    assert.equal(calls, 2);
  });

  test('disabled does nothing', () => {
    let calls = 0;
    render(<AsyncButton disabled onClick={() => { calls++; }}>Pay</AsyncButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    assert.equal(calls, 0);
  });
});

describe('ConfirmButton', () => {
  test('runs only when the person confirms', async () => {
    let calls = 0;
    const answers = [false, true];
    window.confirm = () => answers.shift() ?? false;
    render(<ConfirmButton onConfirm={async () => { calls++; }} confirmMessage="Delete it?">Delete</ConfirmButton>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })); });
    assert.equal(calls, 0);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })); });
    assert.equal(calls, 1);
  });
});

describe('EmptyState', () => {
  test('title, text and the action', () => {
    let clicked = 0;
    render(<EmptyState title="No invoices yet" description="Create your first invoice." actionLabel="New invoice" onAction={() => { clicked++; }} />);
    assert.ok(screen.getByText('No invoices yet'));
    assert.ok(screen.getByText('Create your first invoice.'));
    fireEvent.click(screen.getByRole('button', { name: /New invoice/ }));
    assert.equal(clicked, 1);
  });
});

describe('RequireRole', () => {
  const asRole = (role: 'owner' | 'viewer' | 'bookkeeper') => useAuthStore.setState({
    user: { uid: 'u1' } as never,
    currentWorkspaceId: 'w1',
    workspaces: [{ id: 'w1', name: 'W', uid: role === 'owner' ? 'u1' : 'other', roles: { u1: role } } as unknown as Workspace],
  });

  test('allowed: the content shows', () => {
    asRole('owner');
    render(<RequireRole requiredRole="accountant"><button>Close month</button></RequireRole>);
    assert.ok(screen.getByRole('button', { name: 'Close month' }));
  });

  test('not allowed: a message instead (or the fallback)', () => {
    asRole('viewer');
    render(<RequireRole requiredRole="accountant"><button>Close month</button></RequireRole>);
    assert.equal(screen.queryByRole('button', { name: 'Close month' }), null);
    assert.match(document.body.textContent || '', /requires ACCOUNTANT privileges/);
  });

  test('disableOnly: shown greyed out and inert, so the keyboard cannot press it either (L-161)', () => {
    asRole('bookkeeper');
    render(<RequireRole requiredRole="owner" disableOnly><button>Delete workspace</button></RequireRole>);
    const wrapper = screen.getByText('Delete workspace').parentElement!;
    assert.ok(wrapper.hasAttribute('inert'));
    assert.equal(wrapper.getAttribute('aria-disabled'), 'true');
  });
});

describe('TanStackDataGrid', () => {
  const data = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, name: `Item ${String.fromCharCode(76 - i)}`, cents: (i + 1) * 100 }));
  const columns = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'cents', header: 'Amount' },
  ];
  const bodyRows = () => within(screen.getByRole('table', { name: 'Things' })).getAllByRole('row').slice(1);

  test('named table, pages of the given size, search', () => {
    render(<TanStackDataGrid caption="Things" data={data} columns={columns} pageSize={5} />);
    assert.equal(bodyRows().length, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    assert.match(bodyRows()[0].textContent || '', /Item G/);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Item B' } });
    assert.equal(bodyRows().length, 1);
  });

  test('sorting from the header button (keyboard-reachable), with aria-sort', () => {
    render(<TanStackDataGrid caption="Things" data={data} columns={columns} pageSize={20} />);
    const header = screen.getByRole('columnheader', { name: /Name/ });
    fireEvent.click(within(header).getByRole('button'));
    assert.equal(header.getAttribute('aria-sort'), 'ascending');
    assert.match(bodyRows()[0].textContent || '', /Item A/);
  });
});
