/**
 * Pinned pages (I-21, owner request): pin any page (with its report or settings tab), see it on
 * every page, go there with one click or Alt+1 … Alt+9 (also on a Mac keyboard), unpin.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import PinnedPagesBar, { PinPageButton } from '../components/layout/PinnedPagesBar';
import { pageLabel } from '../config/pageLabels';
import { currentPage, MAX_PINNED, parsePinned, togglePinned } from '../lib/pinnedPages';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useUIStore } from '../stores/useUIStore';

describe('Pinned pages: rules', () => {
  test('the page includes its report or settings tab, nothing else', () => {
    assert.deepEqual(currentPage({ activeTab: 'reports', activeReportTab: 'pnl', activeSettingsTab: 'security' }), { tab: 'reports', sub: 'pnl' });
    assert.deepEqual(currentPage({ activeTab: 'settings', activeReportTab: 'pnl', activeSettingsTab: 'security' }), { tab: 'settings', sub: 'security' });
    assert.deepEqual(currentPage({ activeTab: 'sales', activeReportTab: 'pnl' }), { tab: 'sales' });
  });

  test('pin, unpin, at most nine; saved pins are checked', () => {
    let list = togglePinned([], { tab: 'sales' });
    list = togglePinned(list, { tab: 'reports', sub: 'pnl' });
    assert.deepEqual(list, [{ tab: 'sales' }, { tab: 'reports', sub: 'pnl' }]);
    assert.deepEqual(togglePinned(list, { tab: 'sales' }), [{ tab: 'reports', sub: 'pnl' }]);
    const full = Array.from({ length: MAX_PINNED }, (_, i) => ({ tab: `t${i}` }));
    assert.equal(togglePinned(full, { tab: 'extra' }).length, MAX_PINNED);
    assert.deepEqual(parsePinned('[{"tab":"sales"},{"tab":"sales"},{"tab":""},5,{"tab":"reports","sub":"pnl"}]'), [{ tab: 'sales' }, { tab: 'reports', sub: 'pnl' }]);
    assert.deepEqual(parsePinned('not json'), []);
    assert.deepEqual(parsePinned(null), []);
  });

  test('labels come from the menus', () => {
    assert.equal(pageLabel({ tab: 'dashboard' }), 'Overview');
    assert.match(pageLabel({ tab: 'settings', sub: 'branding' }), /· Branding & PDFs$/);
  });
});

describe('Pinned pages on screen', () => {
  beforeEach(() => useUIStore.setState({ pinnedPages: [], activeTab: 'dashboard' as never, activeReportTab: 'pnl', activeSettingsTab: 'appearance' }));
  afterEach(() => cleanup());

  test('pin this page, then go back to it from another page with one click', () => {
    render(<><PinPageButton /><PinnedPagesBar /></>);
    assert.equal(screen.queryByRole('navigation', { name: 'Pinned pages' }), null, 'nothing until something is pinned');
    fireEvent.click(screen.getByRole('button', { name: 'Pin this page' }));
    assert.ok(screen.getByRole('button', { name: 'Unpin this page' }));
    act(() => useUIStore.getState().goToPage({ tab: 'settings', sub: 'branding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin this page' }));
    const bar = screen.getByRole('navigation', { name: 'Pinned pages' });
    assert.match(bar.textContent || '', /1Overview.*2Preferences · Branding & PDFs/);
    fireEvent.click(screen.getByText('Overview'));
    assert.equal(useUIStore.getState().activeTab, 'dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Unpin Overview/ }));
    assert.deepEqual(useUIStore.getState().pinnedPages, [{ tab: 'settings', sub: 'branding' }]);
    assert.equal(JSON.parse(localStorage.getItem('lf_pinned_pages') || '[]').length, 1, 'kept on this device');
  });

  test('Alt+digit works with a Mac keyboard (which types "¡" for Alt+1)', () => {
    const hits: string[] = [];
    renderHook(() => useKeyboardShortcuts({ 'alt+1': () => hits.push('one'), 'alt+p': () => hits.push('pin') }));
    fireEvent.keyDown(window, { key: '¡', code: 'Digit1', altKey: true });
    fireEvent.keyDown(window, { key: 'π', code: 'KeyP', altKey: true });
    fireEvent.keyDown(window, { key: '1', code: 'Digit1' });
    assert.deepEqual(hits, ['one', 'pin']);
  });
});
