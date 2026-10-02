import './helpers/dom';
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import CookieConsent from '../components/legal/CookieConsent';

beforeEach(() => localStorage.removeItem('ledgerflow-cookie-consent'));
afterEach(cleanup);

test('cookie consent appears without stored consent and remembers essential-only choice', () => {
  const view = render(<CookieConsent />);
  fireEvent.click(view.getByRole('button', { name: /essential/i }));
  assert.equal(JSON.parse(localStorage.getItem('ledgerflow-cookie-consent')!).choice, 'essential');
  assert.equal(view.queryByRole('button', { name: /essential/i }), null);
  cleanup();
  const reopened = render(<CookieConsent />);
  assert.equal(reopened.queryByRole('button', { name: /essential/i }), null);
});
