/**
 * D-90: Settings is five short sections with one search box. Every registered settings screen is
 * reachable exactly once, a screen with no section fails this test (rather than disappearing),
 * and searching keeps the plain labels a person recognises. Display only: the same components
 * render, and choosing a screen only changes `activeSettingsTab`.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Settings from '../components/platform/Settings';
import { SETTINGS_TABS_REGISTRY } from '../config/registry';
import { SETTINGS_SECTION_TAB_IDS, SETTINGS_SECTIONS, settingsSectionOf, settingsTabMatches } from '../lib/settingsSections';
import { useUIStore } from '../stores/useUIStore';
import { getSupabase } from '../lib/db/client';

const registryIds = SETTINGS_TABS_REGISTRY.map(tab => tab.id).sort();

describe('Settings sections (D-90)', () => {
  test('five sections cover every settings screen exactly once', () => {
    assert.equal(SETTINGS_SECTIONS.length, 5);
    assert.deepEqual([...SETTINGS_SECTION_TAB_IDS].sort(), registryIds, 'a new settings screen must be given a section');
    assert.equal(new Set(SETTINGS_SECTION_TAB_IDS).size, SETTINGS_SECTION_TAB_IDS.length, 'no screen is listed twice');
    assert.equal(new Set(SETTINGS_SECTIONS.map(section => section.id)).size, 5);
    for (const id of registryIds) assert.ok(settingsSectionOf(id), `${id} has a section`);
    assert.equal(settingsSectionOf('not-a-setting'), null);
  });

  test('search matches the visible label in both languages, the section and the id', () => {
    assert.equal(settingsTabMatches('', 'tax-profiles', { en: 'Tax profiles' }), true, 'an empty search keeps every setting');
    assert.equal(settingsTabMatches('TAX', 'tax-profiles', { en: 'Tax profiles' }), true);
    assert.equal(settingsTabMatches('tax', 'numbering', { en: 'Document Numbering' }), false);
    assert.equal(settingsTabMatches('num', 'numbering', { en: 'Document Numbering' }), true);
    assert.equal(settingsTabMatches('people', 'team', { en: 'Team & Invites' }), true, 'the section name finds its screens');
    assert.equal(settingsTabMatches('tax', 'billing', { en: 'Billing & Plan' }), false);
    assert.equal(settingsTabMatches('billing plan', 'billing', { en: 'Billing & Plan' }), true, 'every word must match');
    assert.equal(settingsTabMatches('billing plan', 'billing', { en: 'Billing & Plan', he: 'תוכניות וחיוב' }), true);
  });
});

describe('Settings on screen', () => {
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('plain heading, five sections, every screen reachable, search narrows the list', () => {
    useUIStore.setState({ activeTab: 'settings', activeSettingsTab: 'tax-profiles', language: 'en' });
    render(<Settings />);

    assert.ok(screen.getByRole('heading', { level: 1, name: 'Settings' }));
    assert.equal(screen.queryByText(/Precision Core/i), null, 'no invented jargon');
    assert.equal(screen.queryByText(/institutional/i), null);

    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    for (const section of SETTINGS_SECTIONS) {
      assert.ok(screen.getByRole('heading', { level: 2, name: section.label.en }), `${section.label.en} is a heading`);
    }
    // every settings screen is a button with its own visible name
    for (const tab of SETTINGS_TABS_REGISTRY) {
      assert.ok(nav.contains(screen.getByRole('button', { name: tab.label.en })), `${tab.id} is reachable`);
    }
    const active = screen.getByRole('button', { name: 'Tax profiles' });
    assert.equal(active.getAttribute('aria-current'), 'page');
    assert.equal(screen.getByRole('button', { name: 'Team & Invites' }).getAttribute('aria-current'), null);

    const search = screen.getByLabelText('Find a setting');
    fireEvent.change(search, { target: { value: 'tax' } });
    assert.ok(screen.getByRole('button', { name: 'Tax profiles' }));
    assert.equal(screen.queryByRole('button', { name: 'Billing & Plan' }), null, 'a non-matching screen is filtered out');
    assert.match(screen.getByRole('status').textContent || '', /1 setting matches tax/);

    fireEvent.change(search, { target: { value: 'nothing like this' } });
    assert.ok(screen.getByText(/No setting matches/));
    fireEvent.click(screen.getByRole('button', { name: 'Show all settings' }));
    assert.ok(screen.getByRole('button', { name: 'Billing & Plan' }), 'the clear action restores every screen');
    assert.equal((search as HTMLInputElement).value, '');

    fireEvent.click(screen.getByRole('button', { name: 'Document Numbering' }));
    assert.equal(useUIStore.getState().activeSettingsTab, 'numbering');
  });
});
