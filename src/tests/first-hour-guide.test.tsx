import './helpers/dom';
import React from 'react';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FirstHourGuide from '../components/onboarding/FirstHourGuide';
import OnboardingView from '../components/onboarding/OnboardingView';
import { useUIStore } from '../stores/useUIStore';

afterEach(() => {
  cleanup();
  useUIStore.setState({ activeTab: 'dashboard', activeReportTab: 'pnl', isTemplateSelectorOpen: false });
  window.location.hash = '';
});

test('first-hour guide opens the existing destinations without marking work complete', () => {
  render(<FirstHourGuide />);
  assert.equal(screen.getAllByRole('listitem').length, 8);
  for (const [label, tab] of [
    ['Open customers', 'sales'], ['Open invoices', 'sales'], ['Open bills', 'purchases'],
    ['Open unpaid invoices', 'sales'], ['Open bank import', 'banking'],
    ['Open reconciliation', 'reconciliation'], ['Open help and guide', 'help'],
  ]) {
    fireEvent.click(screen.getByRole('button', { name: label }));
    assert.equal(useUIStore.getState().activeTab, tab);
    assert.equal(window.location.hash, `#${tab}`);
  }
  useUIStore.setState({ activeReportTab: 'balance-sheet' });
  fireEvent.click(screen.getByRole('button', { name: 'Open profit and loss' }));
  assert.equal(useUIStore.getState().activeTab, 'reports');
  assert.equal(useUIStore.getState().activeReportTab, 'pnl');
  fireEvent.click(screen.getByRole('button', { name: 'Choose accounts' }));
  assert.equal(useUIStore.getState().isTemplateSelectorOpen, true);
  assert.match(screen.getByText(/These links open the existing screens/).textContent!, /do not save records or mark steps complete/);
});

test('empty welcome gives the complete route without claiming the books or AI are ready', () => {
  render(<OnboardingView />);
  assert.ok(screen.getByRole('heading', { name: 'Start your books' }));
  assert.equal(screen.getAllByRole('listitem').length, 8);
  assert.equal(screen.queryByText(/mathematical engine|Train AI|learns rules automatically|200\+/i), null);
  assert.ok(screen.getByText(/Recording a payment does not send money/));
  assert.ok(screen.getByText(/a balanced report alone does not prove/));
});
