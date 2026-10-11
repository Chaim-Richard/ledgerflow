/**
 * The product tour (P-08): the basics only, opened once for a signed-in person whose workspace is set
 * up and who hasn't seen it in this browser; never in guest mode or before setup; Next, Back, "Show me"
 * and Skip; Escape skips; remembered once finished or skipped; Help → "Take the tour" opens it again.
 */
import './helpers/dom';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ProductTour from '../components/onboarding/tour/ProductTour';
import { markTourDone, startTour, TOUR_STEPS, tourDone } from '../lib/productTour';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';

const setUp = (done = true) => {
  const ws = setComponentWorkspace('owner');
  useAuthStore.setState({ workspaces: [{ ...ws, ...(done ? { setupCompletedAt: '2026-10-01' } : {}) }] });
};
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); });

test('the steps are the basics only: no stock, projects or payroll', () => {
  assert.deepEqual(TOUR_STEPS.map(s => s.id), ['overview', 'sales', 'purchases', 'bank', 'reports', 'search']);
  assert.ok(TOUR_STEPS.every(s => !/stock item|payroll|project/i.test(s.title)));
  assert.equal(tourDone('u1'), false);
  markTourDone('u1');
  assert.equal(tourDone('u1'), true);
});

test('opens once after setup; Next, Back and Show me; Done remembers it', async () => {
  setUp();
  render(<ProductTour />);
  assert.equal(screen.getByRole('dialog', { name: 'The overview' }).textContent?.includes('Step 1 of 6'), true);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  assert.ok(screen.getByRole('dialog', { name: 'Money in' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
  assert.equal(useUIStore.getState().activeTab, 'sales');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  assert.ok(screen.getByRole('dialog', { name: 'The overview' }));
  for (let i = 0; i < TOUR_STEPS.length - 1; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  assert.ok(screen.getByRole('dialog', { name: 'Find anything' }));
  assert.equal(screen.queryByRole('button', { name: 'Show me' }), null, 'the search step has no screen');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(tourDone('test-user'), true);
  cleanup();
  render(<ProductTour />);
  assert.equal(screen.queryByRole('dialog'), null, 'not again');
  await act(async () => { startTour(); });
  assert.ok(screen.getByRole('dialog', { name: 'The overview' }), 'Help → Take the tour opens it again');
});

test('Escape skips it; never in guest mode or before setup', async () => {
  setUp();
  render(<ProductTour />);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(tourDone('test-user'), true);
  cleanup();
  localStorage.clear();
  setUp(false);
  render(<ProductTour />);
  assert.equal(screen.queryByRole('dialog'), null, 'not before the workspace is set up');
  cleanup();
  setUp();
  useAuthStore.setState({ isGuest: true });
  render(<ProductTour />);
  assert.equal(screen.queryByRole('dialog'), null, 'not in guest mode');
});
