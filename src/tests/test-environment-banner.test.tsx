/**
 * First-tester gate G-05: the built app says it is a test environment for made-up books; G-06: "Report a problem"
 * opens the feedback form, and a sent report gives the tester a reference to quote.
 */
import './helpers/dom';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TestEnvironmentBanner from '../components/support/TestEnvironmentBanner';
import { testEnvironmentBannerShown } from '../lib/testEnvironment';
import { feedbackReference } from '../lib/feedbackTicket';

afterEach(() => cleanup());

test('shown in the built app, hidden by the dev server and when switched off', () => {
  assert.equal(testEnvironmentBannerShown({ PROD: true }), true);
  assert.equal(testEnvironmentBannerShown({ PROD: true, VITE_TEST_ENVIRONMENT: 'on' }), true);
  assert.equal(testEnvironmentBannerShown({ PROD: true, VITE_TEST_ENVIRONMENT: ' OFF ' }), false);
  assert.equal(testEnvironmentBannerShown({ PROD: false }), false, 'the dev server (browser tests, screenshots) shows none');
});

test('the banner names the test environment and "Report a problem" opens the feedback form', () => {
  let opened = 0;
  const open = () => { opened += 1; };
  window.addEventListener('ledgerflow:feedback', open);
  try {
    render(<TestEnvironmentBanner shown />);
    const note = screen.getByRole('note', { name: 'Test environment' });
    assert.match(note.textContent || '', /made-up books only/);
    assert.match(note.textContent || '', /no real customers, payments or tax filings/);
    fireEvent.click(screen.getByRole('button', { name: 'Report a problem' }));
    assert.equal(opened, 1);
  } finally {
    window.removeEventListener('ledgerflow:feedback', open);
  }
});

test('nothing is rendered when it is not shown', () => {
  const { container } = render(<TestEnvironmentBanner shown={false} />);
  assert.equal(container.innerHTML, '');
});

test('the reference a tester quotes: the first 8 characters of the ticket id, upper case', () => {
  assert.equal(feedbackReference('feedback-3f2a9c1e-77b0-4d1a-9a55-0c1d2e3f4a5b'), '3F2A9C1E');
});
