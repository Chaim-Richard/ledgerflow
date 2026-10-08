/**
 * Help → Main path (DA-06): one page for each of the twelve steps of the main path, in order, each
 * answering all ten questions, each linking to a screen that exists; and it shows in Help & Guide.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MAIN_PATH, MAIN_PATH_FIELDS } from '../lib/mainPathGuide';
import { APP_TABS, REPORT_TABS_REGISTRY, SETTINGS_TABS_REGISTRY } from '../config/registry';
import HelpGuideView from '../components/support/HelpGuideView';
import { useUIStore } from '../stores/useUIStore';
import { stubFetch } from './helpers/dom';

describe('The main path pages', () => {
  test('twelve steps in order, each with all ten answers', () => {
    assert.equal(MAIN_PATH.length, 12);
    assert.deepEqual(MAIN_PATH.map(s => Number(s.title.split('.')[0])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.equal(MAIN_PATH_FIELDS.length, 10);
    for (const step of MAIN_PATH) for (const f of MAIN_PATH_FIELDS) assert.ok(step[f.key].trim().length > 5, `${step.id}: ${f.label}`);
  });

  test('each step opens a screen that exists', () => {
    const tabs = new Set((APP_TABS as Array<{ id: string }>).map(t => t.id));
    const reports = new Set(REPORT_TABS_REGISTRY.map(r => r.id));
    const settings = new Set(SETTINGS_TABS_REGISTRY.map(r => r.id));
    for (const step of MAIN_PATH) {
      assert.ok(tabs.has(step.page.tab), `${step.id}: ${step.page.tab}`);
      if (step.page.tab === 'reports' && step.page.sub) assert.ok(reports.has(step.page.sub), `${step.id}: ${step.page.sub}`);
      if (step.page.tab === 'settings' && step.page.sub) assert.ok(settings.has(step.page.sub), `${step.id}: ${step.page.sub}`);
    }
  });

  test('no step promises what the app does not do', () => {
    const text = MAIN_PATH.map(s => MAIN_PATH_FIELDS.map(f => s[f.key]).join(' ')).join(' ').toLowerCase();
    for (const claim of ['automatically reconcil', 'consolidat', 'files your tax', 'guarantee']) assert.ok(!text.includes(claim), claim);
  });
});

describe('In Help & Guide', () => {
  afterEach(() => cleanup());

  test('"Main path" shows the steps; a step opens its screen', async () => {
    stubFetch(404);
    render(<HelpGuideView />);
    fireEvent.click(screen.getByRole('button', { name: 'Main path' }));
    assert.ok(screen.getByRole('heading', { name: '8. Reconcile' }));
    assert.equal(screen.getAllByText('What still needs a person').length, 12);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open this screen for 8. Reconcile' })); });
    assert.equal(useUIStore.getState().activeTab, 'reconciliation');
  });
});
