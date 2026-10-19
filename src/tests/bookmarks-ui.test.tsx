import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, act } from '@testing-library/react';
import BookmarksGroup from '../components/layout/BookmarksGroup';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { bookmarkStorageKey } from '../lib/bookmarks';
afterEach(cleanup);
function setup() { const workspace = setComponentWorkspace(); localStorage.clear(); useUIStore.setState({ activeTab: 'reports', activeReportTab: 'pnl', isProMode: true }); return workspace; }
test('star, reorder, remount and open preserve the exact report and settings subview', () => {
  setup(); const view = render(<BookmarksGroup expanded />);
  fireEvent.click(view.getByRole('button', { name: /^Bookmark this page: Reports/ }));
  act(() => useUIStore.setState({ activeTab: 'settings', activeSettingsTab: 'security' }));
  fireEvent.click(view.getByRole('button', { name: /^Bookmark this page: Preferences/ }));
  fireEvent.click(view.getByRole('button', { name: /^Move Preferences.* up$/ }));
  const buttons = view.getAllByRole('button', { name: /^Open bookmark/ });
  assert.match(buttons[0].textContent!, /Security/);
  view.unmount(); const restored = render(<BookmarksGroup expanded />);
  assert.match(restored.getAllByRole('button', { name: /^Open bookmark/ })[0].textContent!, /Security/);
  window.history.replaceState(null, '', '?report=ar-aging&start=2024-01-01&end=2024-01-31');
  fireEvent.click(restored.getByRole('button', { name: /^Open bookmark Reports/ }));
  assert.equal(new URL(window.location.href).searchParams.get('report'), 'pnl');
  assert.equal(new URL(window.location.href).searchParams.get('start'), '2024-01-01');
  assert.equal(useUIStore.getState().activeTab, 'reports'); assert.equal(useUIStore.getState().activeReportTab, 'pnl');
});
test('changing workspace or user shows only that context’s bookmarks; old storage is retained', () => {
  const workspace = setup(); const view = render(<BookmarksGroup expanded />);
  fireEvent.click(view.getByRole('button', { name: /^Bookmark this page: Reports/ }));
  const key = bookmarkStorageKey(useAuthStore.getState().user!.uid, workspace.id), saved = localStorage.getItem(key);
  act(() => useAuthStore.setState({ currentWorkspaceId: 'other' })); assert.equal(view.queryAllByRole('button', { name: /^Open bookmark/ }).length, 0);
  act(() => useAuthStore.setState({ currentWorkspaceId: workspace.id })); assert.equal(view.queryAllByRole('button', { name: /^Open bookmark/ }).length, 1);
  act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, uid: 'other-user' } })); assert.equal(view.queryAllByRole('button', { name: /^Open bookmark/ }).length, 0);
  assert.equal(localStorage.getItem(key), saved);
});

test('storage refusal retains the bookmark for this session and reports that it was not persisted', () => {
  setup(); const prototype = Object.getPrototypeOf(localStorage), original = prototype.setItem;
  const view = render(<BookmarksGroup expanded />);
  try {
    prototype.setItem = () => { throw new Error('blocked'); };
    fireEvent.click(view.getByRole('button', { name: /^Bookmark this page: Reports/ }));
    assert.match(view.getByRole('alert').textContent!, /until this page reloads/);
    assert.equal(view.queryAllByRole('button', { name: /^Open bookmark/ }).length, 1);
  } finally { prototype.setItem = original; }
});
