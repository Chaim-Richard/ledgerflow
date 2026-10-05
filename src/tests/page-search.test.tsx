/**
 * Go anywhere by typing (BB-09 settings search): every screen, report and settings tab is in the
 * command palette, settings found by the words people use ("logo", "invoice number").
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import CommandPalette from '../components/layout/CommandPalette';
import { pageIndex, searchPages } from '../config/pageIndex';
import { useUIStore } from '../stores/useUIStore';

describe('Page search', () => {
  const index = pageIndex('en');

  test('screens, reports and settings are all there', () => {
    assert.ok(index.some(p => p.page.tab === 'dashboard'));
    assert.ok(index.some(p => p.page.tab === 'reports' && p.page.sub === 'pnl'));
    assert.ok(index.some(p => p.page.tab === 'settings' && p.page.sub === 'numbering'));
  });

  test('settings by what they are about', () => {
    const first = (q: string) => searchPages(index, q)[0]?.page;
    assert.deepEqual(first('logo'), { tab: 'settings', sub: 'branding' });
    assert.deepEqual(first('invoice number'), { tab: 'settings', sub: 'numbering' });
    assert.deepEqual(first('2fa'), { tab: 'settings', sub: 'security' });
    assert.deepEqual(searchPages(index, ''), []);
  });
});

describe('Command palette', () => {
  afterEach(() => cleanup());

  test('typing "logo" offers Branding; choosing it opens that settings tab at once', async () => {
    useUIStore.setState({ activeTab: 'dashboard' as never, activeSettingsTab: 'appearance' });
    let closed = 0;
    render(<CommandPalette isOpen onClose={() => { closed++; }} />);
    fireEvent.change(screen.getByLabelText('Search commands or enter a transaction'), { target: { value: 'logo' } });
    const option = screen.getByText(/Go to Settings: Branding/);
    await act(async () => { fireEvent.click(option); });
    assert.equal(useUIStore.getState().activeTab, 'settings');
    assert.equal(useUIStore.getState().activeSettingsTab, 'branding');
    assert.equal(closed, 1);
  });
});
