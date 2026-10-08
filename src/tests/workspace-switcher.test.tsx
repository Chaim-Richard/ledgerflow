/**
 * The workspace switcher (K-34): type to find a workspace (any part of the name, Hebrew with or
 * without vowel marks), the most recently opened first, each with your role; arrows and Enter open
 * one and remember it; "Switch to …" in ⌘K does the same. Only the workspaces you belong to.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { recentWorkspaceIds, rememberWorkspace, switcherRows } from '../lib/workspaceSwitcher';
import WorkspaceSwitcher from '../components/layout/WorkspaceSwitcher';
import CommandPalette from '../components/layout/CommandPalette';
import { useAuthStore } from '../stores/useAuthStore';

const me = 'me';
const workspaces = [
  { id: 'w1', name: 'Acme Ltd', uid: me, currency: 'USD' },
  { id: 'w2', name: 'בית הקפה', uid: 'other', roles: { [me]: 'accountant' }, currency: 'ILS' },
  { id: 'w3', name: 'Zeta Holdings', uid: 'other', roles: { [me]: 'viewer' } },
];

describe('The rules', () => {
  beforeEach(() => localStorage.clear());

  test('filter by any part of the name, Hebrew vowel marks ignored; role from your membership', () => {
    assert.deepEqual(switcherRows(workspaces, { uid: me, query: 'hold' }).map(r => r.id), ['w3']);
    assert.deepEqual(switcherRows(workspaces, { uid: me, query: 'קָפֶה' }).map(r => [r.id, r.role]), [['w2', 'accountant']]);
    assert.deepEqual(Object.fromEntries(switcherRows(workspaces, { uid: me }).map(r => [r.id, r.role])), { w1: 'owner', w2: 'accountant', w3: 'viewer' });
  });

  test('the most recently opened first, then by name; remembered in this browser', () => {
    assert.deepEqual(switcherRows(workspaces, { uid: me }).map(r => r.id), ['w1', 'w3', 'w2'], 'by name with nothing recent');
    rememberWorkspace('w3');
    rememberWorkspace('w2');
    rememberWorkspace('w3');
    assert.deepEqual(recentWorkspaceIds(), ['w3', 'w2']);
    assert.deepEqual(switcherRows(workspaces, { uid: me, recent: recentWorkspaceIds(), currentId: 'w1' }).map(r => [r.id, r.current]), [['w3', false], ['w2', false], ['w1', true]]);
  });
});

describe('On screen', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: { uid: me } as never, workspaces: workspaces as never, currentWorkspaceId: 'w1' });
  });
  afterEach(() => cleanup());

  test('type, arrows and Enter open a workspace and remember it; Escape closes', async () => {
    const chosen: string[] = [];
    render(<WorkspaceSwitcher onSelect={id => chosen.push(id)} />);
    fireEvent.click(screen.getByRole('button', { name: /Acme Ltd/ }));
    const box = screen.getByLabelText('Find a workspace');
    assert.equal(document.activeElement, box);
    assert.equal(screen.getAllByRole('option').length, 3);
    fireEvent.change(box, { target: { value: 'a' } });
    assert.deepEqual(screen.getAllByRole('option').map(o => o.textContent), ['Acme Ltdowner · USD', 'Zeta Holdingsviewer']);
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    assert.equal(screen.getAllByRole('option')[1].getAttribute('aria-selected'), 'true');
    await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }); });
    assert.deepEqual(chosen, ['w3']);
    assert.deepEqual(recentWorkspaceIds(), ['w3']);
    assert.equal(screen.queryByRole('listbox'), null);
    fireEvent.click(screen.getByRole('button', { name: /Acme Ltd/ }));
    fireEvent.keyDown(screen.getByLabelText('Find a workspace'), { key: 'Escape' });
    assert.equal(screen.queryByRole('listbox'), null);
  });

  test('⌘K offers "Switch to …" for the other workspaces', async () => {
    let closed = 0;
    render(<CommandPalette isOpen onClose={() => { closed++; }} />);
    fireEvent.change(screen.getByLabelText('Search commands or enter a transaction'), { target: { value: 'zeta' } });
    await act(async () => { fireEvent.click(screen.getByText('Switch to Zeta Holdings')); });
    assert.equal(useAuthStore.getState().currentWorkspaceId, 'w3');
    assert.deepEqual(recentWorkspaceIds(), ['w3']);
    assert.equal(closed, 1);
    assert.equal(screen.queryByText('Switch to Acme Ltd'), null, 'not the one already open');
  });
});
